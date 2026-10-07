// firebase-functions/src/store.ts
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createHash, randomUUID } from "node:crypto";

// lib/market-symbols.ts
var MARKET_SYMBOLS = [
  { pair: "BTC-USD", label: "BTC/USD", name: "Bitcoin", tv: "BITSTAMP:BTCUSD", category: "crypto" },
  { pair: "ETH-USD", label: "ETH/USD", name: "Ethereum", tv: "BITSTAMP:ETHUSD", category: "crypto" },
  { pair: "XRP-USD", label: "XRP/USD", name: "XRP", tv: "BITSTAMP:XRPUSD", category: "crypto" },
  { pair: "SOL-USD", label: "SOL/USD", name: "Solana", tv: "COINBASE:SOLUSD", category: "crypto" },
  { pair: "BNB-USDT", label: "BNB/USDT", name: "BNB", tv: "BINANCE:BNBUSDT", category: "crypto" },
  { pair: "DOGE-USD", label: "DOGE/USD", name: "Dogecoin", tv: "COINBASE:DOGEUSD", category: "crypto" },
  { pair: "TON-USDT", label: "TON/USDT", name: "Toncoin", tv: "OKX:TONUSDT", category: "crypto" },
  { pair: "ADA-USD", label: "ADA/USD", name: "Cardano", tv: "COINBASE:ADAUSD", category: "crypto" },
  { pair: "EUR-USD", label: "EUR/USD", name: "\u0627\u0644\u064A\u0648\u0631\u0648 / \u0627\u0644\u062F\u0648\u0644\u0627\u0631", tv: "FX:EURUSD", category: "forex" },
  { pair: "GBP-USD", label: "GBP/USD", name: "\u0627\u0644\u062C\u0646\u064A\u0647 / \u0627\u0644\u062F\u0648\u0644\u0627\u0631", tv: "FX:GBPUSD", category: "forex" },
  { pair: "XAU-USD", label: "XAU/USD", name: "\u0627\u0644\u0630\u0647\u0628 / \u0627\u0644\u062F\u0648\u0644\u0627\u0631", tv: "OANDA:XAUUSD", category: "metals" },
  { pair: "XAG-USD", label: "XAG/USD", name: "\u0627\u0644\u0641\u0636\u0629 / \u0627\u0644\u062F\u0648\u0644\u0627\u0631", tv: "OANDA:XAGUSD", category: "metals" },
  { pair: "SPX-USD", label: "S&P 500", name: "S&P 500", tv: "FOREXCOM:SPXUSD", category: "indices" },
  { pair: "NDX-USD", label: "Nasdaq 100", name: "Nasdaq 100", tv: "FOREXCOM:NSXUSD", category: "indices" }
];

// lib/preferences.ts
var TIMEFRAMES = ["1", "5", "15", "60", "240", "D"];
var CHART_TYPES = ["1", "2", "3"];
var INDICATORS = ["MA", "EMA", "RSI", "MACD", "BB"];
var NOTICE_EVENTS = ["opportunity", "contract_started", "contract_ended", "settlement", "deposit", "withdrawal", "referral", "agent", "support", "security", "announcement", "reminder"];
var CAPABILITIES = Object.freeze({ provider: "tradingview-widget", indicators: true, drawings: false, saveDrawings: false, priceAlerts: false, quoteTelemetry: false, inPlaceUpdates: false, crosshairControl: false, priceLineControl: false, push: false, email: false, sms: false, password: false, totp: false, passkeys: false, biometrics: false, recoveryCodes: false, sessionManagement: false });
var DEFAULT_CONFIGURATION = { defaultSymbol: "BTC-USD", enabledSymbols: MARKET_SYMBOLS.map((s) => s.pair), defaultTimeframe: "15", enabledTimeframes: [...TIMEFRAMES], defaultChartType: "1", enabledChartTypes: [...CHART_TYPES], allowedIndicators: [...INDICATORS], allowedDrawingTools: [], volume: false, gridDefault: true, crosshairDefault: true, fullscreen: true, alerts: false, favorites: true };
var DEFAULT_PREFERENCES = { hideBalance: false, notifications: true, reduceMotion: false, notificationSounds: false, opportunitySound: true, securitySound: true, vibration: false, marketingNotifications: false, chartLocale: "ar", theme: "light", fontSize: "normal", numberFormat: "latin", referenceCurrency: "USD", timezone: "Etc/UTC", chartPair: "BTC-USD", chartInterval: "15", chartStyle: "1", grid: true, crosshair: true, priceLine: true, saveDrawings: false, indicators: [], favorites: [], notificationEvents: Object.fromEntries(NOTICE_EVENTS.map((k) => [k, true])), notificationChannels: { push: false, email: false, sms: false } };

