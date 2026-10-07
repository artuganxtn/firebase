// firebase-functions/src/support-admin.ts
import { randomUUID as randomUUID2 } from "node:crypto";
import { FieldPath, Timestamp } from "firebase-admin/firestore";

// firebase-functions/src/store.ts
import { initializeApp as initializeApp2, getApps as getApps2 } from "firebase-admin/app";
import { getAuth as getAuth2 } from "firebase-admin/auth";
import { getFirestore as getFirestore2, FieldValue } from "firebase-admin/firestore";
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

// firebase-functions/src/account-security.ts
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
var app = getApps()[0] ?? initializeApp();
var securityDb = getFirestore(app);
var securityAuth = getAuth(app);
var securityEnabled = () => process.env.ORIN_ACCOUNT_SECURITY_ENABLED === "true";
var SESSION_LIFE = 30 * 864e5;
var CHALLENGE_LIFE = 5 * 6e4;

// firebase-functions/src/store.ts
var app2 = getApps2()[0] ?? initializeApp2();
var db = getFirestore2(app2);
var auth = getAuth2(app2);
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
  if (securityEnabled() || u.securitySessionId) {
    if (!u.securitySessionId) throw new ApiError("\u064A\u062C\u0628 \u0625\u0643\u0645\u0627\u0644 \u062A\u062D\u0642\u0642 \u062C\u0644\u0633\u0629 ORIN.", 401);
    const [sessionDoc, securityDoc] = await Promise.all([tx.get(ref("orinSecuritySessions", u.securitySessionId)), tx.get(ref("orinAccountSecurity", u.id))]);
    const session = sessionDoc.data();
    if (!session || session.uid !== u.id || session.status !== "active" || session.expiresAtMs <= Date.now() || session.epoch !== (securityDoc.data()?.epoch ?? 0)) throw new ApiError("\u062A\u0645 \u0625\u0628\u0637\u0627\u0644 \u062C\u0644\u0633\u0629 ORIN.", 401);
  }
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

// lib/control-center.ts
var PERMISSIONS = {
  "support.ai.read": "\u0639\u0631\u0636 \u062A\u0634\u063A\u064A\u0644 \u0627\u0644\u062F\u0639\u0645 \u0627\u0644\u0630\u0643\u064A",
  "support.ai.configure": "\u0625\u0639\u062F\u0627\u062F \u0648\u062A\u0634\u063A\u064A\u0644 \u0627\u0644\u062F\u0639\u0645 \u0627\u0644\u0630\u0643\u064A",
  "support.knowledge.manage": "\u062A\u062D\u0631\u064A\u0631 \u0645\u0639\u0631\u0641\u0629 \u0627\u0644\u062F\u0639\u0645",
  "support.knowledge.publish": "\u0645\u0631\u0627\u062C\u0639\u0629 \u0648\u0646\u0634\u0631 \u0645\u0639\u0631\u0641\u0629 \u0627\u0644\u062F\u0639\u0645",
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
  support: { name: "Support", permissions: ["support.ai.read", "dashboard.read", "users.read", "accounts.read", "tickets.read", "tickets.manage"] },
  operations: { name: "Operations", permissions: ["support.ai.read", "tickets.read", "tickets.manage", "tickets.assign", "dashboard.read", "users.read", "users.manage", "accounts.read", "accounts.manage", "trading.read", "contracts.manage", "markets.manage", "programs.read", "referrals.review", "agencies.manage", "badges.grant", "notifications.manage", "reports.export"] },
  content_manager: { name: "Content Manager", permissions: ["support.ai.read", "support.knowledge.manage", "support.knowledge.publish", "dashboard.read", "content.manage", "content.publish", "notifications.manage"] },
  auditor: { name: "Auditor", permissions: ["support.ai.read", "tickets.read", "dashboard.read", "users.read", "accounts.read", "wallet.read", "finance.read", "trading.read", "programs.read", "audit.read", "security.read", "reports.export"] }
};
function permissionsFor(roles) {
  if (!Array.isArray(roles) || roles.some((r) => typeof r !== "string" || !Object.hasOwn(ROLES, r)))
    return [];
  return [...new Set(roles.flatMap((r) => ROLES[r].permissions))];
}

