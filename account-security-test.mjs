// firebase-functions/src/account-security.ts
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";

// firebase-functions/src/account-security-crypto.ts
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
var opaque = () => randomBytes(32).toString("base64url");
var digest = (value) => createHash("sha256").update(value).digest("hex");
function equal(a, b) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
function masterKey(value) {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value) || Buffer.from(value, "base64").length !== 32) throw new Error("ORIN_SECURITY_MASTER_KEY must be a 32-byte base64 secret");
  return Buffer.from(value, "base64");
}
function seal(secret, key2, uid) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key2, iv);
  cipher.setAAD(Buffer.from(`ORIN:TOTP:v1:${uid}`));
  return ["v1", iv.toString("base64url"), Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]).toString("base64url"), cipher.getAuthTag().toString("base64url")].join(".");
}
function unseal(value, key2, uid) {
  const [version, iv, data2, tag] = value.split(".");
  if (version !== "v1") throw new Error("Unsupported secret version");
  const cipher = createDecipheriv("aes-256-gcm", key2, Buffer.from(iv, "base64url"));
  cipher.setAAD(Buffer.from(`ORIN:TOTP:v1:${uid}`));
  cipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([cipher.update(Buffer.from(data2, "base64url")), cipher.final()]).toString("utf8");
}
var alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32(bytes) {
  let bits = 0, value = 0, out = "";
  for (const byte of bytes) {
    value = value << 8 | byte;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[value >>> bits - 5 & 31];
      bits -= 5;
    }
  }
  if (bits) out += alphabet[value << 5 - bits & 31];
  return out;
}
function decode32(value) {
  let bits = 0, n = 0, bytes = [];
  for (const c of value) {
    const x = alphabet.indexOf(c);
    if (x < 0) throw new Error("Invalid base32");
    n = n << 5 | x;
    bits += 5;
    if (bits >= 8) {
      bytes.push(n >>> bits - 8 & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
var newTotpSecret = () => base32(randomBytes(20));
function hotp(secret, counter, digits = 6) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", decode32(secret)).update(b).digest(), offset = h[h.length - 1] & 15;
  return String((h.readUInt32BE(offset) & 2147483647) % 10 ** digits).padStart(digits, "0");
}
function verifyTotp(secret, code, now, lastStep = -1) {
  if (!/^\d{6}$/.test(code)) return null;
  const center = Math.floor(now / 3e4);
  for (const step of [center, center - 1, center + 1]) if (step > lastStep && equal(hotp(secret, step), code)) return step;
  return null;
}
function newRecoveryCodes() {
  return Array.from({ length: 10 }, () => randomBytes(12).toString("hex").match(/.{1,6}/g).join("-"));
}
var recoveryHash = (code) => digest("ORIN:recovery:" + code.trim().toLowerCase().replace(/[-\s]/g, ""));
var recoveryFormat = (code) => typeof code === "string" && /^[a-fA-F0-9\s-]{24,40}$/.test(code) && code.replace(/[-\s]/g, "").length === 24;
var failureDelay = (failures) => failures < 3 ? 0 : Math.min(15 * 6e4, 1e3 * 2 ** Math.min(20, failures - 3));
function safeDevice(value) {
  const clean = (v, n = 100) => typeof v === "string" ? v.replace(/[\x00-\x1f<>]/g, "").slice(0, n) : "";
  return { platform: ["Android", "iOS", "Web"].includes(value?.platform) ? value.platform : "Other", label: clean(value?.label) || "ORIN", manufacturer: clean(value?.manufacturer), model: clean(value?.model), osVersion: clean(value?.osVersion, 40), appVersion: clean(value?.appVersion, 30) };
}

// firebase-functions/src/account-security.ts
var app = getApps()[0] ?? initializeApp();
var securityDb = getFirestore(app);
var securityAuth = getAuth(app);
var SecurityError = class extends Error {
  constructor(message, status = 400, code = "security-error") {
    super(message);
    this.status = status;
    this.code = code;
  }
};
var db = securityDb;
var auth = securityAuth;
var doc = (c, id) => db.collection(c).doc(id);
var profileRef = (uid) => doc("orinAccountSecurity", uid);
var sessionRef = (sid) => doc("orinSecuritySessions", sid);
var defaults = { epoch: 0, factorVersion: 0, totpEnabled: false, recoveryHashes: [], lastTotpStep: -1, failures: 0, blockedUntil: 0 };
var data = (s) => ({ ...defaults, ...typeof s?.data === "function" ? s.data() ?? {} : s ?? {} });
var key = () => masterKey(process.env.ORIN_SECURITY_MASTER_KEY ?? "");
var securityEnabled = () => process.env.ORIN_ACCOUNT_SECURITY_ENABLED === "true";
async function ensureSecurityActivation(requireEncryption = false) {
  if (!securityEnabled()) throw new SecurityError("\u062E\u0627\u062F\u0645 \u0623\u0645\u0627\u0646 ORIN \u063A\u064A\u0631 \u0645\u0641\u0639\u0651\u0644 \u0628\u0639\u062F.", 503);
  if (requireEncryption) key();
  const marker = (await doc("system", "account-security").get()).data();
  if (marker?.enabled !== true || marker?.rulesVersion !== 160) throw new SecurityError("\u0646\u0634\u0631 \u0642\u0648\u0627\u0639\u062F \u062D\u0645\u0627\u064A\u0629 \u0627\u0644\u062D\u0633\u0627\u0628 \u0644\u0645 \u064A\u0643\u062A\u0645\u0644 \u0628\u0639\u062F.", 503);
}
var SESSION_LIFE = 30 * 864e5;
var ACCESS_LIFE = 36e5;
var CHALLENGE_LIFE = 5 * 6e4;
var STEPUP_LIFE = 12e4;
var actions = /* @__PURE__ */ new Set(["totp.enroll", "totp.disable", "recovery.regenerate", "passkey.add", "passkey.delete", "trusted.add", "trusted.delete", "password.change", "withdrawal.destination", "withdrawal.submit"]);
var actionName = (v) => {
  if (!actions.has(v)) throw new SecurityError("\u0625\u062C\u0631\u0627\u0621 \u0623\u0645\u0646\u064A \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.");
  return v;
};
function audit(tx, uid, action, sid, ip, details = {}) {
  const id = opaque();
  tx.create(doc("orinSecurityEvents", id), { id, uid, action, sessionId: sid, ip, details, createdAt: Date.now() });
}
async function availableUser(uid) {
  const [user, p, access] = await Promise.all([auth.getUser(uid), doc("users", uid).get(), doc("orinControlAccess", uid).get()]);
  if (user.disabled || p.data()?.disabled || access.data()?.status === "suspended") throw new SecurityError("\u0627\u0644\u062D\u0633\u0627\u0628 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D.", 403);
  return user;
}
async function enforceSecuritySession(token, accessToken) {
  const sid = token.sid;
  if (typeof sid !== "string" || !/^[\w-]{43}$/.test(sid)) throw new SecurityError("\u064A\u062C\u0628 \u0625\u0643\u0645\u0627\u0644 \u062A\u062D\u0642\u0642 \u062C\u0644\u0633\u0629 ORIN.", 401, "invalid-session");
  const [s, p] = await Promise.all([sessionRef(sid).get(), profileRef(token.uid).get()]);
  const session = s.data(), profile = data(p), now = Date.now();
  if (!session || session.uid !== token.uid || session.status !== "active" || session.expiresAtMs <= now || session.epoch !== profile.epoch || token.security_epoch !== profile.epoch) throw new SecurityError("\u0627\u0646\u062A\u0647\u062A \u0627\u0644\u062C\u0644\u0633\u0629 \u0623\u0648 \u062A\u0645 \u0625\u0628\u0637\u0627\u0644\u0647\u0627.", 401, "session-revoked");
  if (accessToken !== void 0 && (!/^[\w-]{43}$/.test(accessToken) || !(equal(session.accessHash, digest(accessToken)) && session.accessExpiresAt > now || session.previousAccessHash && session.previousAccessUntil > now && equal(session.previousAccessHash, digest(accessToken))))) throw new SecurityError("\u0627\u0646\u062A\u0647\u0649 \u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u062C\u0644\u0633\u0629. \u064A\u0631\u062C\u0649 \u062A\u062C\u062F\u064A\u062F \u0627\u0644\u062C\u0644\u0633\u0629.", 401, "session-expired");
  const providerUser = await availableUser(token.uid);
  if ((providerUser.tokensValidAfterTime ?? "") !== (session.providerValidAfter ?? "")) {
    await sessionRef(sid).update({ status: "revoked", revokedAt: Date.now() });
    throw new SecurityError("\u0623\u064F\u0628\u0637\u0644\u062A \u0627\u0644\u062C\u0644\u0633\u0629 \u0644\u062F\u0649 \u0645\u0648\u0641\u0651\u0631 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644.", 401, "session-revoked");
  }
  return session;
}
async function context(header, access, meta) {
  if (!header?.startsWith("Bearer ") || !access) throw new SecurityError("\u0633\u062C\u0651\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0644\u0644\u0645\u062A\u0627\u0628\u0639\u0629.", 401, "invalid-session");
  let token;
  try {
    token = await auth.verifyIdToken(header.slice(7), true);
  } catch {
    throw new SecurityError("\u0627\u0646\u062A\u0647\u062A \u062C\u0644\u0633\u0629 \u0627\u0644\u062F\u062E\u0648\u0644.", 401, "session-expired");
  }
  const session = await enforceSecuritySession(token, access);
  await availableUser(token.uid);
  if (Date.now() - session.lastActiveAt > 6e4) await sessionRef(String(token.sid)).update({ lastActiveAt: Date.now() });
  return { uid: token.uid, sid: String(token.sid), session, token, ip: meta.ip };
}
function freshPrimary(token, now = Date.now()) {
  if (token.sid || token.firebase?.sign_in_provider === "custom" || !token.auth_time || now - token.auth_time * 1e3 > 12e4 || token.auth_time * 1e3 > now + 3e4) throw new SecurityError("\u0623\u0639\u062F \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0647\u0648\u064A\u062A\u0643 \u0628\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0623\u0648\u0644\u064B\u0627.", 401, "recent-auth-required");
}
async function primary(raw, uid) {
  if (typeof raw !== "string" || raw.length > 2e4) throw new SecurityError("\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0637\u0644\u0648\u0628\u0629.", 401);
  let t;
  try {
    t = await auth.verifyIdToken(raw, true);
  } catch {
    throw new SecurityError("\u062A\u0639\u0630\u0631 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644.", 401);
  }
  freshPrimary(t);
  if (uid && t.uid !== uid) throw new SecurityError("\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u062A\u062D\u0642\u0642 \u0644\u0627 \u062A\u062E\u0635 \u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628.", 403);
  const provider = await availableUser(t.uid);
  if (provider.tokensValidAfterTime && Date.parse(provider.tokensValidAfterTime) > t.auth_time * 1e3) throw new SecurityError("\u0623\u064F\u0628\u0637\u0644 \u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u062F\u062E\u0648\u0644.", 401, "recent-auth-required");
  return t;
}
function factor(profile, input, uid, now) {
  if (profile.blockedUntil > now) throw new SecurityError("\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0643\u062B\u064A\u0631\u0629. \u062D\u0627\u0648\u0644 \u0644\u0627\u062D\u0642\u064B\u0627.", 429);
  if (!profile.totpEnabled) return { ok: false, patch: {} };
  if (typeof input.otp === "string") {
    const step = verifyTotp(unseal(profile.totpCiphertext, key(), uid), input.otp, now, profile.lastTotpStep);
    if (step !== null) return { ok: true, patch: { lastTotpStep: step, failures: 0, blockedUntil: 0 } };
  }
  if (recoveryFormat(input.recoveryCode)) {
    const hash = recoveryHash(input.recoveryCode), hashes = profile.recoveryHashes ?? [];
    if (hashes.some((h) => equal(h, hash))) return { ok: true, patch: { recoveryHashes: hashes.filter((h) => !equal(h, hash)), failures: 0, blockedUntil: 0 } };
  }
  const failures = (profile.failures ?? 0) + 1;
  return { ok: false, patch: { failures, blockedUntil: now + failureDelay(failures) } };
}
function sessionRecord(uid, epoch, meta) {
  const now = Date.now(), sid = opaque(), accessToken = opaque(), refreshToken = opaque();
  return { sid, accessToken, refreshToken, record: { uid, epoch, status: "active", createdAt: now, lastActiveAt: now, expiresAtMs: now + SESSION_LIFE, accessExpiresAt: now + ACCESS_LIFE, accessHash: digest(accessToken), refreshHash: digest(refreshToken), previousRefreshHash: null, device: safeDevice(meta.device), ip: meta.ip, ipSource: meta.ipSource ?? "unavailable", transportIP: meta.transportIP ?? null, approximateLocation: null, providerValidAfter: meta.providerValidAfter ?? "" } };
}
async function bundle(s) {
  return { sessionId: s.sid, accessToken: s.accessToken, refreshToken: s.refreshToken, expiresAt: s.record.expiresAtMs, accessExpiresAt: s.record.accessExpiresAt, customToken: await auth.createCustomToken(s.record.uid, { sid: s.sid, security_epoch: s.record.epoch }) };
}
async function login(rawToken, input, meta) {
  const token = await primary(rawToken), uid = token.uid, challengeId = opaque(), now = Date.now(), claimId = digest(`${uid}:${token.auth_time}`), providerUser = await availableUser(uid);
  meta = { ...meta, providerValidAfter: providerUser.tokensValidAfterTime ?? "" };
  await securityActorBudget(uid);
  let created = null;
  const result = await db.runTransaction(async (tx) => {
    const [p, used] = await Promise.all([tx.get(profileRef(uid)), tx.get(doc("orinSecurityPrimaryClaims", claimId))]);
    const profile = data(p);
    let trusted = null, trustRef = null;
    if (input.trustedDevice?.id && input.trustedDevice?.deviceToken) {
      trustRef = doc("orinTrustedDevices", identifier(input.trustedDevice.id));
      const td = await tx.get(doc("orinTrustedDevices", identifier(input.trustedDevice.id))), v = td.data();
      if (v && v.uid === uid && !v.revokedAt && v.expiresAt > now && v.epoch === profile.epoch && equal(v.tokenHash, digest(identifier(input.trustedDevice.deviceToken)))) trusted = { id: td.id, ...v };
    }
    if (used.exists) throw new SecurityError("\u0623\u0639\u062F \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644\u061B \u0633\u0628\u0642 \u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u062F\u062E\u0648\u0644 \u0647\u0630\u0627.", 401);
    tx.create(doc("orinSecurityPrimaryClaims", claimId), { uid, createdAt: now, expiresAt: now + SESSION_LIFE });
    if (!p.exists) tx.set(profileRef(uid), defaults);
    if (profile.totpEnabled && !trusted) {
      tx.create(doc("orinSecurityChallenges", challengeId), { uid, kind: "login", createdAt: now, expiresAt: now + CHALLENGE_LIFE, consumed: false, meta: { ip: meta.ip, device: safeDevice(input.device) }, epoch: profile.epoch, providerValidAfter: meta.providerValidAfter, primaryAuthTime: token.auth_time });
      return { challengeId, requiresSecondFactor: true, methods: ["totp", "recovery"] };
    }
    created = sessionRecord(uid, profile.epoch, { ...meta, device: input.device });
    if (trusted) {
      Object.assign(created.record, { trustedDeviceId: trusted.id });
      tx.update(trustRef, { lastUsedAt: now, sessionId: created.sid });
    }
    tx.create(sessionRef(created.sid), created.record);
    audit(tx, uid, "LOGIN_SUCCESS", created.sid, meta.ip, { factor: trusted ? "trusted_device_and_primary" : "primary" });
    if (!trusted) audit(tx, uid, "UNRECOGNIZED_DEVICE", created.sid, meta.ip);
    return null;
  });
  return created ? bundle(created) : result;
}
async function completeLogin(input, meta) {
  const challengeId = identifier(input.challengeId), now = Date.now(), preChallenge = (await doc("orinSecurityChallenges", identifier(input.challengeId)).get()).data();
  if (!preChallenge?.uid) throw new SecurityError("\u0627\u0646\u062A\u0647\u0649 \u0637\u0644\u0628 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644.", 401);
  const providerUser = await availableUser(preChallenge.uid);
  meta = { ...meta, providerValidAfter: providerUser.tokensValidAfterTime ?? "" };
  let created = null;
  const ok = await db.runTransaction(async (tx) => {
    const challenge = await tx.get(doc("orinSecurityChallenges", challengeId)), c = challenge.data();
    if (!c || c.kind !== "login" || c.consumed || c.expiresAt <= now) throw new SecurityError("\u0627\u0646\u062A\u0647\u0649 \u0637\u0644\u0628 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644.", 401);
    const p = await tx.get(profileRef(c.uid)), profile = data(p);
    if (c.providerValidAfter !== meta.providerValidAfter) throw new SecurityError("\u0623\u064F\u0628\u0637\u0644 \u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u062F\u062E\u0648\u0644. \u0633\u062C\u0651\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0645\u062C\u062F\u062F\u064B\u0627.", 401, "recent-auth-required");
    if (c.epoch !== profile.epoch) throw new SecurityError("\u062A\u0645 \u0625\u0628\u0637\u0627\u0644 \u0637\u0644\u0628 \u0627\u0644\u062F\u062E\u0648\u0644.", 401);
    const f = factor(profile, input, c.uid, now);
    tx.set(profileRef(c.uid), f.patch, { merge: true });
    if (!f.ok) {
      audit(tx, c.uid, "LOGIN_FAILED", null, meta.ip, { reason: "second_factor" });
      return false;
    }
    created = sessionRecord(c.uid, profile.epoch, { ...meta, device: c.meta.device });
    tx.update(challenge.ref, { consumed: true });
    tx.create(sessionRef(created.sid), created.record);
    audit(tx, c.uid, "LOGIN_SUCCESS", created.sid, meta.ip, { factor: input.recoveryCode ? "recovery" : "totp" });
    audit(tx, c.uid, "UNRECOGNIZED_DEVICE", created.sid, meta.ip);
    return true;
  });
  if (!ok || !created) throw new SecurityError("\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D \u0623\u0648 \u0633\u0628\u0642 \u0627\u0633\u062A\u062E\u062F\u0627\u0645\u0647.", 401, "invalid-otp");
  await availableUser(created.record.uid);
  return bundle(created);
}
async function refresh(input) {
  const sid = identifier(input.sessionId), token = identifier(input.refreshToken), now = Date.now(), accessToken = opaque(), refreshToken = opaque();
  let record;
  const ok = await db.runTransaction(async (tx) => {
    const s = await tx.get(sessionRef(sid)), v = s.data();
    if (!v) throw new SecurityError("\u0627\u0644\u062C\u0644\u0633\u0629 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629.", 401, "invalid-session");
    const p = await tx.get(profileRef(v.uid));
    if (v.status !== "active" || v.expiresAtMs <= now || v.epoch !== data(p).epoch) throw new SecurityError("\u062A\u0645 \u0625\u0628\u0637\u0627\u0644 \u0627\u0644\u062C\u0644\u0633\u0629.", 401, "session-revoked");
    if (!equal(v.refreshHash, digest(token))) {
      if (v.previousRefreshHash && equal(v.previousRefreshHash, digest(token))) {
        tx.update(s.ref, { status: "revoked", revokedAt: now });
        audit(tx, v.uid, "SESSION_REVOKED", sid, null, { reason: "refresh_replay" });
      }
      return false;
    }
    record = { ...v, previousAccessHash: v.accessHash, previousAccessUntil: Math.min(v.accessExpiresAt, now + 3e4), accessHash: digest(accessToken), accessExpiresAt: now + ACCESS_LIFE, refreshHash: digest(refreshToken), previousRefreshHash: v.refreshHash, lastActiveAt: now };
    tx.set(s.ref, record);
    return true;
  });
  if (!ok) throw new SecurityError("\u0627\u0639\u062A\u0645\u0627\u062F \u062A\u062C\u062F\u064A\u062F \u0627\u0644\u062C\u0644\u0633\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.", 401, "session-revoked");
  const providerUser = await availableUser(record.uid);
  if ((providerUser.tokensValidAfterTime ?? "") !== (record.providerValidAfter ?? "")) {
    await sessionRef(sid).update({ status: "revoked", revokedAt: now });
    throw new SecurityError("\u0623\u064F\u0628\u0637\u0644\u062A \u0627\u0644\u062C\u0644\u0633\u0629 \u0644\u062F\u0649 \u0645\u0648\u0641\u0651\u0631 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644.", 401, "session-revoked");
  }
  return bundle({ sid, accessToken, refreshToken, record });
}
function identifier(v) {
  if (typeof v !== "string" || !/^[\w-]{43}$/.test(v)) throw new SecurityError("\u0645\u0639\u0631\u0651\u0641 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.");
  return v;
}
async function assertSessionTx(tx, c) {
  const [s, p] = await Promise.all([tx.get(sessionRef(c.sid)), tx.get(profileRef(c.uid))]);
  const v = s.data();
  if (!v || v.uid !== c.uid || v.status !== "active" || v.expiresAtMs <= Date.now() || v.epoch !== data(p).epoch) throw new SecurityError("\u062A\u0645 \u0625\u0628\u0637\u0627\u0644 \u0627\u0644\u062C\u0644\u0633\u0629.", 401, "session-revoked");
  return data(p);
}
async function all(c, uid) {
  return (await db.collection(c).where("uid", "==", uid).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
}
async function state(c) {
  const [p, sessions, keys, trusted, events] = await Promise.all([profileRef(c.uid).get(), all("orinSecuritySessions", c.uid), all("orinSecurityPasskeys", c.uid), all("orinTrustedDevices", c.uid), all("orinSecurityEvents", c.uid)]), v = data(p), now = Date.now();
  return { available: true, totp: { enabled: v.totpEnabled === true }, recoveryCodes: { remaining: v.recoveryHashes?.length ?? 0 }, sessions: sessions.filter((s) => s.status === "active" && s.expiresAtMs > now && s.epoch === v.epoch).map((s) => ({ id: s.id, device: s.device, createdAt: s.createdAt, lastActiveAt: s.lastActiveAt, expiresAt: s.expiresAtMs, ip: s.ip, ipSource: s.ipSource ?? "unavailable", approximateLocation: null, current: s.id === c.sid, status: "active" })), passkeys: keys.filter((k) => !k.revokedAt).map((k) => ({ id: k.id, name: k.name, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt ?? null })), trustedDevices: trusted.filter((t) => !t.revokedAt && t.expiresAt > now && t.epoch === v.epoch).map((t) => ({ id: t.id, name: t.name, createdAt: t.createdAt, lastUsedAt: t.lastUsedAt, current: t.sessionId === c.sid })), events: events.sort((a, b) => b.createdAt - a.createdAt).slice(0, 100).map(({ id, action, createdAt, sessionId, ip, details }) => ({ id, action, createdAt, sessionId, ip, details })), capabilities: { passkeys: !!process.env.ORIN_WEBAUTHN_RP_ID, geoIP: false } };
}
async function revoke(c, target) {
  const rows = target === "others" ? (await all("orinSecuritySessions", c.uid)).filter((s) => s.id !== c.sid && s.status === "active") : [{ id: identifier(target) }];
  for (const row of rows) await db.runTransaction(async (tx) => {
    const s = await tx.get(sessionRef(row.id));
    if (s.data()?.uid !== c.uid) throw new SecurityError("\u0627\u0644\u062C\u0644\u0633\u0629 \u0644\u0627 \u062A\u062E\u0635 \u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628.", 403);
    tx.update(s.ref, { status: "revoked", revokedAt: Date.now() });
    audit(tx, c.uid, "SESSION_REVOKED", c.sid, c.ip, { target: row.id });
  });
  return { ok: true };
}
async function stepUp(c, input) {
  const action = actionName(input.action), now = Date.now(), stepUpToken = opaque();
  let primaryVerified = false;
  if (input.freshFirebaseToken) {
    await primary(input.freshFirebaseToken, c.uid);
    primaryVerified = true;
  }
  const ok = await db.runTransaction(async (tx) => {
    await assertSessionTx(tx, c);
    const p = await tx.get(profileRef(c.uid)), v = data(p);
    let ok2 = primaryVerified, patch = {};
    if (v.totpEnabled) {
      const f = factor(v, input, c.uid, now);
      ok2 = f.ok;
      patch = f.patch;
    }
    if (Object.keys(patch).length) tx.set(p.ref, patch, { merge: true });
    if (!ok2) {
      audit(tx, c.uid, "STEP_UP_FAILED", c.sid, c.ip, { action });
      return false;
    }
    tx.create(doc("orinSecurityGrants", digest(stepUpToken)), { uid: c.uid, sid: c.sid, epoch: v.epoch, factorVersion: v.factorVersion, action, expiresAt: now + STEPUP_LIFE, consumed: false });
    return true;
  });
  if (!ok) throw new SecurityError("\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u062A\u062D\u0642\u0642 \u0627\u0644\u0623\u0645\u0646\u064A \u0645\u0637\u0644\u0648\u0628\u0629.", 401, "recent-auth-required");
  return { stepUpToken, expiresAt: now + STEPUP_LIFE };
}
async function consumeSecurityGrant(tx, c, token, action) {
  identifier(token);
  const g = await tx.get(doc("orinSecurityGrants", digest(token))), v = g.data();
  const [p, s] = await Promise.all([tx.get(profileRef(c.uid)), tx.get(sessionRef(c.sid))]);
  if (s.data()?.uid !== c.uid || s.data()?.status !== "active" || s.data().expiresAtMs <= Date.now() || s.data()?.epoch !== data(p).epoch) throw new SecurityError("\u062A\u0645 \u0625\u0628\u0637\u0627\u0644 \u0627\u0644\u062C\u0644\u0633\u0629.", 401, "session-revoked");
  if (!v || v.uid !== c.uid || v.sid !== c.sid || v.action !== action || v.epoch !== data(p).epoch || (v.factorVersion ?? 0) !== data(p).factorVersion || v.consumed || v.expiresAt <= Date.now()) throw new SecurityError("\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0637\u0644\u0648\u0628\u0629 \u0644\u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621.", 403);
  return () => tx.update(g.ref, { consumed: true, consumedAt: Date.now() });
}
async function requireSecurityStepUp(token, grant, action) {
  await enforceSecuritySession(token);
  await db.runTransaction(async (tx) => {
    const consume = await consumeSecurityGrant(tx, { uid: token.uid, sid: String(token.sid) }, grant, action);
    consume();
  });
}
async function enrollTotp(c, input) {
  const enrollmentId = opaque(), secret = newTotpSecret(), now = Date.now(), ciphertext = seal(secret, key(), c.uid);
  await db.runTransaction(async (tx) => {
    const p = await tx.get(profileRef(c.uid));
    if (data(p).totpEnabled) throw new SecurityError("\u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629 \u0627\u0644\u062B\u0646\u0627\u0626\u064A\u0629 \u0645\u0641\u0639\u0651\u0644\u0629 \u0628\u0627\u0644\u0641\u0639\u0644.", 409);
    const consume = await consumeSecurityGrant(tx, c, input.stepUpToken, "totp.enroll");
    consume();
    tx.set(doc("orinTotpEnrollments", c.uid), { uid: c.uid, sid: c.sid, enrollmentId, ciphertext, expiresAt: now + CHALLENGE_LIFE, attempts: 0 });
  });
  return { enrollmentId, secret, otpauthUri: `otpauth://totp/ORIN:${encodeURIComponent(c.token.email ?? c.uid)}?secret=${secret}&issuer=ORIN&algorithm=SHA1&digits=6&period=30` };
}
async function verifyEnrollment(c, input) {
  const enrollmentId = identifier(input.enrollmentId), now = Date.now(), codes = newRecoveryCodes();
  const ok = await db.runTransaction(async (tx) => {
    await assertSessionTx(tx, c);
    const [e, p] = await Promise.all([tx.get(doc("orinTotpEnrollments", c.uid)), tx.get(profileRef(c.uid))]), v = e.data(), profile = data(p);
    const sessions = await tx.get(db.collection("orinSecuritySessions").where("uid", "==", c.uid)), trusted = await tx.get(db.collection("orinTrustedDevices").where("uid", "==", c.uid));
    if (!v || v.sid !== c.sid || v.enrollmentId !== enrollmentId || v.expiresAt <= now || v.attempts >= 5 || profile.totpEnabled) throw new SecurityError("\u0627\u0646\u062A\u0647\u0649 \u0637\u0644\u0628 \u0627\u0644\u062A\u0641\u0639\u064A\u0644. \u0627\u0628\u062F\u0623 \u0645\u0646 \u062C\u062F\u064A\u062F.", 409);
    const step = verifyTotp(unseal(v.ciphertext, key(), c.uid), String(input.otp ?? ""), now);
    if (step === null) {
      tx.update(e.ref, { attempts: v.attempts + 1 });
      audit(tx, c.uid, "TOTP_ENROLLMENT_FAILED", c.sid, c.ip);
      return false;
    }
    tx.set(p.ref, { totpEnabled: true, factorVersion: profile.factorVersion + 1, totpCiphertext: v.ciphertext, lastTotpStep: step, recoveryHashes: codes.map(recoveryHash), failures: 0, blockedUntil: 0, totpEnabledAt: now }, { merge: true });
    tx.delete(e.ref);
    trusted.docs.forEach((t) => tx.update(t.ref, { revokedAt: now }));
    sessions.docs.filter((s) => s.id !== c.sid && s.data().status === "active").forEach((s) => tx.update(s.ref, { status: "revoked", revokedAt: now }));
    audit(tx, c.uid, "TOTP_ENABLED", c.sid, c.ip);
    audit(tx, c.uid, "RECOVERY_CODES_CREATED", c.sid, c.ip, { count: codes.length });
    return true;
  });
  if (!ok) throw new SecurityError("\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D.", 400, "invalid-otp");
  return { ok: true, recoveryCodes: codes };
}
async function disableTotp(c, input) {
  await db.runTransaction(async (tx) => {
    const profile = data(await tx.get(profileRef(c.uid)));
    const consume = await consumeSecurityGrant(tx, c, input.stepUpToken, "totp.disable");
    const rows = await tx.get(db.collection("orinTrustedDevices").where("uid", "==", c.uid));
    consume();
    tx.set(profileRef(c.uid), { totpEnabled: false, factorVersion: profile.factorVersion + 1, totpCiphertext: null, recoveryHashes: [], lastTotpStep: -1 }, { merge: true });
    rows.docs.forEach((d) => tx.update(d.ref, { revokedAt: Date.now() }));
    audit(tx, c.uid, "TOTP_DISABLED", c.sid, c.ip);
  });
  return { ok: true };
}
async function regenerateRecovery(c, input) {
  const codes = newRecoveryCodes();
  await db.runTransaction(async (tx) => {
    const p = await tx.get(profileRef(c.uid));
    if (!data(p).totpEnabled) throw new SecurityError("\u0641\u0639\u0651\u0644 \u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629 \u0627\u0644\u062B\u0646\u0627\u0626\u064A\u0629 \u0623\u0648\u0644\u064B\u0627.", 409);
    const consume = await consumeSecurityGrant(tx, c, input.stepUpToken, "recovery.regenerate");
    consume();
    tx.set(p.ref, { recoveryHashes: codes.map(recoveryHash) }, { merge: true });
    audit(tx, c.uid, "RECOVERY_CODES_CREATED", c.sid, c.ip, { count: codes.length });
  });
  return { recoveryCodes: codes };
}
async function addTrusted(c, input) {
  const id = opaque(), deviceToken = opaque(), now = Date.now();
  await db.runTransaction(async (tx) => {
    const consume = await consumeSecurityGrant(tx, c, input.stepUpToken, "trusted.add");
    consume();
    tx.create(doc("orinTrustedDevices", id), { uid: c.uid, sessionId: c.sid, name: safeDevice({ label: input.name ?? c.session.device.label }).label, tokenHash: digest(deviceToken), createdAt: now, lastUsedAt: now, expiresAt: now + SESSION_LIFE, epoch: c.session.epoch, revokedAt: null });
    audit(tx, c.uid, "TRUSTED_DEVICE_ADDED", c.sid, c.ip, { deviceId: id });
  });
  return { id, deviceToken, expiresAt: now + SESSION_LIFE };
}
async function proveTrusted(c, input) {
  const id = identifier(input.id), proof = identifier(input.deviceToken);
  await db.runTransaction(async (tx) => {
    const d = await tx.get(doc("orinTrustedDevices", id)), v = d.data();
    if (!v || v.uid !== c.uid || v.revokedAt || v.expiresAt <= Date.now() || v.epoch !== c.session.epoch || !equal(v.tokenHash, digest(proof))) throw new SecurityError("\u0647\u0630\u0627 \u0627\u0644\u062C\u0647\u0627\u0632 \u063A\u064A\u0631 \u0645\u0648\u062B\u0648\u0642. \u064A\u0644\u0632\u0645 \u0627\u0644\u062A\u062D\u0642\u0642 \u0627\u0644\u0623\u0645\u0646\u064A.", 403);
    tx.update(d.ref, { lastUsedAt: Date.now(), sessionId: c.sid });
  });
  return { trusted: true };
}
async function deleteTrusted(c, input) {
  const id = identifier(input.id);
  await db.runTransaction(async (tx) => {
    const d = await tx.get(doc("orinTrustedDevices", id));
    if (d.data()?.uid !== c.uid) throw new SecurityError("\u0627\u0644\u062C\u0647\u0627\u0632 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.", 404);
    const consume = await consumeSecurityGrant(tx, c, input.stepUpToken, "trusted.delete");
    const sessions = await tx.get(db.collection("orinSecuritySessions").where("uid", "==", c.uid));
    consume();
    tx.update(d.ref, { revokedAt: Date.now() });
    sessions.docs.filter((s) => s.data().trustedDeviceId === id).forEach((s) => tx.update(s.ref, { status: "revoked", revokedAt: Date.now() }));
    audit(tx, c.uid, "TRUSTED_DEVICE_REMOVED", c.sid, c.ip, { deviceId: id });
  });
  return { ok: true };
}
async function changePassword(c, input) {
  if (typeof input.password !== "string" || input.password.length < 12 || input.password.length > 128) throw new SecurityError("\u0627\u0633\u062A\u062E\u062F\u0645 \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0645\u0646 12 \u0625\u0644\u0649 128 \u062D\u0631\u0641\u064B\u0627.");
  await db.runTransaction(async (tx) => {
    const consume = await consumeSecurityGrant(tx, c, input.stepUpToken, "password.change");
    consume();
  });
  await auth.updateUser(c.uid, { password: input.password });
  await auth.revokeRefreshTokens(c.uid);
  await db.runTransaction(async (tx) => {
    const p = await tx.get(profileRef(c.uid));
    tx.set(p.ref, { epoch: data(p).epoch + 1 }, { merge: true });
    audit(tx, c.uid, "PASSWORD_CHANGED", c.sid, c.ip);
  });
  return { ok: true, requiresLogin: true };
}
var rp = () => {
  const rpID = process.env.ORIN_WEBAUTHN_RP_ID, origin = process.env.ORIN_WEBAUTHN_ORIGIN;
  if (!rpID || !origin || new URL(origin).protocol !== "https:" || new URL(origin).hostname !== rpID) throw new SecurityError("\u0644\u0645 \u064A\u064F\u0636\u0628\u0637 \u0646\u0637\u0627\u0642 \u0645\u0641\u0627\u062A\u064A\u062D \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u0622\u0645\u0646 \u0628\u0639\u062F.", 503);
  return { rpID, origin };
};
async function passkeyOptions(c, input) {
  const { rpID, origin } = rp(), keys = await all("orinSecurityPasskeys", c.uid), challengeId = opaque(), now = Date.now();
  const options = await generateRegistrationOptions({ rpName: "ORIN", rpID, userID: new Uint8Array(Buffer.from(digest(c.uid), "hex")), userName: c.token.email ?? c.uid, attestationType: "none", excludeCredentials: keys.filter((k) => !k.revokedAt).map((k) => ({ id: k.credentialId })), authenticatorSelection: { residentKey: "required", userVerification: "required" }, supportedAlgorithmIDs: [-7, -257] });
  await db.runTransaction(async (tx) => {
    const factorVersion = data(await tx.get(profileRef(c.uid))).factorVersion;
    const consume = await consumeSecurityGrant(tx, c, input.stepUpToken, "passkey.add");
    consume();
    tx.create(doc("orinSecurityChallenges", challengeId), { uid: c.uid, sid: c.sid, kind: "register", challenge: options.challenge, origin, rpID, expiresAt: now + CHALLENGE_LIFE, consumed: false, name: safeDevice({ label: input.name || "Passkey" }).label, epoch: c.session.epoch, factorVersion });
  });
  return { challengeId, options };
}
async function consumeChallenge(c, id, kind) {
  return db.runTransaction(async (tx) => {
    const profile = await assertSessionTx(tx, c);
    const d = await tx.get(doc("orinSecurityChallenges", identifier(id))), v = d.data();
    if (!v || v.uid !== c.uid || v.sid !== c.sid || v.kind !== kind || v.epoch !== c.session.epoch || (v.factorVersion ?? 0) !== profile.factorVersion || v.consumed || v.expiresAt <= Date.now()) throw new SecurityError("\u0627\u0646\u062A\u0647\u0649 \u0627\u0644\u062A\u062D\u0642\u0642 \u0627\u0644\u0623\u0645\u0646\u064A. \u0627\u0628\u062F\u0623 \u0645\u0646 \u062C\u062F\u064A\u062F.", 401);
    tx.update(d.ref, { consumed: true });
    return v;
  });
}
async function verifyPasskey(c, input) {
  const challenge = await consumeChallenge(c, input.challengeId, "register");
  let result;
  try {
    result = await verifyRegistrationResponse({ response: input.response, expectedChallenge: challenge.challenge, expectedOrigin: challenge.origin, expectedRPID: challenge.rpID, requireUserVerification: true, supportedAlgorithmIDs: [-7, -257] });
  } catch {
    throw new SecurityError("\u062A\u0639\u0630\u0631 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0645\u0641\u062A\u0627\u062D \u0627\u0644\u0645\u0631\u0648\u0631.", 400);
  }
  if (!result.verified || !result.registrationInfo) throw new SecurityError("\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0645\u0641\u062A\u0627\u062D \u0627\u0644\u0645\u0631\u0648\u0631.", 400);
  const info = result.registrationInfo, credential = info.credential, id = digest(credential.id), now = Date.now();
  await db.runTransaction(async (tx) => {
    const profile = await assertSessionTx(tx, c);
    if ((challenge.factorVersion ?? 0) !== profile.factorVersion) throw new SecurityError("\u062A\u063A\u064A\u0631\u062A \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0623\u0645\u0627\u0646. \u0623\u0639\u062F \u0627\u0644\u062A\u062D\u0642\u0642.", 409);
    const existing = await tx.get(doc("orinSecurityPasskeys", id));
    if (existing.exists) throw new SecurityError("\u0645\u0641\u062A\u0627\u062D \u0627\u0644\u0645\u0631\u0648\u0631 \u0645\u0633\u062C\u0644 \u0645\u0633\u0628\u0642\u064B\u0627.", 409);
    tx.create(existing.ref, { uid: c.uid, credentialId: credential.id, publicKey: Buffer.from(credential.publicKey).toString("base64url"), counter: credential.counter, transports: credential.transports ?? [], name: challenge.name, createdAt: now, lastUsedAt: null, revokedAt: null });
    audit(tx, c.uid, "PASSKEY_ADDED", c.sid, c.ip, { passkeyId: id });
  });
  return { ok: true, id };
}
async function deletePasskey(c, input) {
  const id = String(input.id ?? "");
  if (!/^[a-f0-9]{64}$/.test(id)) throw new SecurityError("\u0645\u0639\u0631\u0651\u0641 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.");
  await db.runTransaction(async (tx) => {
    const d = await tx.get(doc("orinSecurityPasskeys", id));
    if (d.data()?.uid !== c.uid) throw new SecurityError("\u0627\u0644\u0645\u0641\u062A\u0627\u062D \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.", 404);
    const consume = await consumeSecurityGrant(tx, c, input.stepUpToken, "passkey.delete");
    consume();
    tx.update(d.ref, { revokedAt: Date.now() });
    audit(tx, c.uid, "PASSKEY_REMOVED", c.sid, c.ip, { passkeyId: id });
  });
  return { ok: true };
}
async function passkeyAuthOptions(c, input) {
  const factorVersion = data(await profileRef(c.uid).get()).factorVersion;
  const { rpID, origin } = rp(), action = actionName(input.action), keys = (await all("orinSecurityPasskeys", c.uid)).filter((k) => !k.revokedAt);
  if (!keys.length) throw new SecurityError("\u0644\u0627 \u062A\u0648\u062C\u062F \u0645\u0641\u0627\u062A\u064A\u062D \u0645\u0631\u0648\u0631 \u0645\u0633\u062C\u0644\u0629.", 409);
  const options = await generateAuthenticationOptions({ rpID, userVerification: "required", allowCredentials: keys.map((k) => ({ id: k.credentialId, transports: k.transports })) }), challengeId = opaque();
  await doc("orinSecurityChallenges", challengeId).create({ uid: c.uid, sid: c.sid, kind: "authenticate", factorVersion, action, challenge: options.challenge, origin, rpID, expiresAt: Date.now() + CHALLENGE_LIFE, consumed: false, epoch: c.session.epoch });
  return { challengeId, options };
}
async function verifyPasskeyAuth(c, input) {
  const challenge = await consumeChallenge(c, input.challengeId, "authenticate"), id = digest(String(input.response?.id ?? "")), d = await doc("orinSecurityPasskeys", id).get(), v = d.data();
  if (!v || v.uid !== c.uid || v.revokedAt) throw new SecurityError("\u0645\u0641\u062A\u0627\u062D \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.", 403);
  let result;
  try {
    result = await verifyAuthenticationResponse({ response: input.response, expectedChallenge: challenge.challenge, expectedOrigin: challenge.origin, expectedRPID: challenge.rpID, credential: { id: v.credentialId, publicKey: Buffer.from(v.publicKey, "base64url"), counter: v.counter, transports: v.transports }, requireUserVerification: true });
  } catch {
    throw new SecurityError("\u062A\u0639\u0630\u0631 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0645\u0641\u062A\u0627\u062D \u0627\u0644\u0645\u0631\u0648\u0631.", 401);
  }
  if (!result.verified) throw new SecurityError("\u0641\u0634\u0644 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0645\u0641\u062A\u0627\u062D.", 401);
  const stepUpToken = opaque(), now = Date.now();
  await db.runTransaction(async (tx) => {
    const profile = await assertSessionTx(tx, c);
    const fresh = await tx.get(d.ref);
    if (fresh.data()?.revokedAt || fresh.data()?.counter !== v.counter) throw new SecurityError("\u062A\u063A\u064A\u0631 \u0645\u0641\u062A\u0627\u062D \u0627\u0644\u0645\u0631\u0648\u0631. \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.", 409);
    tx.update(d.ref, { counter: result.authenticationInfo.newCounter, lastUsedAt: now });
    tx.create(doc("orinSecurityGrants", digest(stepUpToken)), { uid: c.uid, sid: c.sid, epoch: c.session.epoch, factorVersion: profile.factorVersion, action: challenge.action, expiresAt: now + STEPUP_LIFE, consumed: false });
  });
  return { stepUpToken, expiresAt: now + STEPUP_LIFE };
}
async function passkeyLoginOptions(meta) {
  const { rpID, origin } = rp(), challengeId = opaque(), options = await generateAuthenticationOptions({ rpID, userVerification: "required" });
  await doc("orinSecurityChallenges", challengeId).create({ kind: "passkey-login", challenge: options.challenge, origin, rpID, expiresAt: Date.now() + CHALLENGE_LIFE, consumed: false });
  return { challengeId, options };
}
async function passkeyLoginVerify(input, meta) {
  const challenge = await db.runTransaction(async (tx) => {
    const d2 = await tx.get(doc("orinSecurityChallenges", identifier(input.challengeId))), v2 = d2.data();
    if (!v2 || v2.kind !== "passkey-login" || v2.consumed || v2.expiresAt <= Date.now()) throw new SecurityError("\u0627\u0646\u062A\u0647\u0649 \u0637\u0644\u0628 \u0627\u0644\u062F\u062E\u0648\u0644.", 401);
    tx.update(d2.ref, { consumed: true });
    return v2;
  });
  const id = digest(String(input.response?.id ?? "")), d = await doc("orinSecurityPasskeys", id).get(), v = d.data();
  if (!v || v.revokedAt) throw new SecurityError("\u0645\u0641\u062A\u0627\u062D \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.", 401);
  const providerUser = await availableUser(v.uid);
  meta = { ...meta, providerValidAfter: providerUser.tokensValidAfterTime ?? "" };
  let result;
  try {
    result = await verifyAuthenticationResponse({ response: input.response, expectedChallenge: challenge.challenge, expectedOrigin: challenge.origin, expectedRPID: challenge.rpID, credential: { id: v.credentialId, publicKey: Buffer.from(v.publicKey, "base64url"), counter: v.counter, transports: v.transports }, requireUserVerification: true });
  } catch {
    await db.runTransaction(async (tx) => {
      audit(tx, v.uid, "LOGIN_FAILED", null, meta.ip, { reason: "passkey" });
    });
    throw new SecurityError("\u062A\u0639\u0630\u0631 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0645\u0641\u062A\u0627\u062D \u0627\u0644\u0645\u0631\u0648\u0631.", 401);
  }
  if (!result.verified) throw new SecurityError("\u0645\u0641\u062A\u0627\u062D \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.", 401);
  let created = null;
  await db.runTransaction(async (tx) => {
    const [f, p] = await Promise.all([tx.get(d.ref), tx.get(profileRef(v.uid))]);
    if (f.data()?.revokedAt || f.data()?.counter !== v.counter) throw new SecurityError("\u062A\u063A\u064A\u0631 \u0627\u0644\u0645\u0641\u062A\u0627\u062D. \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.", 409);
    created = sessionRecord(v.uid, data(p).epoch, { ...meta, device: input.device });
    tx.update(d.ref, { counter: result.authenticationInfo.newCounter, lastUsedAt: Date.now() });
    tx.create(sessionRef(created.sid), created.record);
    audit(tx, v.uid, "LOGIN_SUCCESS", created.sid, meta.ip, { factor: "passkey" });
  });
  return bundle(created);
}
async function securityRequestBudget(ip) {
  if (!ip) return;
  return securityBudget("ip:" + ip, 300);
}
async function securityActorBudget(uid) {
  return securityBudget("uid:" + uid, 60);
}
async function securityBudget(scope, limit) {
  const now = Date.now(), id = digest(scope);
  await db.runTransaction(async (tx) => {
    const d = await tx.get(doc("orinSecurityRateLimits", id)), v = d.data(), reset = now - (v?.windowStart ?? 0) >= 6e4;
    if (!reset && (v?.count ?? 0) >= limit) throw new SecurityError("\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0643\u062B\u064A\u0631\u0629. \u062D\u0627\u0648\u0644 \u0628\u0639\u062F \u062F\u0642\u064A\u0642\u0629.", 429);
    tx.set(d.ref, { windowStart: reset ? now : v.windowStart, count: reset ? 1 : v.count + 1, expiresAt: now + 6e4 });
  });
}
export {
  SecurityError,
  addTrusted,
  changePassword,
  completeLogin,
  consumeSecurityGrant,
  context,
  deletePasskey,
  deleteTrusted,
  disableTotp,
  enforceSecuritySession,
  enrollTotp,
  ensureSecurityActivation,
  identifier,
  login,
  passkeyAuthOptions,
  passkeyLoginOptions,
  passkeyLoginVerify,
  passkeyOptions,
  proveTrusted,
  refresh,
  regenerateRecovery,
  requireSecurityStepUp,
  revoke,
  securityActorBudget,
  securityAuth,
  securityDb,
  securityEnabled,
  securityRequestBudget,
  state,
  stepUp,
  verifyEnrollment,
  verifyPasskey,
  verifyPasskeyAuth
};