// firebase-functions/src/store.ts
var app = getApps()[0] ?? initializeApp();
var db = getFirestore(app);
var auth = getAuth(app);
var OWNER = "khtaub7341@gmail.com";
var ApiError = class extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
};
var hash = (text) => createHash("sha256").update(text).digest("hex");
var ref = (collection, key2) => db.collection(collection).doc(key2);
var owner = (u) => u.verified && u.email === OWNER;
function active(profile, u, admin = false) {
  if (!profile || profile.uid !== u.id || profile.email !== u.email || profile.disabled) throw new ApiError("\u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0627\u0644\u062D\u0633\u0627\u0628 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D.", 403);
  if (admin && !(u.verified && (profile.role === "admin" || owner(u)))) throw new ApiError("\u0647\u0630\u0647 \u0627\u0644\u0639\u0645\u0644\u064A\u0629 \u0644\u0644\u0625\u062F\u0627\u0631\u0629 \u0641\u0642\u0637.", 403);
  return profile;
}
async function check(tx, u, admin = false, financial = false) {
  const [p, access, revoked] = await Promise.all([tx.get(ref("users", u.id)), tx.get(ref("orinControlAccess", u.id)), tx.get(ref("orinControlSessionRevocations", u.id))]);
  const profile = active(p.data(), u);
  if (access.data()?.status === "suspended" || financial && access.data()?.status === "restricted") throw new ApiError("Account restricted", 403);
  if (revoked.exists && (!u.authTime || u.authTime * 1e3 <= revoked.data().validAfter)) throw new ApiError("Session revoked", 401);
  if (financial && (await tx.get(ref("orinControlConfiguration", "current"))).data()?.maintenance) throw new ApiError("Maintenance", 503);
  if (admin && (await tx.get(ref("system", "control-center"))).exists) {
    const staff = (await tx.get(ref("orinStaff", u.id))).data();
    if (!u.verified || staff?.status !== "active" || !staff.roles?.includes("super_admin") || staff.email !== u.email || staff.validAfter && (!u.authTime || u.authTime * 1e3 <= staff.validAfter)) throw new ApiError("Control Center authorization required", 403);
    return profile;
  }
  return active(profile, u, admin);
}
function audit(tx, key2, actor, action, reference, data, now) {
  const payload = JSON.stringify(data);
  tx.create(ref("orinAudit", key2), { id: key2, actor_id: actor, action, reference, payload, payload_hash: hash(payload), created_at: now });
}