// firebase-functions/src/control-auth.ts
var controlRef = (kind, id) => ref("orinControl" + kind, id);
async function requirePermission(u, permission, tx, recent = false) {
  const read = (r) => tx ? tx.get(r) : r.get();
  const [p, s, gate, revocation] = await Promise.all([read(ref("users", u.id)), read(ref("orinStaff", u.id)), read(controlRef("Access", u.id)), read(controlRef("SessionRevocations", u.id))]);
  if (!u.verified || !p.exists || p.data().disabled || p.data().email !== u.email || gate.data()?.status === "suspended" || !s.exists || s.data().status !== "active" || s.data().email !== u.email || !permissionsFor(s.data().roles).includes(permission))
    throw new ApiError("\u0644\u0627 \u062A\u0645\u0644\u0643 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629. / Permission denied.", 403);
  if (revocation.exists && (!u.authTime || u.authTime * 1e3 <= revocation.data().validAfter))
    throw new ApiError("Admin session revoked", 401);
  if (s.data().validAfter && (!u.authTime || u.authTime * 1e3 <= s.data().validAfter))
    throw new ApiError("\u0627\u0646\u062A\u0647\u062A \u062C\u0644\u0633\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u0629. \u0623\u0639\u062F \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644. / Admin session revoked.", 401);
  if (recent && (!u.authTime || Date.now() / 1e3 - u.authTime > 300 || u.authTime > Date.now() / 1e3 + 60))
    throw new ApiError("\u0623\u0639\u062F \u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629 \u0642\u0628\u0644 \u0647\u0630\u0647 \u0627\u0644\u0639\u0645\u0644\u064A\u0629. / Recent authentication required.", 401);
  return s.data();
}
function controlAudit(tx, id, u, action, target, reason, before, after, referenceId) {
  tx.create(controlRef("Audit", id), { adminId: u.id, action, target, timestamp: Date.now(), reason, previous: before ?? null, next: after ?? null, requestId: referenceId, referenceId, payloadHash: hash(JSON.stringify({ action, target, before, after, referenceId })) });
}

// lib/support-ai-control.ts
var SUPPORTED_GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-2.5-flash-lite"];
var SUPPORT_AI_DEFAULTS = { enabled: false, provider: "gemini", model: "gemini-3.5-flash-lite", maxTokensPerReply: 700, dailyTokenBudget: 5e4, systemInstructions: "" };
var SUPPORT_AI_CONFIG_FIELDS = Object.keys(SUPPORT_AI_DEFAULTS);
var secret = /\bAIza[0-9A-Za-z_-]{20,}|\bsk-[0-9A-Za-z_-]{16,}|-----BEGIN[^\n]*PRIVATE KEY|otpauth:\/\//i;
function validateSupportText(value, max, empty = false) {
  if (typeof value !== "string" || value.length > max || !empty && !value.trim() || secret.test(value)) throw new Error("\u0646\u0635 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D \u0623\u0648 \u064A\u062A\u0636\u0645\u0646 \u0628\u064A\u0627\u0646\u0627\u062A \u0633\u0631\u064A\u0629. / Invalid or sensitive text.");
  return value.trim();
}
function parseSupportAIConfig(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid assistant settings.");
  const d = raw;
  if (Object.keys(d).some((key2) => !SUPPORT_AI_CONFIG_FIELDS.includes(key2))) throw new Error("Only approved assistant settings are editable.");
  const c = { ...SUPPORT_AI_DEFAULTS, ...d };
  if (typeof c.enabled !== "boolean" || !["gemini", "openai-compatible"].includes(c.provider) || typeof c.model !== "string" || !/^[A-Za-z0-9_.:/-]{1,160}$/.test(c.model)) throw new Error("Invalid provider or model.");
  if (c.provider === "gemini" && !SUPPORTED_GEMINI_MODELS.includes(c.model)) throw new Error("The Gemini model is not approved for this deployment.");
  if (!Number.isSafeInteger(c.maxTokensPerReply) || Number(c.maxTokensPerReply) < 128 || Number(c.maxTokensPerReply) > 2048 || !Number.isSafeInteger(c.dailyTokenBudget) || Number(c.dailyTokenBudget) < 1e3 || Number(c.dailyTokenBudget) > 1e6 || Number(c.dailyTokenBudget) < Number(c.maxTokensPerReply)) throw new Error("Reply limit 128\u20132048; daily budget 1,000\u20131,000,000 tokens and at least one reply.");
  return { ...c, systemInstructions: validateSupportText(c.systemInstructions, 1500, true) };
}

