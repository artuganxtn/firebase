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
async function check(tx, u, admin = false) {
  const profile = (await tx.get(ref("users", u.id))).data();
  if (admin && (await tx.get(ref("system", "control-center"))).exists) {
    active(profile, u);
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
  operations: { name: "Operations", permissions: ["tickets.read", "tickets.manage", "tickets.assign", "dashboard.read", "users.read", "users.manage", "accounts.read", "accounts.manage", "trading.read", "markets.manage", "programs.read", "referrals.review", "agencies.manage", "badges.grant", "notifications.manage", "reports.export"] },
  content_manager: { name: "Content Manager", permissions: ["dashboard.read", "content.manage", "content.publish", "notifications.manage"] },
  auditor: { name: "Auditor", permissions: ["tickets.read", "dashboard.read", "users.read", "accounts.read", "wallet.read", "finance.read", "trading.read", "programs.read", "audit.read", "security.read", "reports.export"] }
};

// firebase-functions/src/control-auth.ts
var controlRef = (kind, id) => ref("orinControl" + kind, id);
function controlAudit(tx, id, u, action, target, reason, before, after, referenceId) {
  tx.create(controlRef("Audit", id), { adminId: u.id, action, target, timestamp: Date.now(), reason, previous: before ?? null, next: after ?? null, requestId: referenceId, referenceId, payloadHash: hash(JSON.stringify({ action, target, before, after, referenceId })) });
}
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

// firebase-functions/src/programs.ts
import { randomBytes } from "node:crypto";

// lib/programs.ts
var TEAM_LEVELS = [
  { level: 1, direct: 3, active: 3, bps: 75, capCents: 2e3 },
  { level: 2, direct: 5, active: 15, bps: 125, capCents: 6e3 },
  { level: 3, direct: 8, active: 40, bps: 175, capCents: 15e3 },
  { level: 4, direct: 10, active: 120, bps: 225, capCents: 35e3 },
  { level: 5, direct: 15, active: 300, bps: 275, capCents: 75e3 },
  { level: 6, direct: 25, active: 700, bps: 325, capCents: 15e4 }
];
var BADGES = [
  { id: "new_user", name: "New User", ar: "\u0639\u0636\u0648 \u062C\u062F\u064A\u062F", metal: "silver" },
  { id: "verified", name: "Verified", ar: "\u0645\u0648\u062B\u0651\u0642", metal: "blue" },
  { id: "first_deposit", name: "First Deposit", ar: "\u0623\u0648\u0644 \u0625\u064A\u062F\u0627\u0639", metal: "blue" },
  { id: "trader", name: "Trader", ar: "\u0645\u062A\u062F\u0627\u0648\u0644", metal: "blue" },
  { id: "top_referrer", name: "Top Referrer", ar: "\u062F\u0627\u0639\u064D \u0645\u062A\u0645\u064A\u0632", metal: "gold" },
  { id: "team_leader", name: "Team Leader", ar: "\u0642\u0627\u0626\u062F \u0641\u0631\u064A\u0642", metal: "gold" },
  { id: "loyal_member", name: "Loyal Member", ar: "\u0639\u0636\u0648 \u0648\u0641\u064A\u0651", metal: "silver" },
  { id: "elite", name: "Elite", ar: "\u0627\u0644\u0646\u062E\u0628\u0629", metal: "platinum" },
  { id: "legend", name: "Legend", ar: "\u0627\u0644\u0623\u0633\u0637\u0648\u0631\u0629", metal: "platinum" }
];
var DEFAULT_PROGRAM_CONFIG = { bonusAmountCents: 1e4, referralAmountCents: 8e3, firstDepositCents: 5e4, requireKyc: true, levels: TEAM_LEVELS.map((l) => ({ ...l })), enabled: false, termsVersion: null, referralCriteria: null, activeTeamCriteria: null, activityPeriod: null, bonusDurationDays: null, eligibleAssets: null, bonusProfitLimitCents: null, bonusTradingTerms: null, agencyCriteria: null, badgeCriteria: {}, revision: 0 };

// firebase-functions/src/programs.ts
var member = (uid) => ref("orinProgramMembers", uid);
var configRef = () => ref("orinProgramConfiguration", "current");
var accountRef = (uid, id) => db.doc(`sparkTradingAccounts/${uid}/accounts/${id}`);
var money = (n) => Number.isSafeInteger(n) && Number(n) >= 0 && Number(n) <= Number.MAX_SAFE_INTEGER / 4;
function validConfig(v) {
  const p = { ...DEFAULT_PROGRAM_CONFIG, ...v };
  if (Object.keys(v).some((k) => !Object.hasOwn(DEFAULT_PROGRAM_CONFIG, k)) || typeof p.enabled !== "boolean" || !Number.isInteger(p.revision) || p.revision < 0) throw new ApiError("Invalid program settings");
  for (const k of ["termsVersion", "referralCriteria", "activeTeamCriteria", "activityPeriod", "bonusTradingTerms", "agencyCriteria"]) if (p[k] !== null && (typeof p[k] !== "string" || !p[k].trim() || p[k].length > 2e3)) throw new ApiError("Invalid terms");
  if (p.bonusDurationDays !== null && (!Number.isInteger(p.bonusDurationDays) || p.bonusDurationDays <= 0)) throw new ApiError("Invalid duration");
  if (p.bonusProfitLimitCents !== null && !money(p.bonusProfitLimitCents)) throw new ApiError("Invalid profit limit");
  if (p.eligibleAssets !== null && (!Array.isArray(p.eligibleAssets) || !p.eligibleAssets.length || p.eligibleAssets.some((x) => typeof x !== "string" || !/^[A-Z0-9-]{3,20}$/.test(x)))) throw new ApiError("Invalid eligible assets");
  if (!p.badgeCriteria || typeof p.badgeCriteria !== "object" || Array.isArray(p.badgeCriteria) || Object.entries(p.badgeCriteria).some(([k, x]) => !BADGES.some((b) => b.id === k) || typeof x !== "string" || x.length > 2e3)) throw new ApiError("Invalid badge criteria");
  for (const key2 of ["bonusAmountCents", "referralAmountCents", "firstDepositCents"]) if (!money(p[key2]) || p[key2] <= 0) throw new ApiError("Invalid program amount");
  if (p.requireKyc !== true) throw new ApiError("Required verification cannot be bypassed");
  if (!Array.isArray(p.levels) || p.levels.length !== 6 || p.levels.some((l, i) => l.level !== i + 1 || !Number.isInteger(l.direct) || l.direct < 1 || !Number.isInteger(l.active) || l.active < l.direct || !Number.isInteger(l.bps) || l.bps < 0 || l.bps > 1e4 || !money(l.capCents) || i > 0 && (l.direct < p.levels[i - 1].direct || l.active < p.levels[i - 1].active))) throw new ApiError("Invalid L1-L6 definition");
  if (p.enabled && ["termsVersion", "referralCriteria", "activeTeamCriteria", "activityPeriod", "bonusTradingTerms", "agencyCriteria", "bonusDurationDays", "bonusProfitLimitCents", "eligibleAssets"].some((k) => p[k] === null)) throw new ApiError("\u0627\u0639\u062A\u0645\u062F \u062C\u0645\u064A\u0639 \u0634\u0631\u0648\u0637 \u0627\u0644\u0628\u0631\u0646\u0627\u0645\u062C \u0642\u0628\u0644 \u0627\u0644\u062A\u0641\u0639\u064A\u0644. / Complete program terms before activation.", 409);
  return p;
}
function enabled(c) {
  const p = validConfig(c ?? {});
  if (!p.enabled) throw new ApiError("\u0627\u0644\u0628\u0631\u0646\u0627\u0645\u062C \u063A\u064A\u0631 \u0645\u0641\u0639\u0651\u0644 \u0628\u0639\u062F. / Program is not active.", 409);
  return p;
}
function cleanKey(v) {
  if (typeof v !== "string" || !/^[-a-zA-Z0-9_]{1,128}$/.test(v)) throw new ApiError("Invalid reference");
  return v;
}
function requireReal(a, uid) {
  if (!a || a.ownerId !== uid || a.type !== "real" || a.currency !== "USD") throw new ApiError("\u0627\u062E\u062A\u0631 \u062D\u0633\u0627\u0628\u064B\u0627 \u062D\u0642\u064A\u0642\u064A\u064B\u0627 \u0628\u0627\u0644\u062F\u0648\u0644\u0627\u0631. / Select a real USD account.", 409);
  return a;
}
function ledger(tx, key2, uid, accountId, kind, cents, now) {
  if (!Number.isSafeInteger(cents)) throw new ApiError("Invalid ledger amount");
  tx.create(ref("orinProgramLedger", key2), { uid, accountId, kind, entries: [{ account: `customer:${uid}:${accountId}`, cents }, { account: `program:${kind}`, cents: -cents }], createdAt: now });
}
async function programSummary(u) {
  const [config, m, b, children, rewards] = await Promise.all([configRef().get(), member(u.id).get(), ref("orinBonusWallets", u.id).get(), db.collection("orinProgramMembers").where("ancestors", "array-contains", u.id).limit(101).get(), db.collection("orinReferralRewards").where("referrerId", "==", u.id).limit(100).get()]);
  const c = validConfig(config.data() ?? {}), d = m.data(), wallet = b.data();
  const accounts = wallet ? await accountRef(u.id, wallet.accountId).get() : null;
  const rows = children.docs.slice(0, 100).map((x) => ({ uid: x.id, ...x.data() })).sort((a, b2) => a.ancestors.length - b2.ancestors.length || a.referralId.localeCompare(b2.referralId));
  return { available: true, config: c, member: d ? { referralId: d.referralId, code: d.code, agencyId: d.agencyId ?? null, agencyGranted: d.agencyGranted === true, badges: d.badges ?? [], direct: d.directCount ?? 0, activeTeam: d.activeTeamCount ?? 0, team: d.teamCount ?? 0, qualified: d.qualifiedCount ?? 0, paidCents: d.paidCents ?? 0, pendingCents: d.pendingCents ?? 0, activityRewardCents: d.activityRewardCents ?? 0 } : null, bonus: wallet ? { firstDepositCents: wallet.firstDepositCents ?? 5e4, termsVersion: wallet.termsVersion, accountId: wallet.accountId, cashCents: accounts?.data()?.balanceCents ?? 0, bonusCents: wallet.bonusCents, profitCents: wallet.profitCents, withdrawableProfitCents: wallet.withdrawableProfitCents, qualifiedDepositCents: wallet.qualifiedDepositCents, claimed: wallet.claimed, eligible: true } : null, tree: rows.map((x) => ({ id: x.referralId, parentId: x.parentReferralId ?? null, depth: x.ancestors.length - x.ancestors.indexOf(u.id), status: x.referralStatus ?? "pending" })), rewards: rewards.docs.map((x) => ({ id: x.id, status: x.data().status, amountCents: x.data().amountCents })), truncated: children.size > 100 };
}
async function programAction(u, input) {
  const action = input.action, requestId = cleanKey(input.requestId), now = Date.now();
  if (!["enroll", "claim_bonus"].includes(action)) throw new ApiError("Invalid program action");
  const request = ref("orinProgramCommands", hash(u.id + ":" + requestId)), fingerprint = hash(JSON.stringify(input));
  const generatedCode = "ORIN-" + randomBytes(6).toString("hex").toUpperCase();
  await db.runTransaction(async (tx) => {
    await check(tx, u);
    await controlAccess(u, true, tx);
    const operational = (await tx.get(ref("orinControlConfiguration", "current"))).data();
    if (operational && (action === "enroll" && !operational.referralsEnabled || action === "claim_bonus" && !operational.bonusEnabled)) throw new ApiError("Program feature is disabled", 409);
    const old = await tx.get(request);
    if (old.exists) {
      if (old.data().fingerprint !== fingerprint) throw new ApiError("Request already used", 409);
      return;
    }
    const c = enabled((await tx.get(configRef())).data()), m = await tx.get(member(u.id));
    if (action === "enroll") {
      if (m.exists) throw new ApiError("\u0639\u0636\u0648\u064A\u062A\u0643 \u0645\u0648\u062C\u0648\u062F\u0629 \u0628\u0627\u0644\u0641\u0639\u0644. / Already enrolled.", 409);
      const identity = await tx.get(ref("orinReferralIdentities", u.id)), code = identity.data()?.code ?? generatedCode;
      const codeDoc = ref("orinReferralCodes", code), claim = await tx.get(codeDoc);
      if (claim.exists && claim.data()?.uid !== u.id) throw new ApiError("Retry enrollment", 409);
      const attribution = (await tx.get(ref("orinReferralAttributions", u.id))).data();
      if (attribution?.code && input.referralCode && input.referralCode !== attribution.code) throw new ApiError("Referral attribution is already recorded", 409);
      const referralCode = attribution?.code ?? input.referralCode;
      let parent, parentUid = null;
      let ancestors = [];
      if (referralCode) {
        if (typeof referralCode !== "string" || !/^ORIN-[A-F0-9]{12}$/.test(referralCode)) throw new ApiError("Invalid referral code");
        const sponsor = (await tx.get(ref("orinReferralCodes", referralCode))).data();
        if (!sponsor || sponsor.uid === u.id) throw new ApiError("Self referral or unknown code", 409);
        parentUid = sponsor.uid;
        parent = (await tx.get(member(parentUid))).data();
        if (!parent || parent.ancestors.includes(u.id) || parent.ancestors.length >= 32) throw new ApiError("Invalid referral path");
        ancestors = [...parent.ancestors, parentUid];
      }
      const parentDocs = await Promise.all(ancestors.map((id) => tx.get(member(id))));
      tx.create(member(u.id), { uid: u.id, referralId: code, code, parentUid, parentReferralId: parent?.referralId ?? null, ancestors, referralStatus: "pending", badges: ["new_user"], agencyGranted: false, agencyId: null, directCount: 0, teamCount: 0, activeTeamCount: 0, qualifiedCount: 0, paidCents: 0, pendingCents: 0, activityRewardCents: 0, createdAt: now, termsVersion: c.termsVersion });
      if (!claim.exists) tx.create(codeDoc, { uid: u.id });
      parentDocs.forEach((p) => tx.update(p.ref, { teamCount: (p.data().teamCount ?? 0) + 1, ...p.id === parentUid ? { directCount: (p.data().directCount ?? 0) + 1 } : {} }));
      if (parentUid) tx.create(ref("orinReferralRewards", u.id), { referrerId: parentUid, referredId: u.id, status: "pending", amountCents: c.referralAmountCents, createdAt: now, termsVersion: c.termsVersion, configurationRevision: c.revision });
    } else {
      if (!m.exists) throw new ApiError("Enroll first", 409);
      const id = cleanKey(input.accountId);
      await controlAccess(u, true, tx);
      await controlAccount(u.id, id, tx);
      const a = requireReal((await tx.get(accountRef(u.id, id))).data(), u.id), v = (await tx.get(ref("orinVerifiedCustomers", u.id))).data();
      if (!v?.verified || v.revoked || !v.customerKey) throw new ApiError("\u0627\u0644\u062A\u062D\u0642\u0642 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644. / Required verification is incomplete.", 409);
      const claim = ref("orinBonusClaims", v.customerKey), wallet = ref("orinBonusWallets", u.id);
      if ((await tx.get(claim)).exists || (await tx.get(wallet)).exists) throw new ApiError("\u0627\u0644\u0628\u0648\u0646\u0635 \u0645\u0631\u0629 \u0648\u0627\u062D\u062F\u0629 \u0644\u0643\u0644 \u0639\u0645\u064A\u0644. / Bonus already claimed.", 409);
      const funding = (await tx.get(ref("orinQualifiedDeposits", u.id))).data();
      tx.create(claim, { uid: u.id, accountId: id, createdAt: now });
      tx.create(wallet, { uid: u.id, accountId: id, bonusCents: c.bonusAmountCents, firstDepositCents: c.firstDepositCents, configurationRevision: c.revision, profitCents: 0, withdrawableProfitCents: 0, qualifiedDepositCents: (funding?.cents ?? 0) >= c.firstDepositCents ? funding?.cents : 0, claimed: true, claimedAt: now, expiresAt: now + c.bonusDurationDays * 864e5, termsVersion: c.termsVersion, eligibleAssets: c.eligibleAssets, profitLimitCents: c.bonusProfitLimitCents, tradingTerms: c.bonusTradingTerms });
      ledger(tx, "bonus-" + hash(u.id), u.id, id, "nonwithdrawable_bonus", c.bonusAmountCents, now);
    }
    tx.create(request, { fingerprint, uid: u.id, action, createdAt: now });
    audit(tx, "program-" + request.id, u.id, action, u.id, { requestId, termsVersion: c.termsVersion }, now);
  });
  return programSummary(u);
}
async function adminPrograms(u, input) {
  if (!input) {
    await db.runTransaction((tx) => check(tx, u, true));
    const [c, r, m, a] = await Promise.all([configRef().get(), db.collection("orinReferralRewards").limit(100).get(), db.collection("orinProgramMembers").limit(100).get(), db.collection("orinAudit").orderBy("created_at", "desc").limit(50).get()]);
    return { configuration: validConfig(c.data() ?? {}), rewards: r.docs.map((x) => ({ id: x.id, ...x.data() })), members: m.docs.map((x) => ({ id: x.id, ...x.data() })), audit: a.docs.map((x) => x.data()) };
  }
  const requestId = cleanKey(input.requestId), command = ref("orinProgramCommands", "admin-" + hash(u.id + requestId)), fingerprint = hash(JSON.stringify(input)), now = Date.now();
  await db.runTransaction(async (tx) => {
    await check(tx, u, true);
    const used = await tx.get(command);
    if (used.exists) {
      if (used.data().fingerprint !== fingerprint) throw new ApiError("Request already used", 409);
      return;
    }
    const cfg = (await tx.get(configRef())).data() ?? DEFAULT_PROGRAM_CONFIG;
    if (input.action === "configure") {
      if (input.revision !== cfg.revision) throw new ApiError("Settings changed; reload", 409);
      const next = validConfig({ ...input.configuration, revision: cfg.revision + 1 });
      if (next.termsVersion === cfg.termsVersion && JSON.stringify(next) !== JSON.stringify({ ...cfg, revision: next.revision })) throw new ApiError("Use a new terms version for changed entitlements", 409);
      tx.create(ref("orinProgramConfigurationHistory", String(next.revision)), { ...next, adminId: u.id, reason: input.reason ?? "Legacy configuration", effectiveAt: now });
      tx.set(configRef(), next);
      controlAudit(tx, "program-config-" + command.id, u, "program.configure", "programs", input.reason ?? "Legacy configuration", cfg, next, requestId);
    } else {
      const c = enabled(cfg), target = cleanKey(input.uid), m = (await tx.get(member(target))).data();
      if (!m) throw new ApiError("Unknown program member");
      if (input.action === "agency") {
        if (typeof input.grant !== "boolean" || typeof input.reason !== "string" || !input.reason.trim()) throw new ApiError("Grant and review reason required");
        tx.update(member(target), { agencyGranted: input.grant, agencyId: m.agencyId ?? "AG-" + randomBytes(6).toString("hex").toUpperCase(), agencyReason: input.reason, agencyGrantedBy: u.id, agencyUpdatedAt: now });
      } else if (input.action === "badge") {
        const badge = BADGES.find((b) => b.id === input.badge);
        if (!badge || ["new_user", "verified", "first_deposit", "trader"].includes(badge.id) || !c.badgeCriteria[badge.id]) throw new ApiError("Badge requires approved criteria or automatic server evidence", 409);
        const e = (await tx.get(ref("orinProgramEvidence", cleanKey(input.evidenceId)))).data();
        if (!e || e.uid !== target || e.kind !== "badge" || e.badge !== badge.id || e.termsVersion !== c.termsVersion || e.revoked) throw new ApiError("Trusted badge evidence required", 409);
        tx.update(member(target), { badges: [.../* @__PURE__ */ new Set([...m.badges ?? [], badge.id])] });
      } else if (input.action === "referral") {
        const rr = ref("orinReferralRewards", target), r = (await tx.get(rr)).data();
        if (!r) throw new ApiError("Unknown referral");
        const parent = member(r.referrerId), p = (await tx.get(parent)).data();
        if (input.status === "qualified" && r.status === "pending") {
          const [v, pv, e] = await Promise.all([tx.get(ref("orinVerifiedCustomers", target)), tx.get(ref("orinVerifiedCustomers", r.referrerId)), tx.get(ref("orinProgramEvidence", cleanKey(input.evidenceId)))]);
          if (!v.data()?.verified || v.data()?.revoked || !pv.data()?.verified || pv.data()?.revoked || v.data().customerKey === pv.data().customerKey || !e.exists || e.data().uid !== target || e.data().kind !== "referral_qualified" || e.data().revoked || e.data().termsVersion !== c.termsVersion) throw new ApiError("Verified distinct customers and eligibility evidence required", 409);
          tx.update(rr, { status: "qualified", evidenceId: input.evidenceId, qualifiedAt: now });
          tx.update(member(target), { referralStatus: "qualified" });
          tx.update(parent, { qualifiedCount: (p.qualifiedCount ?? 0) + 1, pendingCents: (p.pendingCents ?? 0) + (r.amountCents ?? 8e3) });
        } else if (input.status === "rejected" && ["pending", "qualified"].includes(r.status)) {
          if (typeof input.reason !== "string" || !input.reason.trim()) throw new ApiError("Rejection reason required");
          tx.update(rr, { status: "rejected", reason: input.reason, updatedAt: now });
          tx.update(member(target), { referralStatus: "rejected" });
          if (r.status === "qualified") tx.update(parent, { qualifiedCount: p.qualifiedCount - 1, pendingCents: p.pendingCents - (r.amountCents ?? 8e3) });
        } else if (input.status === "paid" && r.status === "qualified") {
          const id = cleanKey(input.accountId), a = accountRef(r.referrerId, id), data = requireReal((await tx.get(a)).data(), r.referrerId), pv = (await tx.get(ref("orinVerifiedCustomers", r.referrerId))).data(), cv = (await tx.get(ref("orinVerifiedCustomers", target))).data(), e = (await tx.get(ref("orinProgramEvidence", r.evidenceId))).data();
          if (!pv?.verified || pv.revoked || !cv?.verified || cv.revoked || !e || e.revoked || e.termsVersion !== c.termsVersion) throw new ApiError("Eligibility changed; review again", 409);
          if (!money(data.balanceCents + (r.amountCents ?? 8e3))) throw new ApiError("Invalid balance");
          tx.update(a, { balanceCents: data.balanceCents + (r.amountCents ?? 8e3) });
          tx.update(rr, { status: "paid", accountId: id, paidAt: now });
          tx.update(member(target), { referralStatus: "paid" });
          tx.update(parent, { paidCents: (p.paidCents ?? 0) + (r.amountCents ?? 8e3), pendingCents: p.pendingCents - (r.amountCents ?? 8e3) });
          ledger(tx, "referral-" + target, r.referrerId, id, "referral_reward", r.amountCents ?? 8e3, now);
        } else throw new ApiError("Invalid reward transition", 409);
      } else if (input.action === "activity_reward") {
        const period = cleanKey(input.periodId), revenue = (await tx.get(ref("orinEligibleRevenue", target + "_" + period))).data(), pay = ref("orinActivityPayments", target + "_" + period), previous = await tx.get(pay);
        if (previous.exists || !revenue || revenue.uid !== target || !revenue.finalized || !money(revenue.netRevenueCents) || !Number.isInteger(revenue.direct) || !Number.isInteger(revenue.activeTeam)) throw new ApiError("Finalized eligible net revenue required", 409);
        const version = revenue.configurationRevision ? validConfig((await tx.get(ref("orinProgramConfigurationHistory", String(revenue.configurationRevision)))).data() ?? {}) : c;
        if (version.termsVersion !== revenue.termsVersion) throw new ApiError("Historical terms mismatch", 409);
        const level = [...version.levels].reverse().find((l) => revenue.direct >= l.direct && revenue.activeTeam >= l.active);
        if (!level) throw new ApiError("No eligible team level", 409);
        const cents = Math.min(level.capCents, Number(BigInt(revenue.netRevenueCents) * BigInt(level.bps) / BigInt(1e4))), id = cleanKey(input.accountId), a = accountRef(target, id), data = requireReal((await tx.get(a)).data(), target);
        if (cents <= 0 || !money(data.balanceCents + cents)) throw new ApiError("No payable activity reward", 409);
        tx.update(a, { balanceCents: data.balanceCents + cents });
        tx.create(pay, { uid: target, periodId: period, netRevenueCents: revenue.netRevenueCents, cents, level: level.level, createdAt: now });
        tx.update(member(target), { activityRewardCents: (m.activityRewardCents ?? 0) + cents });
        ledger(tx, "activity-" + target + "_" + period, target, id, "team_activity", cents, now);
      } else throw new ApiError("Invalid admin action");
    }
    tx.create(command, { fingerprint, action: input.action, createdAt: now });
    audit(tx, "program-" + command.id, u.id, "PROGRAM_" + input.action, input.uid ?? "configuration", { ...input, requestId }, now);
  });
  return adminPrograms(u);
}
async function accountActivity(u, accountId) {
  const id = cleanKey(accountId);
  requireReal((await accountRef(u.id, id).get()).data(), u.id);
  const rows = await db.collection("orinProgramLedger").where("uid", "==", u.id).where("accountId", "==", id).orderBy("createdAt", "desc").limit(100).get();
  return { accountId: id, ledger: rows.docs.flatMap((row) => {
    const d = row.data();
    return d.entries.map((e, i) => ({ id: row.id + ":" + i, journal_id: row.id, accountId: id, account: e.account, amount_cents: e.cents, kind: d.kind, effective_at: d.createdAt }));
  }) };
}

// firebase-functions/src/program-ingestion.ts
var key = (s) => {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(s)) throw new ApiError("Invalid trusted event id");
  return s;
};
var validMoney = (n) => Number.isSafeInteger(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER / 4;
async function recordVerifiedCustomer(uid, customerKey, eventId) {
  key(uid);
  key(eventId);
  if (!/^[a-f0-9]{64}$/.test(customerKey)) throw new ApiError("Use an irreversible provider customer fingerprint");
  await db.runTransaction(async (tx) => {
    const event = ref("orinTrustedEvents", eventId), v = ref("orinVerifiedCustomers", uid), unique = ref("orinCustomerRegistry", customerKey), member2 = ref("orinProgramMembers", uid);
    const [old, owner2, m] = await Promise.all([tx.get(event), tx.get(unique), tx.get(member2)]);
    const fingerprint = hash(JSON.stringify({ uid, customerKey }));
    if (old.exists) {
      if (old.data().fingerprint !== fingerprint) throw new ApiError("Event conflict", 409);
      return;
    }
    if (owner2.exists && owner2.data().uid !== uid) throw new ApiError("Duplicate customer", 409);
    const existing = await tx.get(v);
    if (existing.exists && existing.data().customerKey !== customerKey) throw new ApiError("Verification identity changed; review required", 409);
    tx.set(unique, { uid });
    tx.set(v, { uid, customerKey, verified: true, revoked: false, eventId });
    if (m.exists) tx.update(member2, { badges: [.../* @__PURE__ */ new Set([...m.data().badges ?? [], "verified"])] });
    tx.create(event, { fingerprint, type: "verification", uid });
    audit(tx, "trusted-" + eventId, "provider", "CUSTOMER_VERIFIED", uid, { eventId }, Date.now());
  });
}
async function recordConfirmedDeposit(e) {
  key(e.eventId);
  key(e.uid);
  key(e.accountId);
  if (e.currency !== "USD" || !validMoney(e.cents) || e.cents === 0 || typeof e.eligible !== "boolean") throw new ApiError("Invalid confirmed deposit");
  await db.runTransaction(async (tx) => {
    const event = ref("orinTrustedEvents", e.eventId), a = db.doc(`sparkTradingAccounts/${e.uid}/accounts/${e.accountId}`), b = ref("orinBonusWallets", e.uid), fund = ref("orinQualifiedDeposits", e.uid), m = ref("orinProgramMembers", e.uid);
    const [old, acc, bonus, first, member2, profile, access] = await Promise.all([tx.get(event), tx.get(a), tx.get(b), tx.get(fund), tx.get(m), tx.get(ref("users", e.uid)), tx.get(ref("orinControlAccess", e.uid))]);
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
    if (member2.exists) tx.update(m, { badges: [.../* @__PURE__ */ new Set([...member2.data().badges ?? [], "first_deposit"])] });
    tx.create(event, { ...e, fingerprint, type: "deposit", status: "confirmed" });
    tx.create(ref("orinProgramLedger", "deposit-" + e.eventId), { uid: e.uid, accountId: e.accountId, kind: "deposit", entries: [{ account: "cash", cents: e.cents }, { account: "payment-clearing", cents: -e.cents }], createdAt: Date.now() });
    audit(tx, "trusted-" + e.eventId, "provider", "DEPOSIT_CONFIRMED", e.uid, { eventId: e.eventId, cents: e.cents, accountId: e.accountId }, Date.now());
  });
}
async function recordFinalBonusProfit(e) {
  key(e.eventId);
  key(e.uid);
  key(e.accountId);
  if (!validMoney(e.profitCents) || !Number.isSafeInteger(e.closedAt)) throw new ApiError("Invalid finalized net profit");
  await db.runTransaction(async (tx) => {
    const event = ref("orinTrustedEvents", e.eventId), b = ref("orinBonusWallets", e.uid), m = ref("orinProgramMembers", e.uid);
    const [old, w, member2, v] = await Promise.all([tx.get(event), tx.get(b), tx.get(m), tx.get(ref("orinVerifiedCustomers", e.uid))]);
    const fingerprint = hash(JSON.stringify(e));
    if (old.exists) {
      if (old.data().fingerprint !== fingerprint) throw new ApiError("Event conflict", 409);
      return;
    }
    const d = w.data();
    if (!d || d.accountId !== e.accountId || !v.data()?.verified || v.data()?.revoked || e.closedAt < d.claimedAt || e.closedAt > d.expiresAt || !d.eligibleAssets.includes(e.asset)) throw new ApiError("Trade not eligible", 409);
    const profit = d.profitCents + e.profitCents;
    if (!validMoney(profit) || profit > d.profitLimitCents) throw new ApiError("Configured profit cap exceeded; review required", 409);
    tx.update(b, { profitCents: profit, withdrawableProfitCents: d.qualifiedDepositCents >= (d.firstDepositCents ?? 5e4) ? profit : 0 });
    if (member2.exists) tx.update(m, { badges: [.../* @__PURE__ */ new Set([...member2.data().badges ?? [], "trader"])] });
    tx.create(event, { ...e, fingerprint, type: "bonus_profit" });
    tx.create(ref("orinProgramLedger", "profit-" + e.eventId), { uid: e.uid, accountId: e.accountId, kind: "bonus_profit", entries: [{ account: "bonus-profit", cents: e.profitCents }, { account: "broker-clearing", cents: -e.profitCents }], createdAt: Date.now() });
    audit(tx, "trusted-" + e.eventId, "broker", "BONUS_PROFIT_CONFIRMED", e.uid, { eventId: e.eventId, profitCents: e.profitCents }, Date.now());
  });
}
export {
  accountActivity,
  adminPrograms,
  db,
  hash,
  programAction,
  programSummary,
  recordConfirmedDeposit,
  recordFinalBonusProfit,
  recordVerifiedCustomer
};