// lib/control-center.ts
var PERMISSIONS = {
  "dashboard.read": "\u0644\u0648\u062D\u0629 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062A",
  "users.read": "\u0639\u0631\u0636 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646 \u0648\u0627\u0644\u0628\u062D\u062B",
  "users.manage": "\u062A\u0642\u064A\u064A\u062F \u0648\u0625\u0639\u0627\u062F\u0629 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646",
  "kyc.read": "\u0639\u0631\u0636 \u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0647\u0648\u064A\u0629",
  "kyc.documents": "\u0639\u0631\u0636 \u0648\u062B\u0627\u0626\u0642 \u0627\u0644\u0647\u0648\u064A\u0629 \u0627\u0644\u062E\u0627\u0635\u0629",
  "kyc.review": "\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0647\u0648\u064A\u0629",
  "accounts.read": "\u0639\u0631\u0636 \u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A",
  "accounts.manage": "\u0625\u0646\u0634\u0627\u0621 \u0648\u062A\u0639\u0644\u064A\u0642 \u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A",
  "wallet.read": "\u0639\u0631\u0636 \u0627\u0644\u0623\u0631\u0635\u062F\u0629 \u0627\u0644\u0645\u0641\u0635\u0651\u0644\u0629",
  "finance.read": "\u0639\u0631\u0636 \u0627\u0644\u0639\u0645\u0644\u064A\u0627\u062A \u0627\u0644\u0645\u0627\u0644\u064A\u0629",
  "finance.propose": "\u0627\u0642\u062A\u0631\u0627\u062D \u062A\u0633\u0648\u064A\u0629 \u0645\u0627\u0644\u064A\u0629",
  "finance.approve": "\u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0627\u0644\u0645\u0627\u0644\u064A\u0629 \u0627\u0644\u062B\u0627\u0646\u064A\u0629",
  "trading.read": "\u0639\u0631\u0636 \u0646\u0634\u0627\u0637 \u0627\u0644\u062A\u062F\u0627\u0648\u0644",
  "contracts.manage": "\u0625\u0646\u0634\u0627\u0621 \u0648\u0625\u064A\u0642\u0627\u0641 \u0623\u0643\u0648\u0627\u062F \u0627\u0644\u0639\u0642\u0648\u062F \u0627\u0644\u062F\u0627\u062E\u0644\u064A\u0629",
  "markets.manage": "\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0623\u0633\u0648\u0627\u0642 \u0648\u0627\u0644\u062A\u062F\u0627\u0648\u0644",
  "programs.read": "\u0639\u0631\u0636 \u0627\u0644\u0628\u0631\u0627\u0645\u062C \u0648\u0627\u0644\u0645\u0643\u0627\u0641\u0622\u062A",
  "programs.configure": "\u0625\u0635\u062F\u0627\u0631 \u0634\u0631\u0648\u0637 \u0627\u0644\u0628\u0631\u0627\u0645\u062C",
  "referrals.review": "\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0625\u062D\u0627\u0644\u0627\u062A",
  "agencies.manage": "\u0627\u0639\u062A\u0645\u0627\u062F \u0648\u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u0648\u0643\u0644\u0627\u0621",
  "badges.grant": "\u0645\u0646\u062D \u0627\u0644\u0634\u0627\u0631\u0627\u062A \u0627\u0644\u0645\u0648\u062B\u0642",
  "notifications.manage": "\u062A\u062D\u0631\u064A\u0631 \u0648\u062C\u062F\u0648\u0644\u0629 \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062A",
  "content.manage": "\u062A\u062D\u0631\u064A\u0631 \u0648\u0645\u0639\u0627\u064A\u0646\u0629 \u0627\u0644\u0645\u062D\u062A\u0648\u0649",
  "content.publish": "\u0646\u0634\u0631 \u0627\u0644\u0645\u062D\u062A\u0648\u0649",
  "configuration.manage": "\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u062A\u0634\u063A\u064A\u0644 \u0648\u0627\u0644\u0635\u064A\u0627\u0646\u0629",
  "security.read": "\u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0623\u062D\u062F\u0627\u062B \u0627\u0644\u0623\u0645\u0646\u064A\u0629",
  "security.revoke": "\u0625\u0628\u0637\u0627\u0644 \u062C\u0644\u0633\u0627\u062A \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645",
  "staff.manage": "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646 \u0648\u0627\u0644\u0623\u062F\u0648\u0627\u0631",
  "audit.read": "\u0642\u0631\u0627\u0621\u0629 \u0633\u062C\u0644 \u0627\u0644\u062A\u062F\u0642\u064A\u0642",
  "reports.export": "\u062A\u0635\u062F\u064A\u0631 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0633\u0645\u0648\u062D \u0628\u0647\u0627",
  "tickets.read": "\u0639\u0631\u0636 \u062A\u0630\u0627\u0643\u0631 \u0627\u0644\u062F\u0639\u0645",
  "tickets.manage": "\u0625\u0646\u0634\u0627\u0621 \u0648\u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0644\u062A\u0630\u0627\u0643\u0631 \u0648\u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A",
  "tickets.assign": "\u0625\u0633\u0646\u0627\u062F \u0627\u0644\u062A\u0630\u0627\u0643\u0631 \u0625\u0644\u0649 \u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646"
};
var ROLES = {
  super_admin: { name: "Super Admin", permissions: Object.keys(PERMISSIONS) },
  finance: { name: "Finance", permissions: ["dashboard.read", "users.read", "accounts.read", "wallet.read", "finance.read", "finance.propose", "programs.read", "reports.export"] },
  finance_approver: { name: "Finance Approver", permissions: ["dashboard.read", "users.read", "accounts.read", "wallet.read", "finance.read", "finance.approve", "programs.read", "audit.read", "reports.export"] },
  kyc_reviewer: { name: "KYC Reviewer", permissions: ["dashboard.read", "users.read", "kyc.read", "kyc.documents", "kyc.review"] },
  support: { name: "Support", permissions: ["dashboard.read", "users.read", "accounts.read", "tickets.read", "tickets.manage"] },
  operations: { name: "Operations", permissions: ["tickets.read", "tickets.manage", "tickets.assign", "dashboard.read", "users.read", "users.manage", "accounts.read", "accounts.manage", "trading.read", "contracts.manage", "markets.manage", "programs.read", "referrals.review", "agencies.manage", "badges.grant", "notifications.manage", "reports.export"] },
  content_manager: { name: "Content Manager", permissions: ["dashboard.read", "content.manage", "content.publish", "notifications.manage"] },
  auditor: { name: "Auditor", permissions: ["tickets.read", "dashboard.read", "users.read", "accounts.read", "wallet.read", "finance.read", "trading.read", "programs.read", "audit.read", "security.read", "reports.export"] }
};