// lib/support-knowledge.ts
var SUPPORT_KNOWLEDGE = [
  { id: "scope", title: "ORIN support scope", content: "ORIN support explains how to use this application. It cannot execute trades, change balances, approve payments, recover passwords, verify identity, remove restrictions or promise a financial return. Those actions require the relevant authenticated application workflow or an authorized human. Never request passwords, PINs, OTPs, recovery codes, seed phrases or private keys." },
  { id: "accounts", title: "Real and demo accounts", content: "Switch accounts from the account selector inside the existing home balance card. The green badge \u062D\u0642\u064A\u0642\u064A identifies real accounts. The orange badge \u062A\u062C\u0631\u064A\u0628\u064A identifies simulated funds. Demo money is separate from real money and cannot be withdrawn. Account switching should preserve the app session without a page reload." },
  { id: "demo", title: "Demo balance and transfers", content: "Only demo accounts show \u0636\u0628\u0637 \u0627\u0644\u0631\u0635\u064A\u062F. The user can set a USD demo balance; setting it replaces the demo total, assigns it to the futures pocket and clears the perpetual pocket. Demo transfer moves existing simulated funds between futures and perpetual pockets without changing their total. Adjustment and transfer are blocked when a contract has reserved funds. Demo deposit/withdraw actions are disabled. A support message never authorizes an adjustment." },
  { id: "real-transfers", title: "Real financial operations", content: "The shipped Spark client does not provide a real futures/perpetual transfer or execution engine. A visible account or transfer screen is not evidence that real trading, deposits, withdrawals or NOWPayments settlement are enabled. Only the actual authenticated payment or trading screen and trusted backend can establish availability. Do not supply a payment address, promise activation, invent a transaction status or tell a user to send funds outside an approved in-app payment instruction." },
  { id: "market", title: "Market card and charts", content: "The market card shows source data for the selected asset. The small chart uses closed historical 15-minute candles covering 24 hours; it is intentionally calm and not a live-tick animation. Kraken, Bitstamp or Coinbase may provide supported crypto/USD history. A missing or interrupted feed is a data-connection issue, not proof of a zero price. TradingView is the separate main chart. Support must not change its settings or invent missing chart points." },
  { id: "positions", title: "Positions and activity", content: "\u0627\u0644\u0645\u0631\u0627\u0643\u0632 displays open and closed internal contracts, search and contract details. These are not automatically exchange futures orders. Recent transactions and account statements are reached through settings/activity. A statement must reflect recorded entries. For a disputed result or missing payment, ask for the non-secret transaction reference and hand the conversation to support." },
  { id: "settings", title: "Settings and language", content: "Settings contain profile, appearance/language, notifications, security, chart preferences and account activity. Arabic, English, Turkish and German interface translations are supported. Changing interface language does not change a financial account currency or convert balances. Profile updates apply to the signed-in account." },
  { id: "security", title: "Account security workflows", content: "Security features must be read from the actual security screen. A compiled screen is not proof that a server service is deployed. ORIN app lock, when configured on Android, uses a device PIN or system biometric prompt; support never collects either. TOTP is enabled only after a successful first verification. Recovery codes are single-use. Passkey private keys stay with the device/credential provider. Session location, if shown from IP, is approximate, not GPS. Never claim to have ended a session or changed security from chat." },
  { id: "referral", title: "Invitations", content: "\u062F\u0639\u0648\u0629 \u0635\u062F\u064A\u0642 opens the referral page with the user\u2019s own code/link and actual recorded referral activity when available. A referral code can be supplied in the optional registration field. A code or invitation does not guarantee a reward; reward eligibility and amounts depend on the published program terms and verified backend records. Do not fabricate invited-user counts or reward balances." },
  { id: "support", title: "Messages and human assistance", content: "Support messages are saved to the signed-in user\u2019s own conversation. The conversation menu offers \u0637\u0644\u0628 \u0645\u062A\u0627\u0628\u0639\u0629 \u0645\u0646 \u0645\u0648\u0638\u0641. A requested handoff does not mean a person is online or that a response time is guaranteed. Adam is ORIN\u2019s automated support assistant, presented as Adam from ORIN support. He answers transparently about being automated when asked and never pretends to be a human. A reply exists only after a real model answers successfully. If the model is unavailable, the original user message remains saved and the conversation can be handed to the team." }
];
function redactSupportInput(value) {
  return value.slice(0, 2e3).replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email omitted]").replace(/(?:https?:\/\/|otpauth:\/\/|file:\/\/|data:)[^\s]+/gi, "[link omitted]").replace(/\b(?:[a-f0-9]{6}-){3}[a-f0-9]{6}\b|\b[a-f0-9]{24}\b/gi, "[recovery code omitted]").replace(/(?:password|passwd|secret|recovery\s*code|pin|otp|رمز\s*(?:التحقق|الاسترداد)|كلمة\s*(?:المرور|السر))\s*(?:[:=]|is|هو|هي)\s*\S+/gi, "[credential omitted]").replace(/\b(?:sk-|eyJ)[A-Za-z0-9_.-]{12,}\b/g, "[credential omitted]").replace(/[A-Za-z0-9_+\/=.-]{32,}/g, "[long identifier omitted]").replace(/[0-9٠-٩۰-۹]{4,}/g, "[number omitted]");
}