// firebase-functions/src/control-auth.ts
var controlRef = (kind, id) => ref("orinControl" + kind, id);
async function controlAccess(u, financial = false, tx) {
  const read = (r) => tx ? tx.get(r) : r.get();
  const [a, c, p] = await Promise.all([read(controlRef("Access", u.id)), read(controlRef("Configuration", "current")), read(ref("users", u.id))]);
  if (!p.exists || p.data()?.disabled || a.data()?.status === "suspended" || financial && a.data()?.status === "restricted")
    throw new ApiError("\u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u0642\u064A\u0651\u062F. / Account restricted.", 403);
  if (financial && c.data()?.maintenance)
    throw new ApiError("\u0627\u0644\u062E\u062F\u0645\u0629 \u0641\u064A \u0648\u0636\u0639 \u0627\u0644\u0635\u064A\u0627\u0646\u0629. / Maintenance.", 503);
}
async function controlAccount(uid, id, tx) {
  const r = controlRef("AccountStates", hash(uid + ":" + id)), s = await (tx ? tx.get(r) : r.get());
  if (s.data()?.status === "restricted")
    throw new ApiError("\u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0627\u0644\u064A \u0645\u0642\u064A\u0651\u062F. / Trading account restricted.", 403);
}

// firebase-functions/src/program-ingestion.ts
var key = (s) => {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(s)) throw new ApiError("Invalid trusted event id");
  return s;
};
var validMoney = (n) => Number.isSafeInteger(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER / 4;
async function recordConfirmedDeposit(e) {
  key(e.eventId);
  key(e.uid);
  key(e.accountId);
  if (e.currency !== "USD" || !validMoney(e.cents) || e.cents === 0 || typeof e.eligible !== "boolean") throw new ApiError("Invalid confirmed deposit");
  await db.runTransaction(async (tx) => {
    const event = ref("orinTrustedEvents", e.eventId), a = db.doc(`sparkTradingAccounts/${e.uid}/accounts/${e.accountId}`), b = ref("orinBonusWallets", e.uid), fund = ref("orinQualifiedDeposits", e.uid), m = ref("orinProgramMembers", e.uid);
    const [old, acc, bonus, first, member, profile, access] = await Promise.all([tx.get(event), tx.get(a), tx.get(b), tx.get(fund), tx.get(m), tx.get(ref("users", e.uid)), tx.get(ref("orinControlAccess", e.uid))]);
    const fingerprint = hash(JSON.stringify(e));
    if (old.exists) {
      if (old.data().fingerprint !== fingerprint) throw new ApiError("Event conflict", 409);
      return;
    }
    if (!profile.exists || profile.data().disabled || access.data()?.status === "suspended") throw new ApiError("Funding account restricted", 409);
    const data = acc.data();
    if (!data || data.ownerId !== e.uid || data.type !== "real" || data.currency !== "USD" || !validMoney(data.balanceCents + e.cents)) throw new ApiError("Invalid funding account", 409);
    tx.update(a, { balanceCents: data.balanceCents + e.cents });
    if (e.eligible && (!first.exists || e.cents > first.data().cents)) {
      tx.set(fund, { uid: e.uid, eventId: e.eventId, cents: e.cents, accountId: e.accountId });
      if (bonus.exists) tx.update(b, { qualifiedDepositCents: e.cents, withdrawableProfitCents: e.cents >= (bonus.data().firstDepositCents ?? 5e4) ? bonus.data().profitCents : 0 });
    }
    if (member.exists) tx.update(m, { badges: [.../* @__PURE__ */ new Set([...member.data().badges ?? [], "first_deposit"])] });
    tx.create(event, { ...e, fingerprint, type: "deposit", status: "confirmed" });
    tx.create(ref("orinProgramLedger", "deposit-" + e.eventId), { uid: e.uid, accountId: e.accountId, kind: "deposit", entries: [{ account: "cash", cents: e.cents }, { account: "payment-clearing", cents: -e.cents }], createdAt: Date.now() });
    audit(tx, "trusted-" + e.eventId, "provider", "DEPOSIT_CONFIRMED", e.uid, { eventId: e.eventId, cents: e.cents, accountId: e.accountId }, Date.now());
  });
}

// firebase-functions/src/nowpayments.ts
import { createHmac, timingSafeEqual } from "node:crypto";
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key2, item]) => [key2, canonical(item)]));
  return value;
}
function validIpn(body, signature, secret) {
  if (!secret || !body || typeof body !== "object" || Array.isArray(body) || !/^[a-fA-F0-9]{128}$/.test(signature)) return false;
  const expected = createHmac("sha512", secret).update(JSON.stringify(canonical(body))).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
function providerId(value) {
  if (typeof value === "number" && !Number.isSafeInteger(value)) throw new ApiError("Invalid payment identifier", 502);
  const result = String(value ?? "");
  if (!/^[0-9]{1,30}$/.test(result)) throw new ApiError("Invalid payment identifier", 502);
  return result;
}
function units(value, decimals = 18) {
  const text = String(value ?? "");
  if (!/^\d{1,20}(\.\d{1,18})?$/.test(text)) throw new ApiError("Invalid provider amount", 502);
  const [whole, fraction = ""] = text.split(".");
  if (fraction.length > decimals && /[1-9]/.test(fraction.slice(decimals))) throw new ApiError("Invalid amount precision", 502);
  return BigInt(whole) * BigInt(10) ** BigInt(decimals) + BigInt(fraction.slice(0, decimals).padEnd(decimals, "0"));
}
var NowPayments = class {
  constructor(apiKey, callback, requester = fetch) {
    this.apiKey = apiKey;
    this.callback = callback;
    this.requester = requester;
  }
  async request(path, body) {
    if (!this.apiKey) throw new ApiError("\u062E\u062F\u0645\u0629 \u0627\u0644\u062F\u0641\u0639 \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0625\u0639\u062F\u0627\u062F \u0627\u0644\u062E\u0627\u062F\u0645.", 503);
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12e3);
    try {
      const response = await this.requester("https://api.nowpayments.io/v1" + path, { method: body ? "POST" : "GET", headers: { "x-api-key": this.apiKey, "Content-Type": "application/json", Accept: "application/json" }, ...body ? { body: JSON.stringify(body) } : {}, signal: controller.signal, redirect: "error" });
      if (!response.ok) throw new ApiError(response.status === 400 ? "\u062A\u0639\u0630\u0631 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062F\u0641\u0639\u061B \u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0639\u0645\u0644\u0629 \u0648\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u062F\u0646\u0649 \u0644\u062F\u0649 \u0627\u0644\u0645\u0632\u0648\u062F." : "\u062A\u0639\u0630\u0631 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u0645\u0632\u0648\u062F \u0627\u0644\u062F\u0641\u0639. \u062A\u062D\u0642\u0642 \u0645\u0646 \u062D\u0627\u0644\u0629 \u0627\u0644\u0637\u0644\u0628 \u0642\u0628\u0644 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.", response.status === 400 ? 422 : 503);
      if (!response.headers.get("content-type")?.includes("application/json")) throw new ApiError("\u0627\u0633\u062A\u062C\u0627\u0628\u0629 \u0645\u0632\u0648\u062F \u0627\u0644\u062F\u0641\u0639 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629.", 502);
      const result = await response.json();
      if (!result || Array.isArray(result) || typeof result !== "object") throw new ApiError("\u0627\u0633\u062A\u062C\u0627\u0628\u0629 \u0645\u0632\u0648\u062F \u0627\u0644\u062F\u0641\u0639 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629.", 502);
      return result;
    } finally {
      clearTimeout(timer);
    }
  }
  create(orderId, amountCents, coin) {
    return this.request("/payment", { price_amount: amountCents / 100, price_currency: "usd", pay_currency: coin, order_id: orderId, order_description: "ORIN account deposit", ipn_callback_url: this.callback, is_fixed_rate: false, is_fee_paid_by_user: false });
  }
  get(id) {
    return this.request("/payment/" + providerId(id));
  }
};