// firebase-functions/src/support-assistant-provider.ts
var SupportModelError = class extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
};
function assistantConfiguration(env) {
  if (env.ORIN_SUPPORT_AI_ENABLED !== "true") return null;
  const provider = env.ORIN_SUPPORT_AI_PROVIDER === "gemini" ? "gemini" : "openai-compatible", model = env.ORIN_SUPPORT_AI_MODEL ?? (provider === "gemini" ? "gemini-3.5-flash-lite" : "");
  const maxTokens = Math.max(128, Math.min(2048, Number(env.ORIN_SUPPORT_AI_MAX_TOKENS) || 700));
  if (provider === "gemini") {
    if (!env.ORIN_SUPPORT_AI_API_KEY) return null;
    if (!SUPPORTED_GEMINI_MODELS.includes(model)) throw new SupportModelError("model_configuration_invalid");
    return { provider, endpoint: "https://generativelanguage.googleapis.com/v1beta/models/" + model, model, token: env.ORIN_SUPPORT_AI_API_KEY, maxTokens };
  }
  if (!env.ORIN_SUPPORT_AI_ENDPOINT || !model) return null;
  let url;
  try {
    url = new URL(env.ORIN_SUPPORT_AI_ENDPOINT);
  } catch {
    throw new SupportModelError("model_configuration_invalid");
  }
  const allowed = (env.ORIN_SUPPORT_AI_ALLOWED_ORIGINS ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !url.pathname.endsWith("/v1/chat/completions") || !allowed.includes(url.origin) || /^(localhost|127\.|0\.|169\.254\.|\[)/i.test(url.hostname)) throw new SupportModelError("model_endpoint_not_allowed");
  if (!/^[A-Za-z0-9_./:-]{1,160}$/.test(model)) throw new SupportModelError("model_configuration_invalid");
  return { provider, endpoint: url.href, model, token: env.ORIN_SUPPORT_AI_TOKEN ?? "", maxTokens };
}
function outputSchema(ids) {
  return { type: "object", additionalProperties: false, required: ["text", "handoff", "scope", "citationIds"], properties: { text: { type: "string", maxLength: 2e3 }, handoff: { type: "boolean" }, scope: { type: "string", enum: ["application", "outside"] }, citationIds: { type: "array", maxItems: 12, items: { type: "string", enum: ids } } } };
}
var ASSISTANT_OUTPUT_SCHEMA = outputSchema(SUPPORT_KNOWLEDGE.map((d) => d.id));
async function boundedJson(response) {
  if (!response.ok) throw new SupportModelError(response.status === 429 ? "model_rate_limited" : "model_http_error");
  if (Number(response.headers.get("content-length") ?? 0) > 65536) throw new SupportModelError("model_response_too_large");
  const reader = response.body?.getReader();
  if (!reader) throw new SupportModelError("model_empty_response");
  const chunks = [];
  let size = 0;
  try {
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) throw new SupportModelError("model_response_too_large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {
    });
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new SupportModelError("model_invalid_json");
  }
}
async function modelReady(config, request = fetch) {
  const url = new URL(config.endpoint);
  if (config.provider !== "gemini") url.pathname = url.pathname.replace(/chat\/completions$/, "models");
  const headers = config.provider === "gemini" ? { "x-goog-api-key": config.token } : config.token ? { Authorization: "Bearer " + config.token } : {};
  const value = await boundedJson(await request(url.href, { method: "GET", headers, redirect: "error", signal: AbortSignal.timeout(1e4) }));
  return config.provider === "gemini" ? value.name === "models/" + config.model && value.supportedGenerationMethods?.includes("generateContent") : Array.isArray(value.data) && value.data.some((v) => !!v && typeof v === "object" && v.id === config.model);
}

// firebase-functions/src/support-admin.ts
function validateSupportConfiguration(raw) {
  try {
    return parseSupportAIConfig(raw);
  } catch (error) {
    throw new ApiError(error.message, 400);
  }
}
var key = (v) => {
  if (typeof v !== "string" || !/^[-A-Za-z0-9_]{1,128}$/.test(v)) throw new ApiError("Invalid identifier");
  return v;
};
var documentId = (v) => {
  if (typeof v !== "string" || !/^[a-z0-9_-]{1,80}$/.test(v)) throw new ApiError("Use a knowledge ID of 1\u201380 lowercase letters, digits, _ or -.");
  return v;
};
var bounded = (v, max, empty = false) => {
  try {
    return validateSupportText(v, max, empty);
  } catch (error) {
    throw new ApiError(error.message, 400);
  }
};
var only = (d, fields) => {
  if (Object.keys(d).some((k) => !fields.includes(k))) throw new ApiError("Unsupported support field");
};
var safe = (value) => value?.toMillis ? value.toMillis() : Array.isArray(value) ? value.map(safe) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, safe(v)])) : value;
var pick = (d, fields) => Object.fromEntries(fields.filter((k) => d[k] !== void 0).map((k) => [k, safe(d[k])]));
var configuration = (d = {}) => ({ ...SUPPORT_AI_DEFAULTS, ...pick(d, SUPPORT_AI_CONFIG_FIELDS) });
var summary = (d) => d ? { revision: d.revision, status: d.status, reviewed: d.reviewed, title: d.title, contentHash: typeof d.content === "string" ? hash(d.content) : null } : null;
var configSummary = (d) => ({ ...pick(d, ["enabled", "provider", "model", "maxTokensPerReply", "dailyTokenBudget", "revision"]), guidanceHash: hash(d.systemInstructions ?? "") });
function runtimePresence(c) {
  try {
    const config = assistantConfiguration({ ...process.env, ORIN_SUPPORT_AI_PROVIDER: c.provider, ORIN_SUPPORT_AI_MODEL: c.model });
    const credentialPresent = c.provider === "gemini" ? !!process.env.ORIN_SUPPORT_AI_API_KEY : !!process.env.ORIN_SUPPORT_AI_TOKEN;
    return { operatorEnabled: process.env.ORIN_SUPPORT_AI_ENABLED === "true", credentialPresent, configurationValid: config !== null, status: !c.enabled ? "disabled" : !config ? "not-configured" : "configured-unverified" };
  } catch {
    return { operatorEnabled: process.env.ORIN_SUPPORT_AI_ENABLED === "true", credentialPresent: false, configurationValid: false, status: "invalid-configuration" };
  }
}
var health = /* @__PURE__ */ new Map();
async function runtimeStatus(c) {
  const presence = runtimePresence(c);
  if (!c.enabled || !presence.configurationValid) return { ...presence, checkedAt: null };
  const config = assistantConfiguration({ ...process.env, ORIN_SUPPORT_AI_PROVIDER: c.provider, ORIN_SUPPORT_AI_MODEL: c.model });
  if (!config) return { ...presence, checkedAt: null };
  const key2 = hash(JSON.stringify(config)), now = Date.now();
  let cached = health.get(key2);
  if (!cached || cached.until < now) {
    let ready = false;
    try {
      ready = await modelReady(config);
    } catch {
    }
    cached = { until: now + 3e4, ready };
    health.clear();
    health.set(key2, cached);
  }
  return { ...presence, status: cached.ready ? "ready" : "unreachable", checkedAt: cached.until - 3e4 };
}
function cursor(raw, section) {
  if (!raw) return null;
  try {
    if (typeof raw !== "string" || raw.length > 1e3 || !/^[\w-]+$/.test(raw)) throw new Error();
    const v = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (v.section !== section || typeof v.id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(v.id)) throw new Error();
    return v.id;
  } catch {
    throw new ApiError("Invalid support page cursor");
  }
}
async function list(collection, section, q, fields, filter) {
  let query = db.collection(collection);
  if (filter) query = filter(query);
  query = query.orderBy(FieldPath.documentId());
  const start = cursor(q.cursor, section);
  if (start) query = query.startAfter(start);
  const page = await query.limit(51).get(), docs = page.docs.slice(0, 50), last = docs.at(-1);
  return { rows: docs.map((d) => ({ id: d.id, ...pick(d.data(), fields) })), nextCursor: page.size > 50 && last ? Buffer.from(JSON.stringify({ section, id: last.id })).toString("base64url") : null };
}
async function readSupportAdmin(u, q = {}) {
  const staff = await db.runTransaction(async (tx) => {
    await check(tx, u);
    return requirePermission(u, "support.ai.read", tx);
  });
  const section = typeof q.section === "string" ? q.section : "overview";
  if (section === "knowledge") return { ...await list("orinSupportKnowledge", section, q, ["title", "content", "status", "reviewed", "revision", "updatedAt", "updatedBy"]), section };
  if (section === "conversations") {
    await requirePermission(u, "tickets.read");
    if (q.thread) {
      const id = key(q.thread), thread = await ref("orinSupportConversations", id).get();
      if (!thread.exists) throw new ApiError("Conversation not found", 404);
      let query = thread.ref.collection("messages").orderBy("createdAt", "desc").orderBy(FieldPath.documentId(), "desc");
      if (q.messagesCursor) {
        try {
          const c = JSON.parse(Buffer.from(String(q.messagesCursor), "base64url").toString("utf8"));
          if (c.thread !== id || !Number.isSafeInteger(c.at) || c.at < 0) throw new Error();
          query = query.startAfter(Timestamp.fromMillis(c.at), key(c.id));
        } catch {
          throw new ApiError("Invalid conversation cursor");
        }
      }
      const page = await query.limit(81).get(), docs = page.docs.slice(0, 80), last = docs.at(-1), nextMessagesCursor = page.size > 80 && last ? Buffer.from(JSON.stringify({ thread: id, id: last.id, at: safe(last.data().createdAt) })).toString("base64url") : null;
      const requestId = randomUUID2();
      await db.runTransaction(async (tx) => {
        await check(tx, u);
        await requirePermission(u, "tickets.read", tx);
        controlAudit(tx, requestId, u, "support.ai.conversation.read", id, "Authorized support conversation view", null, { messages: docs.length }, requestId);
      });
      return { section, thread: { id, ...pick(thread.data(), ["ownerId", "updatedAt", "handoffRequested", "lastMessageId"]) }, rows: docs.reverse().map((d) => ({ id: d.id, ...pick(d.data(), ["kind", "createdAt", "senderId", "assistant"]), text: redactSupportInput(String(d.data().text ?? "")) })), nextMessagesCursor, nextCursor: null };
    }
    return { ...await list("orinSupportConversations", section, q, ["ownerId", "updatedAt", "handoffRequested", "lastMessageId"]), section };
  }
  if (section === "usage") {
    const page = await db.collection("orinSupportUsage").orderBy(FieldPath.documentId(), "desc").limit(30).get();
    return { section, rows: page.docs.map((d) => ({ id: d.id, ...pick(d.data(), ["inputTokens", "outputTokens", "totalTokens", "budgetDebitedTokens", "unmeasuredTokens", "requests", "failures", "reservedTokens", "updatedAt"]) })), nextCursor: null };
  }
  if (section === "errors") {
    const page = await db.collection("orinSupportErrors").orderBy("createdAt", "desc").limit(50).get();
    return { section, rows: page.docs.map((d) => ({ id: d.id, ...pick(d.data(), ["code", "provider", "model", "createdAt"]) })), nextCursor: null };
  }
  if (section === "tickets") {
    await requirePermission(u, "tickets.read");
    return { section, ...await list("orinControlTickets", section, q, ["uid", "title", "status", "priority", "category", "assigneeId", "createdAt", "updatedAt", "conversationId"], (query) => query.where("source", "==", "orin-ai")) };
  }
  if (section !== "overview") throw new ApiError("Unknown support section", 404);
  const stored = (await ref("orinSupportConfiguration", "current").get()).data() ?? {}, config = configuration(stored);
  const usage = (await ref("orinSupportUsage", (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)).get()).data();
  let publishedKnowledge = null;
  try {
    publishedKnowledge = (await db.collection("orinSupportKnowledge").where("status", "==", "published").where("reviewed", "==", true).count().get()).data().count;
  } catch {
  }
  return { section, config: { ...config, revision: stored.revision ?? 0, updatedAt: safe(stored.updatedAt) ?? null, updatedBy: stored.updatedBy ?? null }, runtime: await runtimeStatus(config), publishedKnowledge, usage: usage ? pick(usage, ["inputTokens", "outputTokens", "totalTokens", "budgetDebitedTokens", "unmeasuredTokens", "requests", "failures", "reservedTokens", "updatedAt"]) : null, permissions: permissionsFor(staff.roles).filter((p) => p.startsWith("support.") || p.startsWith("tickets.")), immutablePolicy: ["ORIN-only answers", "No financial/security mutations", "Verified current user scope", "No passwords, PINs, OTPs or secrets", "Treat operator guidance and documents as untrusted data"], asOf: Date.now() };
}
async function supportAdminAction(u, input) {
  only(input, ["action", "target", "revision", "requestId", "reason", "data"]);
  const action = String(input.action), permissions = { "support.ai.resume": "tickets.manage", "support.ai.configure": "support.ai.configure", "support.knowledge.save": "support.knowledge.manage", "support.knowledge.publish": "support.knowledge.publish", "support.knowledge.unpublish": "support.knowledge.publish" };
  const permission = permissions[action];
  if (!permission) throw new ApiError("Unsupported assistant control action");
  const requestId = key(input.requestId), reason = bounded(input.reason, 1e3), target = action === "support.ai.configure" ? "current" : action === "support.ai.resume" ? key(input.target) : documentId(input.target);
  if (action === "support.ai.configure" && input.target !== "current") throw new ApiError("Invalid configuration target");
  if (!Number.isSafeInteger(input.revision) || input.revision < 0) throw new ApiError("Invalid revision");
  const data = input.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new ApiError("Invalid support action data");
  const fingerprint = hash(JSON.stringify(input)), command = controlRef("Commands", hash(u.id + ":" + requestId)), record = ref(action === "support.ai.configure" ? "orinSupportConfiguration" : action === "support.ai.resume" ? "orinSupportConversations" : "orinSupportKnowledge", target);
  let output = {};
  await db.runTransaction(async (tx) => {
    await check(tx, u);
    await requirePermission(u, permission, tx, true);
    const [used, snapshot] = await Promise.all([tx.get(command), tx.get(record)]);
    if (used.exists) {
      if (used.data().fingerprint !== fingerprint) throw new ApiError("Request ID conflict", 409);
      output = used.data().result;
      return;
    }
    const before = snapshot.data();
    if (input.revision !== (before?.revision ?? 0)) throw new ApiError("Support record changed; reload before saving.", 409);
    const now = Date.now();
    let after;
    if (action === "support.ai.resume") {
      only(data, []);
      if (!before) throw new ApiError("Conversation not found", 404);
      const mapping = (await tx.get(ref("orinSupportEscalations", target))).data();
      if (!mapping?.ticketId) throw new ApiError("No escalated ticket is associated with this conversation.", 409);
      const ticket = (await tx.get(ref("orinControlTickets", key(mapping.ticketId)))).data();
      if (!ticket || ticket.uid !== target || ticket.conversationId !== target || !["resolved", "closed"].includes(ticket.status)) throw new ApiError("Resolve the associated support ticket before resuming automated replies.", 409);
      const actingStaff = (await tx.get(ref("orinStaff", u.id))).data();
      if (ticket.assigneeId && ticket.assigneeId !== u.id && !permissionsFor(actingStaff?.roles).includes("tickets.assign")) throw new ApiError("Only the assigned agent or supervisor may resume this conversation.", 403);
      after = { ...before, handoffRequested: false };
    } else if (action === "support.ai.configure") {
      const next = validateSupportConfiguration(data);
      const presence = runtimePresence(next);
      if (next.enabled && (!presence.operatorEnabled || !presence.configurationValid)) throw new ApiError("Server provider configuration is not ready. The secret and approved endpoint must be configured on the server.", 409);
      after = { ...next, revision: (before?.revision ?? 0) + 1, updatedAt: now, updatedBy: u.id };
    } else if (action === "support.knowledge.save") {
      only(data, ["title", "content"]);
      after = { title: bounded(data.title, 120), content: bounded(data.content, 4e3), status: "draft", reviewed: false, revision: (before?.revision ?? 0) + 1, updatedAt: now, updatedBy: u.id };
    } else {
      only(data, ["previewRevision", "reviewed"]);
      if (!before) throw new ApiError("Knowledge document not found", 404);
      if (data.previewRevision !== before.revision) throw new ApiError("Review the current document revision first.", 409);
      if (action === "support.knowledge.publish" && data.reviewed !== true) throw new ApiError("Explicit reviewed confirmation is required.");
      after = { ...before, status: action === "support.knowledge.publish" ? "published" : "draft", reviewed: action === "support.knowledge.publish", revision: before.revision + 1, updatedAt: now, updatedBy: u.id };
    }
    if (action === "support.ai.resume") tx.update(record, { handoffRequested: false, updatedAt: Timestamp.fromMillis(now) });
    else tx.set(record, after);
    output = { saved: true, target, revision: after.revision ?? 0 };
    const auditBefore = action === "support.ai.configure" ? before ? configSummary(before) : null : action === "support.ai.resume" ? { handoffRequested: before?.handoffRequested } : summary(before), auditAfter = action === "support.ai.configure" ? configSummary(after) : action === "support.ai.resume" ? { handoffRequested: false } : summary(after);
    controlAudit(tx, randomUUID2(), u, action, target, reason, auditBefore, auditAfter, requestId);
    tx.create(command, { adminId: u.id, action, fingerprint, result: output, createdAt: now });
  });
  return output;
}
export {
  SUPPORT_AI_DEFAULTS,
  db,
  readSupportAdmin,
  supportAdminAction,
  validateSupportConfiguration
};