// lib/payments.ts
var PAYMENT_COINS = [
  { id: "usdttrc20", label: "USDT", network: "TRON \xB7 TRC20" },
  { id: "usdtbsc", label: "USDT", network: "BNB Smart Chain \xB7 BEP20" },
  { id: "btc", label: "BTC", network: "Bitcoin" },
  { id: "eth", label: "ETH", network: "Ethereum \xB7 ERC20" }
];

// firebase-functions/src/payments.ts
var safeId = (value) => {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) throw new ApiError("\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u062D\u0633\u0627\u0628 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.");
  return value;
};
var depositView = (d) => ({ id: d.id, accountId: d.accountId, amountCents: d.amountCents, coin: d.coin, status: d.status, paymentId: d.paymentId ?? null, address: d.address ?? null, payAmount: d.payAmount ?? null, extraId: d.extraId ?? null, credited: !!d.credited, createdAt: d.createdAt });
var states = /* @__PURE__ */ new Set(["waiting", "confirming", "confirmed", "sending", "finished", "partially_paid", "failed", "refunded", "expired"]);
function paymentService(provider, ipnSecret) {
  async function create(u, input) {
    const accountId = safeId(input.accountId), requestId = safeId(input.requestId), amountCents = input.amountCents, coin = input.coin;
    if (Object.keys(input).some((k) => !["accountId", "requestId", "amountCents", "coin"].includes(k)) || !Number.isSafeInteger(amountCents) || amountCents < 100 || amountCents > 1e7 || !PAYMENT_COINS.some((c) => c.id === coin)) throw new ApiError("\u062A\u062D\u0642\u0642 \u0645\u0646 \u0645\u0628\u0644\u063A \u0627\u0644\u0625\u064A\u062F\u0627\u0639 \u0648\u0627\u0644\u0639\u0645\u0644\u0629.");
    if (!u.verified) throw new ApiError("\u0623\u0643\u0651\u062F \u0628\u0631\u064A\u062F\u0643 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0642\u0628\u0644 \u0627\u0644\u0625\u064A\u062F\u0627\u0639.", 403);
    const id = "np-" + hash(u.id + ":" + requestId), r = ref("orinDeposits", id), fingerprint = hash(JSON.stringify({ accountId, amountCents, coin })), now = Date.now();
    const existing = await db.runTransaction(async (tx) => {
      await check(tx, u);
      await controlAccess(u, true, tx);
      await controlAccount(u.id, accountId, tx);
      const configuration = (await tx.get(ref("orinControlConfiguration", "current"))).data();
      if (configuration && configuration.depositsEnabled !== true) throw new ApiError("Deposit service disabled", 409);
      const [old, account, access, rate] = await Promise.all([tx.get(r), tx.get(db.doc(`sparkTradingAccounts/${u.id}/accounts/${accountId}`)), tx.get(ref("orinControlAccess", u.id)), tx.get(ref("orinDepositRateLimits", u.id))]);
      if (access.data()?.status === "suspended") throw new ApiError("\u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u0648\u0642\u0648\u0641.", 403);
      const a = account.data();
      if (!a || a.ownerId !== u.id || a.type !== "real" || a.currency !== "USD") throw new ApiError("\u0627\u0644\u0625\u064A\u062F\u0627\u0639 \u0645\u062A\u0627\u062D \u0644\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u062D\u0642\u064A\u0642\u064A \u0641\u0642\u0637.", 403);
      if (old.exists) {
        if (old.data().fingerprint !== fingerprint) throw new ApiError("\u062A\u063A\u064A\u0651\u0631\u062A \u062A\u0641\u0627\u0635\u064A\u0644 \u0637\u0644\u0628 \u0627\u0644\u062F\u0641\u0639. \u0627\u0641\u062A\u062D \u0637\u0644\u0628\u064B\u0627 \u062C\u062F\u064A\u062F\u064B\u0627.", 409);
        return old.data();
      }
      const recent = (rate.data()?.times ?? []).filter((t) => t > now - 18e5);
      if (recent.length >= 5) throw new ApiError("\u062A\u0648\u062C\u062F \u0637\u0644\u0628\u0627\u062A \u062F\u0641\u0639 \u062D\u062F\u064A\u062B\u0629. \u0631\u0627\u062C\u0639 \u0633\u062C\u0644 \u0627\u0644\u0625\u064A\u062F\u0627\u0639 \u0642\u0628\u0644 \u0625\u0646\u0634\u0627\u0621 \u0637\u0644\u0628 \u0622\u062E\u0631.", 429);
      const d = { id, uid: u.id, accountId, amountCents, coin, fingerprint, status: "creating", createdAt: now, updatedAt: now, credited: false };
      tx.create(r, d);
      tx.set(ref("orinDepositRateLimits", u.id), { times: [...recent, now] });
      audit(tx, "create-" + id, u.id, "DEPOSIT_REQUESTED", id, { accountId, amountCents, coin }, now);
      return null;
    });
    if (existing) return depositView(existing);
    try {
      const payment = await provider.create(id, amountCents, coin);
      await reconcile(id, payment, false);
    } catch (error) {
      await db.runTransaction(async (tx) => {
        const d = (await tx.get(r)).data();
        if (d?.status === "creating") tx.update(r, { status: "review", updatedAt: Date.now() });
      });
      console.error("ORIN payment create failed", { orderId: id, code: error instanceof ApiError ? error.status : "network" });
    }
    return depositView((await r.get()).data());
  }
  async function reconcile(id, payment, allowCredit = true) {
    const r = ref("orinDeposits", safeId(id)), d = (await r.get()).data();
    if (!d) throw new ApiError("Unknown payment order", 404);
    const pid = providerId(payment.payment_id);
    if (payment.order_id !== id || payment.price_currency !== "usd" || payment.pay_currency !== d.coin || units(payment.price_amount, 2) !== BigInt(d.amountCents) || d.paymentId && pid !== d.paymentId || payment.parent_payment_id) throw new ApiError("Payment does not match the stored order", 409);
    const status = states.has(payment.payment_status) ? payment.payment_status : "review";
    if (typeof payment.pay_address !== "string" || !/^[a-zA-Z0-9:_-]{12,256}$/.test(payment.pay_address) || units(payment.pay_amount) <= BigInt(0)) throw new ApiError("Invalid payment destination", 502);
    const extra = payment.payin_extra_id ?? null;
    if (extra !== null && (typeof extra !== "string" || extra.length > 128)) throw new ApiError("Invalid payment memo", 502);
    await db.runTransaction(async (tx) => {
      const [fresh, owner2] = await Promise.all([tx.get(r), tx.get(ref("orinPaymentIds", pid))]);
      const cur = fresh.data();
      if (owner2.exists && owner2.data().orderId !== id || cur.paymentId && cur.paymentId !== pid) throw new ApiError("Payment identity conflict", 409);
      const reversal = cur.credited && ["refunded", "failed", "partially_paid"].includes(status);
      const issue = ref("orinPaymentReviews", pid), previousIssue = reversal ? await tx.get(issue) : null;
      tx.set(ref("orinPaymentIds", pid), { orderId: id });
      if (reversal && !previousIssue?.exists) {
        tx.create(issue, { orderId: id, uid: cur.uid, accountId: cur.accountId, reason: "provider_reversal_after_credit", providerStatus: status, createdAt: Date.now(), resolved: false });
        audit(tx, "payment-review-" + pid, "provider", "PAYMENT_REVIEW_REQUIRED", id, { paymentId: pid, status }, Date.now());
      }
      tx.update(r, { paymentId: pid, address: payment.pay_address, payAmount: String(payment.pay_amount), extraId: extra, status: reversal ? "review" : cur.credited ? "finished" : status, updatedAt: Date.now() });
    });
    if (allowCredit && status === "finished") {
      const [profile, access] = await Promise.all([ref("users", d.uid).get(), ref("orinControlAccess", d.uid).get()]);
      const paid = units(payment.actually_paid), expected = units(payment.pay_amount);
      if (paid !== expected || profile.data()?.disabled || access.data()?.status === "suspended") {
        await db.runTransaction(async (tx) => {
          const fresh = (await tx.get(r)).data();
          if (!fresh.credited) tx.update(r, { status: "review", reviewReason: paid !== expected ? "amount_mismatch" : "account_restricted" });
        });
        return;
      }
      await recordConfirmedDeposit({ eventId: "nowpayments-" + pid, uid: d.uid, accountId: d.accountId, currency: "USD", cents: d.amountCents, eligible: false });
      await r.update({ status: "finished", credited: true, updatedAt: Date.now() });
    }
  }
  async function get(u, id, refresh = false) {
    const r = ref("orinDeposits", safeId(id)), d = (await r.get()).data();
    if (!d || d.uid !== u.id) throw new ApiError("\u0637\u0644\u0628 \u0627\u0644\u062F\u0641\u0639 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D.", 404);
    if (refresh && d.paymentId && !d.credited) {
      const permitted = await db.runTransaction(async (tx) => {
        const current = (await tx.get(r)).data();
        if ((current.refreshAfter ?? 0) > Date.now()) return false;
        tx.update(r, { refreshAfter: Date.now() + 2e4 });
        return true;
      });
      if (permitted) await reconcile(id, await provider.get(d.paymentId));
    }
    return depositView((await r.get()).data());
  }
  async function list(u, accountId) {
    safeId(accountId);
    const account = (await db.doc(`sparkTradingAccounts/${u.id}/accounts/${accountId}`).get()).data();
    if (!account || account.ownerId !== u.id) throw new ApiError("\u0627\u0644\u062D\u0633\u0627\u0628 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D.", 404);
    const result = await db.collection("orinDeposits").where("uid", "==", u.id).where("accountId", "==", accountId).orderBy("createdAt", "desc").limit(20).get();
    return result.docs.map((d) => depositView(d.data()));
  }
  async function webhook(body, signature) {
    if (!validIpn(body, signature, ipnSecret)) throw new ApiError("Invalid payment notification signature", 401);
    const id = safeId(body.order_id);
    if (!id.startsWith("np-")) throw new ApiError("Unknown payment order", 404);
    const current = await provider.get(providerId(body.payment_id));
    if (providerId(current.payment_id) !== providerId(body.payment_id)) throw new ApiError("Payment identity mismatch", 409);
    await reconcile(id, current);
    return { ok: true };
  }
  return { create, get, list, webhook };
}
export {
  NowPayments,
  canonical,
  db,
  paymentService,
  units,
  validIpn
};
