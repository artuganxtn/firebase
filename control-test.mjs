// lib/contracts.ts
var ASSETS = { XAUUSD: "\u0627\u0644\u0630\u0647\u0628 / \u0627\u0644\u062F\u0648\u0644\u0627\u0631", BTCUSD: "\u0628\u064A\u062A\u0643\u0648\u064A\u0646 / \u0627\u0644\u062F\u0648\u0644\u0627\u0631", ETHUSD: "\u0625\u064A\u062B\u0631\u064A\u0648\u0645 / \u0627\u0644\u062F\u0648\u0644\u0627\u0631" };
function resultCents(amount, bps) {
  return Math.sign(bps) * Math.round(amount * Math.abs(bps) / 1e4);
}

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
var hash = (text2) => createHash("sha256").update(text2).digest("hex");
var id = () => randomUUID();
var ref = (collection, key3) => db.collection(collection).doc(key3);
var account = (uid) => ref("orinAccounts", uid);
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
function journal(tx, key3, uid, kind, reference, entries, effective, now) {
  if (entries.some(([, v]) => !Number.isSafeInteger(v)) || entries.reduce((s, [, v]) => s + v, 0) !== 0) throw new ApiError("\u062A\u0639\u0630\u0631 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0642\u064A\u062F \u0627\u0644\u062D\u0633\u0627\u0628.", 409);
  tx.create(ref("orinJournals", key3), { id: key3, user_id: uid, kind, reference, effective_at: effective, created_at: now, status: "posted", entries: entries.filter(([, n]) => n !== 0).map(([account2, amount_cents], i) => ({ id: `${key3}:${i}`, journal_id: key3, account: account2, amount_cents, kind, effective_at: effective })) });
}
function audit(tx, key3, actor, action, reference, data, now) {
  const payload = JSON.stringify(data);
  tx.create(ref("orinAudit", key3), { id: key3, actor_id: actor, action, reference, payload, payload_hash: hash(payload), created_at: now });
}
function notice(tx, key3, uid, title, message, contractId, now, extra = {}) {
  tx.create(ref("orinNotices", key3), { id: key3, user_id: uid, title, message, contract_id: contractId, created_at: now, eligibility: "all", category: "", deep_link: contractId ? `/contracts/${contractId}` : "/notifications", expires_at: null, image: null, ...extra });
}
async function bootstrap(u, now = Date.now()) {
  await db.runTransaction(async (tx) => {
    const p = await check(tx, u);
    const a = await tx.get(account(u.id));
    if (a.exists) return;
    tx.create(account(u.id), { id: u.id, name: p.displayName, tier: "standard", accepted_at: null, seen_at: 0, balanceCents: 1e6, reservedCents: 0, realizedCents: 0, preferences: DEFAULT_PREFERENCES, profile: { displayName: p.displayName, phone: "", country: "", closureStatus: "open" }, revision: 0, created_at: now, updated_at: now });
    journal(tx, `fund:${u.id}`, u.id, "test_funding", "INITIAL-VIRTUAL-CAPITAL", [[`user:${u.id}:cash`, 1e6], ["system:virtual-capital", -1e6]], now, now);
    audit(tx, `fund:${u.id}`, u.id, "TEST_ACCOUNT_CREATED", u.id, { virtual: true, initialCents: 1e6 }, now);
  });
}

// firebase-functions/src/control-contracts.ts
async function applyContractAction(tx, u, action, target, payload, revision, now) {
  const r = ref("orinContracts", target), stateRef = ref("orinControlContractStates", target);
  const [existing, status] = await Promise.all([tx.get(r), tx.get(stateRef)]);
  if (action === "contract.revoke") {
    if (!existing.exists) throw new ApiError("Contract not found", 404);
    const before = status.data() ?? { status: "active", revision: 0 };
    if (before.revision !== revision || before.status !== "active") throw new ApiError("Contract changed", 409);
    const after2 = { status: "revoked", revision: before.revision + 1, updatedAt: now, updatedBy: u.id };
    tx.set(stateRef, after2);
    return { before, after: after2, output: { saved: true, contractId: target } };
  }
  if (existing.exists || revision !== 0) throw new ApiError("Contract already exists", 409);
  const { asset, direction, durationSec, settlementBps, opensAt, closesAt } = payload;
  const title = typeof payload.title === "string" ? payload.title.trim() : "", eligibility = payload.eligibility ?? "all";
  if (payload.mode !== "virtual-test-only" || !title || title.length > 80 || !Object.hasOwn(ASSETS, asset) || !["BUY", "SELL"].includes(direction)) throw new ApiError("Valid virtual contract terms are required");
  if (!Number.isSafeInteger(durationSec) || durationSec < 60 || durationSec > 300 || !Number.isSafeInteger(settlementBps) || Math.abs(settlementBps) > 1e3) throw new ApiError("Duration 60\u2013300 seconds; settlement \u221210% to +10%");
  if (!["all", "standard", "advanced"].includes(eligibility) || !Number.isSafeInteger(opensAt) || !Number.isSafeInteger(closesAt) || opensAt < now - 6e4 || closesAt <= Math.max(now, opensAt) || closesAt - opensAt > 30 * 864e5) throw new ApiError("Invalid participation window");
  const code = `LAB-${hash(target).slice(0, 10).toUpperCase()}`;
  if ((await tx.get(ref("orinCodes", code))).exists) throw new ApiError("Code collision; use a new request", 409);
  const terms = { version: 1, mode: "virtual-test-only", id: target, code, title, asset, direction, durationSec, settlementBps, eligibility, opensAt, closesAt, publishedAt: now, adminId: u.id };
  const canonical = JSON.stringify(terms), digest = hash(canonical);
  const after = { id: target, code, title, asset, direction, duration_sec: durationSec, settlement_bps: settlementBps, eligibility, opens_at: opensAt, closes_at: closesAt, published_at: now, admin_id: u.id, canonical, hash: digest, participants: 0 };
  tx.create(r, after);
  tx.create(ref("orinCodes", code), { contractId: target });
  tx.create(stateRef, { status: "active", revision: 0, updatedAt: now, updatedBy: u.id });
  return { before: null, after, output: { saved: true, contractId: target, code, hash: digest } };
}

// firebase-functions/src/control-operations.ts
import { FieldPath } from "firebase-admin/firestore";
import { randomUUID as randomUUID2 } from "node:crypto";

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
function permissionsFor(roles) {
  if (!Array.isArray(roles) || roles.some((r) => typeof r !== "string" || !Object.hasOwn(ROLES, r)))
    return [];
  return [...new Set(roles.flatMap((r) => ROLES[r].permissions))];
}
var CONTROL_MODULES = [
  ["dashboard", "\u0646\u0638\u0631\u0629 \u0639\u0627\u0645\u0629", "Dashboard", "dashboard.read"],
  ["users", "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u0648\u0646", "Users", "users.read"],
  ["kyc", "\u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0647\u0648\u064A\u0629", "KYC", "kyc.read"],
  ["accounts", "\u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A", "Accounts", "accounts.read"],
  ["wallets", "\u0627\u0644\u0623\u0631\u0635\u062F\u0629", "Wallets", "wallet.read"],
  ["deposits", "\u0627\u0644\u0625\u064A\u062F\u0627\u0639\u0627\u062A", "Deposits", "finance.read"],
  ["withdrawals", "\u0627\u0644\u0633\u062D\u0648\u0628\u0627\u062A", "Withdrawals", "finance.read"],
  ["approvals", "\u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0627\u062A \u0627\u0644\u0645\u0627\u0644\u064A\u0629", "Approvals", "finance.read"],
  ["trading", "\u0627\u0644\u062A\u062F\u0627\u0648\u0644", "Trading", "trading.read"],
  ["markets", "\u0627\u0644\u0623\u0633\u0648\u0627\u0642 \u0648\u0627\u0644\u0623\u0635\u0648\u0644", "Markets & assets", "markets.manage"],
  ["bonus", "\u0627\u0644\u0628\u0648\u0646\u0635 \u0627\u0644\u062A\u0631\u062D\u064A\u0628\u064A", "Welcome bonus", "programs.read"],
  ["referrals", "\u0627\u0644\u0625\u062D\u0627\u0644\u0627\u062A", "Referrals", "programs.read"],
  ["team", "\u0645\u0633\u062A\u0648\u064A\u0627\u062A \u0627\u0644\u0641\u0631\u064A\u0642", "Team levels", "programs.read"],
  ["agencies", "\u0627\u0644\u0648\u0643\u0644\u0627\u0621", "Agencies", "programs.read"],
  ["badges", "\u0627\u0644\u0634\u0627\u0631\u0627\u062A", "Badges", "programs.read"],
  ["notifications", "\u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062A", "Notifications", "notifications.manage"],
  ["content", "\u0627\u0644\u0645\u062D\u062A\u0648\u0649", "Content", "content.manage"],
  ["configuration", "\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u062A\u0637\u0628\u064A\u0642", "Configuration", "configuration.manage"],
  ["security", "\u0627\u0644\u0623\u0645\u0627\u0646", "Security", "security.read"],
  ["staff", "\u0627\u0644\u0645\u0648\u0638\u0641\u0648\u0646 \u0648\u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A", "Staff & roles", "staff.manage"],
  ["audit", "\u0633\u062C\u0644 \u0627\u0644\u062A\u062F\u0642\u064A\u0642", "Audit log", "audit.read"],
  ["tickets", "\u0645\u0631\u0643\u0632 \u0627\u0644\u062F\u0639\u0645", "Support desk", "tickets.read"],
  ["codes", "\u0623\u0643\u0648\u0627\u062F \u0627\u0644\u0639\u0642\u0648\u062F", "Contract codes", "trading.read"]
];
var CONTROL_DEFAULTS = { maintenance: false, messageAr: "\u0635\u064A\u0627\u0646\u0629 \u0645\u0624\u0642\u062A\u0629\u060C \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0644\u0627\u062D\u0642\u064B\u0627.", messageEn: "Scheduled maintenance. Please try again later.", minimumVersionCode: 1, supportEmail: "", supportUrl: "", tradingEnabled: false, depositsEnabled: false, withdrawalsEnabled: false, referralsEnabled: false, bonusEnabled: false, maxAdjustmentCents: null };
var ACTION_PERMISSIONS = { "contract.create": "contracts.manage", "contract.revoke": "contracts.manage", "ticket.create": "tickets.manage", "ticket.update": "tickets.manage", "ticket.note": "tickets.manage", "user.status": "users.manage", "kyc.review": "kyc.review", "account.create": "accounts.manage", "account.status": "accounts.manage", "reward.propose": "finance.propose", "finance.propose": "finance.propose", "finance.approve": "finance.approve", "finance.reject": "finance.approve", "payment.review": "finance.propose", "referral.review": "referrals.review", "agency.set": "agencies.manage", "badge.grant": "badges.grant", "content.save": "content.manage", "content.publish": "content.publish", "notification.save": "notifications.manage", "notification.publish": "notifications.manage", "market.save": "markets.manage", "configuration.save": "configuration.manage", "program.configure": "programs.configure", "staff.set": "staff.manage", "staff.invite": "staff.manage", "security.revoke": "security.revoke" };

// firebase-functions/src/control-auth.ts
var controlRef = (kind, id2) => ref("orinControl" + kind, id2);
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
function controlAudit(tx, id2, u, action, target, reason, before, after, referenceId) {
  tx.create(controlRef("Audit", id2), { adminId: u.id, action, target, timestamp: Date.now(), reason, previous: before ?? null, next: after ?? null, requestId: referenceId, referenceId, payloadHash: hash(JSON.stringify({ action, target, before, after, referenceId })) });
}
async function controlAccess(u, financial = false, tx) {
  const read = (r) => tx ? tx.get(r) : r.get();
  const [a, c, p] = await Promise.all([read(controlRef("Access", u.id)), read(controlRef("Configuration", "current")), read(ref("users", u.id))]);
  if (!p.exists || p.data()?.disabled || a.data()?.status === "suspended" || financial && a.data()?.status === "restricted")
    throw new ApiError("\u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u0642\u064A\u0651\u062F. / Account restricted.", 403);
  if (financial && c.data()?.maintenance)
    throw new ApiError("\u0627\u0644\u062E\u062F\u0645\u0629 \u0641\u064A \u0648\u0636\u0639 \u0627\u0644\u0635\u064A\u0627\u0646\u0629. / Maintenance.", 503);
}
async function controlAccount(uid, id2, tx) {
  const r = controlRef("AccountStates", hash(uid + ":" + id2)), s = await (tx ? tx.get(r) : r.get());
  if (s.data()?.status === "restricted")
    throw new ApiError("\u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0627\u0644\u064A \u0645\u0642\u064A\u0651\u062F. / Trading account restricted.", 403);
}

// lib/control-workflow.ts
var TICKET_STATUSES = {
  open: "\u0645\u0641\u062A\u0648\u062D\u0629",
  in_progress: "\u0642\u064A\u062F \u0627\u0644\u0645\u0639\u0627\u0644\u062C\u0629",
  waiting: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0645\u0639\u0644\u0648\u0645\u0627\u062A",
  resolved: "\u062A\u0645 \u0627\u0644\u062D\u0644",
  closed: "\u0645\u063A\u0644\u0642\u0629"
};
var TICKET_PRIORITIES = { low: "\u0645\u0646\u062E\u0641\u0636\u0629", normal: "\u0639\u0627\u062F\u064A\u0629", high: "\u0639\u0627\u0644\u064A\u0629", urgent: "\u0639\u0627\u062C\u0644\u0629" };
var TICKET_CATEGORIES = { account: "\u0627\u0644\u062D\u0633\u0627\u0628", technical: "\u0645\u0634\u0643\u0644\u0629 \u062A\u0642\u0646\u064A\u0629", identity: "\u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0647\u0648\u064A\u0629", payment: "\u0627\u0633\u062A\u0641\u0633\u0627\u0631 \u0645\u0627\u0644\u064A", other: "\u0623\u062E\u0631\u0649" };
var TICKET_TRANSITIONS = {
  open: ["in_progress", "waiting", "resolved"],
  in_progress: ["open", "waiting", "resolved"],
  waiting: ["open", "in_progress", "resolved"],
  resolved: ["open", "closed"],
  closed: ["open"]
};
var ACTIVE_TICKET_STATUSES = ["open", "in_progress", "waiting"];

// firebase-functions/src/control-operations.ts
var identifier = (v) => {
  if (typeof v !== "string" || !/^[-A-Za-z0-9_]{1,128}$/.test(v)) throw new ApiError("Invalid identifier");
  return v;
};
var bounded = (v, max) => {
  if (typeof v !== "string" || !v.trim() || v.length > max) throw new ApiError("Required text is invalid");
  return v.trim();
};
var enumValue = (v, values) => {
  if (typeof v !== "string" || !Object.hasOwn(values, v)) throw new ApiError("Invalid workflow value");
  return v;
};
var dueDate = (v) => {
  if (v === null || v === "") return null;
  if (!Number.isSafeInteger(v) || Number(v) < 0 || Number(v) > 864e13) throw new ApiError("Invalid due date");
  return Number(v);
};
var only = (data, fields) => {
  if (Object.keys(data).some((k) => !fields.includes(k))) throw new ApiError("Unsupported ticket field");
};
var summary = (d) => d ? Object.fromEntries(["uid", "status", "priority", "category", "assigneeId", "dueAt", "revision", "noteCount"].map((k) => [k, d[k] ?? null])) : null;
var ticketFields = ["uid", "title", "description", "status", "priority", "category", "assigneeId", "dueAt", "createdAt", "updatedAt", "createdBy", "updatedBy", "resolvedAt", "closedAt", "revision", "noteCount"];
var project = (d, fields) => Object.fromEntries(fields.filter((k) => d[k] !== void 0).map((k) => [k, d[k]]));
function applyCursor(query, raw, scope) {
  if (!raw) return query;
  try {
    if (typeof raw !== "string" || raw.length > 1e3 || !/^[\w-]+$/.test(raw)) throw new Error();
    const c = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (c.scope !== scope || !Number.isSafeInteger(c.at) || c.at < 0) throw new Error();
    return query.startAfter(c.at, identifier(c.id));
  } catch {
    throw new ApiError("Invalid or mismatched page cursor");
  }
}
function pageResult(page, timeField, scope, fields) {
  const docs = page.docs.slice(0, 50), last = docs.at(-1);
  return {
    rows: docs.map((d) => ({ id: d.id, ...project(d.data(), fields) })),
    nextCursor: page.size > 50 && last ? Buffer.from(JSON.stringify({ scope, at: last.data()[timeField], id: last.id })).toString("base64url") : null,
    asOf: Date.now()
  };
}
async function recordExport(u, module, result, filters) {
  await db.runTransaction(async (tx) => {
    await requirePermission(u, module === "tickets" ? "tickets.read" : "audit.read", tx);
    await requirePermission(u, "reports.export", tx, true);
    const requestId = randomUUID2();
    controlAudit(tx, requestId, u, "report.export", module, "Filtered administrative page export", null, { rows: result.rows.length, filters }, requestId);
  });
}
async function readTickets(u, q) {
  await requirePermission(u, "tickets.read");
  if (q.ticket) {
    if (q.export === "true") throw new ApiError("Export the ticket list instead");
    const id2 = identifier(q.ticket), ticket = await controlRef("Tickets", id2).get();
    if (!ticket.exists) throw new ApiError("Ticket not found", 404);
    const scope2 = hash("ticket-notes:" + id2);
    const query2 = controlRef("Tickets", id2).collection("notes").orderBy("createdAt", "desc").orderBy(FieldPath.documentId(), "desc");
    const page = pageResult(await applyCursor(query2, q.notesCursor, scope2).limit(51).get(), "createdAt", scope2, ["body", "authorId", "createdAt"]);
    return { ticket: { id: id2, ...project(ticket.data(), ticketFields) }, notes: page.rows, nextNotesCursor: page.nextCursor };
  }
  let query = db.collection("orinControlTickets");
  const filters = {};
  if (q.status && q.status !== "all") filters.status = q.status === "active" ? "active" : enumValue(q.status, TICKET_STATUSES);
  if (q.priority && q.priority !== "all") filters.priority = enumValue(q.priority, TICKET_PRIORITIES);
  if (q.assignee && q.assignee !== "all") {
    if (!["mine", "unassigned"].includes(q.assignee)) throw new ApiError("Invalid assignee filter");
    filters.assigneeId = q.assignee === "mine" ? u.id : "";
  }
  for (const [k, v] of Object.entries(filters)) query = k === "status" && v === "active" ? query.where(k, "in", ACTIVE_TICKET_STATUSES) : query.where(k, "==", v);
  const scope = hash(JSON.stringify(["tickets", filters]));
  query = query.orderBy("updatedAt", "desc").orderBy(FieldPath.documentId(), "desc");
  const result = pageResult(await applyCursor(query, q.cursor, scope).limit(51).get(), "updatedAt", scope, ticketFields.filter((k) => k !== "description"));
  if (q.export === "true") await recordExport(u, "tickets", result, filters);
  return result;
}
async function readAudit(u, q) {
  await requirePermission(u, "audit.read");
  let query = db.collection("orinControlAudit");
  const filters = {};
  for (const field of ["adminId", "action", "target"]) if (q[field]) {
    const value = bounded(q[field], field === "action" ? 100 : 128);
    if (!/^[-A-Za-z0-9_.:]+$/.test(value)) throw new ApiError("Invalid audit filter");
    filters[field] = value;
    query = query.where(field, "==", value);
  }
  for (const [name, op] of [["from", ">="], ["to", "<="]]) if (q[name] !== void 0 && q[name] !== "") {
    if (typeof q[name] !== "string" || !/^\d{1,16}$/.test(q[name])) throw new ApiError("Invalid date boundary");
    const value = Number(q[name]);
    if (!Number.isSafeInteger(value) || value > 864e13) throw new ApiError("Invalid date boundary");
    filters[name] = value;
    query = query.where("timestamp", op, value);
  }
  if (filters.from !== void 0 && filters.to !== void 0 && filters.from > filters.to) throw new ApiError("Start date must not follow end date");
  const scope = hash(JSON.stringify(["audit", filters]));
  query = query.orderBy("timestamp", "desc").orderBy(FieldPath.documentId(), "desc");
  const result = pageResult(await applyCursor(query, q.cursor, scope).limit(51).get(), "timestamp", scope, ["adminId", "action", "target", "timestamp", "reason", "previous", "next", "requestId", "referenceId"]);
  if (q.export === "true") await recordExport(u, "audit", result, filters);
  return result;
}
async function operationQueues(u, roles) {
  const permissions = permissionsFor(roles), queues = [];
  const definitions = [
    ["kyc", "\u0637\u0644\u0628\u0627\u062A \u0647\u0648\u064A\u0629 \u062A\u0646\u062A\u0638\u0631 \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629", "orinKycRequests", "kyc.read", ["pending", "review", "more_information"]],
    ["approvals", "\u0645\u0648\u0627\u0641\u0642\u0627\u062A \u0645\u0627\u0644\u064A\u0629 \u0645\u0639\u0644\u0651\u0642\u0629", "orinControlApprovals", "finance.read", ["pending"]],
    ["withdrawals", "\u0633\u062D\u0648\u0628\u0627\u062A \u062A\u0646\u062A\u0638\u0631 \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629", "orinControlWithdrawals", "finance.read", ["pending"]],
    ["tickets", "\u062A\u0630\u0627\u0643\u0631 \u062F\u0639\u0645 \u0645\u0641\u062A\u0648\u062D\u0629", "orinControlTickets", "tickets.read", ACTIVE_TICKET_STATUSES]
  ];
  for (const [module, label, collection, permission, states] of definitions) {
    if (!permissions.includes(permission)) continue;
    const count = async (query2) => {
      try {
        return (await query2.count().get()).data().count;
      } catch {
        return null;
      }
    };
    const query = db.collection(collection).where("status", "in", [...states]);
    queues.push({ id: module, module, label, count: await count(query) });
    if (module === "tickets") {
      queues.push({ id: "tickets_mine", module, label: "\u062A\u0630\u0627\u0643\u0631\u064A \u0627\u0644\u0645\u0641\u062A\u0648\u062D\u0629", assignee: "mine", count: await count(query.where("assigneeId", "==", u.id)) });
      queues.push({ id: "tickets_overdue", module, label: "\u062A\u0630\u0627\u0643\u0631 \u0645\u062A\u0623\u062E\u0631\u0629 \u0639\u0646 \u0627\u0644\u0645\u0648\u0639\u062F", count: await count(query.where("dueAt", ">", 0).where("dueAt", "<", Date.now())) });
    }
  }
  return queues;
}
async function applyTicketAction(tx, u, action, target, payload, revision, now, requestId) {
  const staff = await requirePermission(u, "tickets.manage", tx), canAssign = permissionsFor(staff.roles).includes("tickets.assign");
  const ticketRef = controlRef("Tickets", target), snapshot = await tx.get(ticketRef), before = snapshot.data();
  if (!Number.isSafeInteger(revision) || revision !== (before?.revision ?? 0)) throw new ApiError("Ticket changed; reload before saving", 409);
  let after;
  if (action === "ticket.create") {
    only(payload, ["uid", "title", "description", "category", "priority", "dueAt"]);
    if (before) throw new ApiError("Ticket already exists", 409);
    const uid = identifier(payload.uid);
    if (!(await tx.get(ref("users", uid))).exists) throw new ApiError("User not found", 404);
    after = { uid, title: bounded(payload.title, 160), description: bounded(payload.description, 4e3), category: enumValue(payload.category, TICKET_CATEGORIES), priority: enumValue(payload.priority, TICKET_PRIORITIES), dueAt: dueDate(payload.dueAt ?? null), status: "open", assigneeId: "", revision: 1, noteCount: 0, createdBy: u.id, updatedBy: u.id, createdAt: now, updatedAt: now, resolvedAt: null, closedAt: null };
    tx.create(ticketRef, after);
  } else {
    if (!before) throw new ApiError("Ticket not found", 404);
    if (action === "ticket.note") {
      only(payload, ["body"]);
      const body = bounded(payload.body, 4e3);
      after = { ...before, revision: before.revision + 1, noteCount: before.noteCount + 1, updatedAt: now, updatedBy: u.id };
      tx.create(ticketRef.collection("notes").doc(requestId), { body, authorId: u.id, createdAt: now });
    } else if (action === "ticket.update") {
      only(payload, ["status", "priority", "assigneeId", "dueAt"]);
      if (!canAssign && before.assigneeId && before.assigneeId !== u.id) throw new ApiError("Only the assigned agent or a supervisor may update this ticket", 403);
      const status = enumValue(payload.status, TICKET_STATUSES), priority = enumValue(payload.priority, TICKET_PRIORITIES);
      if (status !== before.status && !TICKET_TRANSITIONS[before.status]?.includes(status)) throw new ApiError("Invalid ticket status transition", 409);
      const assigneeId = payload.assigneeId === "" ? "" : identifier(payload.assigneeId);
      if (assigneeId !== before.assigneeId) {
        if (!canAssign && !(assigneeId === u.id && !before.assigneeId || !assigneeId && before.assigneeId === u.id)) throw new ApiError("Assignment permission required", 403);
      }
      if (assigneeId) {
        const [assignee, profile, gate] = await Promise.all([tx.get(ref("orinStaff", assigneeId)), tx.get(ref("users", assigneeId)), tx.get(controlRef("Access", assigneeId))]);
        if (assignee.data()?.status !== "active" || !profile.exists || profile.data()?.disabled || gate.data()?.status === "suspended" || assignee.data()?.email !== profile.data()?.email || !permissionsFor(assignee.data()?.roles).includes("tickets.manage")) throw new ApiError("Assignee must be active support staff", 409);
      }
      after = { ...before, status, priority, assigneeId, dueAt: dueDate(payload.dueAt ?? null), revision: before.revision + 1, updatedAt: now, updatedBy: u.id, resolvedAt: status === "resolved" ? before.resolvedAt ?? now : status === "closed" ? before.resolvedAt : null, closedAt: status === "closed" ? before.closedAt ?? now : null };
    } else throw new ApiError("Unsupported ticket action");
    tx.set(ticketRef, after);
  }
  return { before: summary(before), after: { ...summary(after), ...action === "ticket.note" ? { noteId: requestId } : {} }, output: { saved: true, ticketId: target, revision: after.revision } };
}

// firebase-functions/src/control-rewards.ts
var key = (v) => {
  if (typeof v !== "string" || !/^[-A-Za-z0-9_]{1,128}$/.test(v))
    throw new ApiError("Invalid reward identifier");
  return v;
};
async function rewardSnapshot(tx, p) {
  const kind = p.rewardKind;
  if (!["referral", "team"].includes(kind))
    throw new ApiError("Invalid reward kind");
  const rewardId = key(p.rewardId), rewardRef = ref(kind === "referral" ? "orinReferralRewards" : "orinEligibleRevenue", rewardId), reward = (await tx.get(rewardRef)).data();
  if (!reward)
    throw new ApiError("Reward evidence unavailable", 409);
  const config = (await tx.get(ref("orinProgramConfiguration", "current"))).data();
  if (!config?.enabled)
    throw new ApiError("Reward program is not active", 409);
  let cents, uid;
  if (kind === "referral") {
    if (reward.status !== "approved" || !reward.evidenceId)
      throw new ApiError("Approved referral and trusted evidence required", 409);
    uid = key(reward.referrerId);
    const [a, b, e] = await Promise.all([tx.get(ref("orinVerifiedCustomers", uid)), tx.get(ref("orinVerifiedCustomers", key(reward.referredId))), tx.get(ref("orinProgramEvidence", key(reward.evidenceId)))]);
    if (uid === reward.referredId || !a.data()?.verified || !b.data()?.verified || a.data()?.revoked || b.data()?.revoked || a.data()?.customerKey === b.data()?.customerKey || e.data()?.revoked || e.data()?.uid !== reward.referredId || e.data()?.kind !== "referral_qualified" || e.data()?.termsVersion !== reward.termsVersion)
      throw new ApiError("Referral evidence no longer valid", 409);
    cents = reward.amountCents;
  } else {
    uid = key(reward.uid);
    if (!reward.finalized || reward.paidAt || !Number.isSafeInteger(reward.netRevenueCents) || reward.netRevenueCents <= 0 || !Number.isInteger(reward.direct) || !Number.isInteger(reward.activeTeam) || !Number.isInteger(reward.configurationRevision))
      throw new ApiError("Finalized versioned net revenue required", 409);
    const version = (await tx.get(ref("orinProgramConfigurationHistory", String(reward.configurationRevision)))).data();
    if (!version || version.termsVersion !== reward.termsVersion)
      throw new ApiError("Historical program version is required", 409);
    const level = [...version.levels].reverse().find((l) => reward.direct >= l.direct && reward.activeTeam >= l.active);
    if (!level)
      throw new ApiError("No qualified team level", 409);
    cents = Math.min(level.capCents, Number(BigInt(reward.netRevenueCents) * BigInt(level.bps) / BigInt(1e4)));
  }
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 1e12)
    throw new ApiError("Invalid reward amount");
  const accountId = key(p.accountId), accountRef2 = db.doc(`sparkTradingAccounts/${uid}/accounts/${accountId}`), account2 = (await tx.get(accountRef2)).data(), memberRef = ref("orinProgramMembers", uid), member2 = (await tx.get(memberRef)).data();
  await controlAccess({ id: uid }, true, tx);
  await controlAccount(uid, accountId, tx);
  if (!member2 || !account2 || account2.ownerId !== uid || account2.type !== "real" || account2.currency !== "USD" || !Number.isSafeInteger(account2.balanceCents + cents))
    throw new ApiError("Eligible real USD wallet required", 409);
  return { kind, uid, cents, accountId, accountRef: accountRef2, account: account2, memberRef, member: member2, rewardRef, reward, rewardId };
}
async function settleReward(tx, before, approvalId, approver, now) {
  const s = await rewardSnapshot(tx, before);
  if (s.cents !== before.deltaCents || s.uid !== before.uid || s.account.balanceCents !== before.beforeCents || (s.reward.revision ?? null) !== before.rewardRevision)
    throw new ApiError("Reward or balance changed; propose again", 409);
  tx.update(s.accountRef, { balanceCents: s.account.balanceCents + s.cents });
  if (s.kind === "referral") {
    if ((s.member.pendingCents ?? 0) < s.cents)
      throw new ApiError("Reward aggregate requires reconciliation", 409);
    tx.update(s.rewardRef, { status: "paid", paidAt: now, accountId: s.accountId, approvalId, revision: (s.reward.revision ?? 0) + 1 });
    tx.update(ref("orinProgramMembers", s.reward.referredId), { referralStatus: "paid" });
    tx.update(s.memberRef, { pendingCents: s.member.pendingCents - s.cents, paidCents: (s.member.paidCents ?? 0) + s.cents });
  } else {
    tx.update(s.rewardRef, { paidAt: now, approvalId });
    tx.create(ref("orinActivityPayments", s.rewardId), { uid: s.uid, cents: s.cents, configurationRevision: s.reward.configurationRevision, netRevenueCents: s.reward.netRevenueCents, createdAt: now, approvalId });
    tx.update(s.memberRef, { activityRewardCents: (s.member.activityRewardCents ?? 0) + s.cents });
  }
  tx.create(ref("orinProgramLedger", "control-" + approvalId), { uid: s.uid, accountId: s.accountId, kind: s.kind === "referral" ? "referral_reward" : "team_activity", entries: [{ account: "cash", cents: s.cents }, { account: "program-expense", cents: -s.cents }], createdAt: now, requestedBy: before.requestedBy, approvedBy: approver, reference: before.reference, rewardId: s.rewardId });
}

// firebase-functions/src/control-center.ts
import { randomBytes, randomUUID as randomUUID3 } from "node:crypto";
import { FieldPath as FieldPath2, FieldValue as FieldValue2 } from "firebase-admin/firestore";

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

// firebase-functions/src/control-center.ts
var key2 = (v) => {
  if (typeof v !== "string" || !/^[-A-Za-z0-9_]{1,128}$/.test(v))
    throw new ApiError("Invalid identifier");
  return v;
};
var text = (v, max = 500) => {
  if (typeof v !== "string" || !v.trim() || v.length > max)
    throw new ApiError("\u0646\u0635 \u0645\u0637\u0644\u0648\u0628 \u0623\u0648 \u0637\u0648\u064A\u0644 \u062C\u062F\u064B\u0627. / Required text is invalid.");
  return v.trim();
};
var integer = (v, min = 0) => {
  if (!Number.isSafeInteger(v) || Number(v) < min || Number(v) > Number.MAX_SAFE_INTEGER)
    throw new ApiError("Invalid integer amount");
  return Number(v);
};
var safe = (v) => v?.toMillis ? v.toMillis() : Array.isArray(v) ? v.map(safe) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, safe(x)])) : v;
var pick = (data, fields) => Object.fromEntries(fields.filter((k) => data[k] !== void 0).map((k) => [k, safe(data[k])]));
var sources = {
  codes: ["orinContracts", ["code", "title", "asset", "direction", "duration_sec", "settlement_bps", "eligibility", "opens_at", "closes_at", "published_at", "hash", "admin_id"]],
  users: ["users", ["uid", "displayName", "email", "disabled", "createdAt"]],
  kyc: ["orinKycRequests", ["uid", "status", "createdAt", "updatedAt", "reviewedBy", "reason", "revision", "documentIds"]],
  wallets: ["orinBonusWallets", ["uid", "accountId", "bonusCents", "profitCents", "withdrawableProfitCents", "claimed", "expiresAt"]],
  deposits: ["orinDeposits", ["uid", "accountId", "amountCents", "coin", "status", "paymentId", "credited", "createdAt", "updatedAt", "reviewReason"]],
  withdrawals: ["orinControlWithdrawals", ["uid", "accountId", "currency", "cents", "status", "providerReference", "createdAt", "revision"]],
  approvals: ["orinControlApprovals", ["kind", "uid", "accountId", "deltaCents", "status", "reason", "reference", "requestedBy", "approvedBy", "beforeCents", "afterCents", "createdAt", "revision"]],
  trading: ["orinExecutedTrades", ["user_id", "accountId", "contract_id", "status", "amount_cents", "result_cents", "started_at", "settled_at"]],
  markets: ["orinControlMarkets", ["pair", "name", "category", "enabled", "order", "source", "revision"]],
  bonus: ["orinBonusWallets", ["uid", "accountId", "bonusCents", "profitCents", "withdrawableProfitCents", "claimed", "expiresAt", "termsVersion"]],
  referrals: ["orinReferralRewards", ["referrerId", "referredId", "status", "amountCents", "createdAt", "termsVersion", "revision"]],
  agencies: ["orinProgramMembers", ["uid", "referralId", "agencyId", "agencyGranted", "directCount", "activeTeamCount", "teamCount", "activityRewardCents", "revision"]],
  badges: ["orinProgramMembers", ["uid", "badges", "referralId", "revision"]],
  notifications: ["orinControlNotifications", ["title", "message", "audience", "targetUid", "segment", "status", "startsAt", "expiresAt", "revision", "delivered", "createdAt"]],
  content: ["orinControlContent", ["slug", "titleAr", "titleEn", "bodyAr", "bodyEn", "status", "revision", "updatedAt"]],
  security: ["orinControlSecurity", ["uid", "event", "status", "createdAt", "adminId"]],
  staff: ["orinStaff", ["email", "roles", "status", "validAfter", "revision", "createdAt"]],
  audit: ["orinControlAudit", ["adminId", "action", "target", "timestamp", "reason", "previous", "next", "requestId", "referenceId"]]
};
async function controlSession(u) {
  const staff = await requirePermission(u, "dashboard.read"), integration = (await controlRef("Integrations", "current").get()).data() ?? {};
  return { available: true, uid: u.id, roles: staff.roles, permissions: permissionsFor(staff.roles), reauthSeconds: 300, capabilities: { payments: integration.payments === true, execution: integration.execution === true, kycDocuments: !!process.env.ORIN_KYC_BUCKET, push: false, scheduler: integration.scheduler === true } };
}
async function requireModule(u, module, exporting = false) {
  const m = CONTROL_MODULES.find((x) => x[0] === module);
  if (!m)
    throw new ApiError("Unknown module", 404);
  const staff = await requirePermission(u, m[3]);
  if (exporting)
    await requirePermission(u, "reports.export");
  return staff;
}
async function controlRead(u, module, q = {}) {
  if (module === "session")
    return controlSession(u);
  const staff = await requireModule(u, module, q.export === "true");
  if (module === "tickets") return readTickets(u, q);
  if (module === "audit") return readAudit(u, q);
  if (module === "dashboard") {
    const stats = [];
    for (const [id2, collection, permission] of [["users", "users", "users.read"], ["kyc", "orinKycRequests", "kyc.read"], ["deposits", "orinDeposits", "finance.read"], ["withdrawals", "orinControlWithdrawals", "finance.read"], ["referrals", "orinReferralRewards", "programs.read"], ["bonus", "orinBonusWallets", "programs.read"]]) {
      if (!permissionsFor(staff.roles).includes(permission))
        continue;
      try {
        stats.push({ id: id2, count: (await db.collection(collection).count().get()).data().count });
      } catch {
        stats.push({ id: id2, count: null });
      }
    }
    if (permissionsFor(staff.roles).includes("accounts.read"))
      for (const type of ["real", "demo"]) {
        try {
          stats.push({ id: "accounts_" + type, count: (await db.collectionGroup("accounts").where("type", "==", type).count().get()).data().count });
        } catch {
          stats.push({ id: "accounts_" + type, count: null });
        }
      }
    const activity = permissionsFor(staff.roles).includes("audit.read") ? (await controlRef("Audit", "_").parent.orderBy("timestamp", "desc").limit(12).get()).docs.map((d) => ({ id: d.id, ...d.data() })) : [];
    return { stats, activity, queues: await operationQueues(u, staff.roles), asOf: Date.now(), capabilities: (await controlSession(u)).capabilities };
  }
  if (module === "configuration")
    return { rows: [{ id: "current", ...CONTROL_DEFAULTS, ...(await controlRef("Configuration", "current").get()).data() }], nextCursor: null };
  if (module === "markets") {
    const [stored, current] = await Promise.all([db.collection("orinControlMarkets").get(), ref("sparkConfiguration", "markets").get()]);
    const config = { ...DEFAULT_CONFIGURATION, ...current.data()?.configuration };
    const byPair = new Map(stored.docs.map((d) => [d.id, d.data()]));
    const rows2 = MARKET_SYMBOLS.map((s, i) => ({ id: s.pair, pair: s.pair, name: s.name, category: s.category, source: s.tv, revision: 0, ...byPair.get(s.pair), enabled: config.enabledSymbols.includes(s.pair), order: config.enabledSymbols.indexOf(s.pair) >= 0 ? config.enabledSymbols.indexOf(s.pair) : i }));
    if (q.export === "true")
      await db.runTransaction(async (tx) => {
        await requirePermission(u, "reports.export", tx, true);
        controlAudit(tx, randomUUID3(), u, "report.export", "markets", "Administrative market export", null, { rows: rows2.length }, randomUUID3());
      });
    return { rows: rows2, nextCursor: null };
  }
  if (module === "team")
    return { rows: ((await ref("orinProgramConfiguration", "current").get()).data()?.levels ?? TEAM_LEVELS).map((v) => ({ id: "L" + v.level, ...v })), configuration: { ...DEFAULT_PROGRAM_CONFIG, ...(await ref("orinProgramConfiguration", "current").get()).data() }, nextCursor: null };
  if (module === "users" && q.search) {
    const term = text(q.search, 320), found = /* @__PURE__ */ new Map();
    const exact = await ref("users", /^[A-Za-z0-9_-]{1,128}$/.test(term) ? term : "__no_match__").get();
    if (exact.exists)
      found.set(exact.id, pick(exact.data(), sources.users[1]));
    if (/^\d{12}$/.test(term)) {
      const n = (await ref("sparkAccountNumbers", term).get()).data();
      if (n) {
        const s = await ref("users", n.ownerId).get();
        if (s.exists)
          found.set(s.id, pick(s.data(), sources.users[1]));
      }
    }
    for (const field of ["email", "displayName"]) {
      const rows2 = await db.collection("users").where(field, "==", term).limit(30).get();
      rows2.forEach((d) => found.set(d.id, pick(d.data(), sources.users[1])));
    }
    const results = [];
    for (const [id2, d] of found) {
      const access = (await controlRef("Access", id2).get()).data();
      results.push({ id: id2, ...d, status: access?.status ?? (d.disabled ? "suspended" : "active"), revision: access?.revision ?? 0 });
    }
    if (q.export === "true")
      await db.runTransaction(async (tx) => {
        await requirePermission(u, "reports.export", tx, true);
        controlAudit(tx, randomUUID3(), u, "report.export", "users", "Administrative search export", null, { rows: results.length }, randomUUID3());
      });
    return { rows: results, nextCursor: null, searchMode: "exact" };
  }
  let query = ["accounts", "wallets"].includes(module) ? db.collectionGroup("accounts") : db.collection(sources[module][0]);
  if (q.status && q.status !== "all" && !["users", "accounts", "codes"].includes(module))
    query = query.where("status", "==", text(q.status, 30));
  query = query.orderBy(FieldPath2.documentId());
  if (q.cursor) {
    if (["accounts", "wallets"].includes(module)) {
      if (typeof q.cursor !== "string" || !/^sparkTradingAccounts\/[-A-Za-z0-9_]+\/accounts\/[-A-Za-z0-9_]+$/.test(q.cursor))
        throw new ApiError("Invalid cursor");
      query = query.startAfter(db.doc(q.cursor));
    } else
      query = query.startAfter(key2(q.cursor));
  }
  const page = await query.limit(51).get(), rows = page.docs.slice(0, 50).filter((d) => !["accounts", "wallets"].includes(module) || d.ref.path.startsWith("sparkTradingAccounts/")).map((d) => ({ id: d.id, ...["accounts", "wallets"].includes(module) ? pick(d.data(), ["ownerId", "accountNumber", "type", "currency", "balanceCents", "reservedCents", "realizedCents", "createdAt"]) : pick(d.data(), sources[module][1]) }));
  if (module === "deposits") for (const row of rows) Object.assign(row, { cents: row.amountCents, currency: "USD", providerReference: row.paymentId ?? null, provider: "nowpayments" });
  if (module === "codes") for (const row of rows) {
    const state = (await ref("orinControlContractStates", row.id).get()).data();
    Object.assign(row, { mode: "virtual-test-only", status: state?.status ?? "active", revision: state?.revision ?? 0 });
  }
  if (module === "users")
    for (const row of rows) {
      const access = (await controlRef("Access", row.id).get()).data();
      Object.assign(row, { status: access?.status ?? (row.disabled ? "suspended" : "active"), revision: access?.revision ?? 0 });
    }
  if (module === "accounts" && !permissionsFor(staff.roles).includes("wallet.read"))
    for (const row of rows) {
      delete row.balanceCents;
      delete row.reservedCents;
      delete row.realizedCents;
    }
  if (module === "accounts")
    for (const row of rows) {
      const access = (await controlRef("AccountStates", hash(row.ownerId + ":" + row.id)).get()).data();
      Object.assign(row, { status: access?.status ?? "active", revision: access?.revision ?? 0 });
    }
  if (module === "wallets")
    for (const row of rows) {
      const bonus = (await ref("orinBonusWallets", row.ownerId).get()).data(), b = bonus?.accountId === row.id ? bonus : null;
      row.uid = row.ownerId;
      row.accountId = row.id;
      row.cashCents = row.balanceCents;
      row.bonusCents = b?.bonusCents ?? 0;
      row.profitCents = b?.profitCents ?? 0;
      row.withdrawableProfitCents = b?.withdrawableProfitCents ?? 0;
      row.lockedProfitCents = row.profitCents - row.withdrawableProfitCents;
      row.withdrawableCashCents = null;
      row.withdrawalEligibility = "provider_required";
    }
  if (q.export === "true")
    await db.runTransaction(async (tx) => {
      await requirePermission(u, "reports.export", tx, true);
      controlAudit(tx, randomUUID3(), u, "report.export", module, "Administrative report export", null, { rows: rows.length, cursor: q.cursor ?? null }, randomUUID3());
    });
  return { rows, nextCursor: page.size > 50 ? ["accounts", "wallets"].includes(module) ? page.docs[49].ref.path : page.docs[49].id : null, asOf: Date.now() };
}
async function controlUser(u, uid) {
  await requirePermission(u, "users.read");
  key2(uid);
  const s = await ref("users", uid).get();
  if (!s.exists)
    throw new ApiError("User not found", 404);
  const perms = permissionsFor((await ref("orinStaff", u.id).get()).data()?.roles);
  const [access, member2] = await Promise.all([controlRef("Access", uid).get(), ref("orinProgramMembers", uid).get()]);
  const out = { user: { id: uid, ...pick(s.data(), sources.users[1]), ...pick(access.data() ?? {}, ["status", "revision", "reason"]) } };
  if (perms.includes("accounts.read"))
    out.accounts = (await db.collection(`sparkTradingAccounts/${uid}/accounts`).limit(100).get()).docs.map((d) => ({ id: d.id, ...pick(d.data(), ["accountNumber", "type", "currency", ...perms.includes("wallet.read") ? ["balanceCents", "reservedCents"] : []]) }));
  if (perms.includes("kyc.read"))
    out.kyc = (await db.collection("orinKycRequests").where("uid", "==", uid).limit(20).get()).docs.map((d) => ({ id: d.id, ...pick(d.data(), sources.kyc[1]) }));
  if (perms.includes("programs.read"))
    out.program = pick(member2.data() ?? {}, sources.agencies[1].concat(["badges", "code"]));
  if (perms.includes("wallet.read"))
    out.bonus = pick((await ref("orinBonusWallets", uid).get()).data() ?? {}, sources.bonus[1]);
  return out;
}
function validateConfig(raw) {
  if (Object.keys(raw).some((k) => !Object.hasOwn(CONTROL_DEFAULTS, k)))
    throw new ApiError("Only public operational settings are allowed");
  const next = { ...CONTROL_DEFAULTS, ...raw };
  for (const k of ["maintenance", "tradingEnabled", "depositsEnabled", "withdrawalsEnabled", "referralsEnabled", "bonusEnabled"])
    if (typeof next[k] !== "boolean")
      throw new ApiError("Invalid switch");
  integer(next.minimumVersionCode, 1);
  if (next.maxAdjustmentCents !== null)
    integer(next.maxAdjustmentCents, 1);
  for (const k of ["messageAr", "messageEn"])
    text(next[k], 300);
  if (next.supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.supportEmail))
    throw new ApiError("Invalid support email");
  if (next.supportUrl && !/^https:\/\/[^\s<>]+$/.test(next.supportUrl))
    throw new ApiError("HTTPS support URL required");
  return next;
}
async function controlAction(u, input) {
  const action = String(input.action), permission = ACTION_PERMISSIONS[action];
  if (!permission)
    throw new ApiError("Unsupported control action");
  const requestId = key2(input.requestId), reason = text(input.reason, 1e3), target = key2(input.target ?? u.id), fingerprint = hash(JSON.stringify(input)), command = controlRef("Commands", hash(u.id + ":" + requestId)), now = Date.now();
  let output = { saved: true };
  const recent = ["user.", "account.", "contract.", "reward.", "finance.", "payment.", "staff.", "security.", "configuration.", "program.", "kyc."].some((p) => action.startsWith(p));
  await db.runTransaction(async (tx) => {
    const staff = await requirePermission(u, permission, tx, recent), used = await tx.get(command);
    if (used.exists) {
      if (used.data().fingerprint !== fingerprint)
        throw new ApiError("Request ID conflict", 409);
      output = used.data().result;
      return;
    }
    let before = null, after = null;
    const payload = input.data ?? {};
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
      throw new ApiError("Invalid payload");
    if (action.startsWith("contract.")) {
      const result = await applyContractAction(tx, u, action, target, payload, input.revision, now);
      before = result.before;
      after = result.after;
      output = result.output;
    } else if (action.startsWith("ticket.")) {
      const result = await applyTicketAction(tx, u, action, target, payload, input.revision, now, requestId);
      before = result.before;
      after = result.after;
      output = result.output;
    } else if (action === "user.status") {
      if (target === u.id || !["active", "restricted", "suspended"].includes(payload.status))
        throw new ApiError("Invalid status change");
      const [p, s, a] = await Promise.all([tx.get(ref("users", target)), tx.get(ref("orinStaff", target)), tx.get(controlRef("Access", target))]);
      if (!p.exists || s.exists)
        throw new ApiError("Staff must be managed in Staff & roles", 403);
      before = a.data() ?? { status: p.data().disabled ? "suspended" : "active", revision: 0 };
      if (input.revision !== before.revision)
        throw new ApiError("Record changed; reload", 409);
      after = { status: payload.status, reason, revision: before.revision + 1, updatedAt: now };
      tx.set(controlRef("Access", target), after);
      tx.update(ref("users", target), { disabled: payload.status === "suspended", updatedAt: FieldValue2.serverTimestamp() });
    } else if (action === "account.create") {
      const user = await tx.get(ref("users", target));
      if (!user.exists || user.data().disabled || !["real", "demo"].includes(payload.type))
        throw new ApiError("Invalid owner/account type");
      const accountId = key2(payload.accountId ?? requestId), a = db.doc(`sparkTradingAccounts/${target}/accounts/${accountId}`);
      if ((await tx.get(a)).exists)
        throw new ApiError("Account already exists", 409);
      let number = "";
      for (let i = 0; i < 5; i++) {
        number = String(BigInt(1e11) + BigInt("0x" + randomBytes(6).toString("hex")) % BigInt(9e11));
        if (!(await tx.get(ref("sparkAccountNumbers", number))).exists)
          break;
        number = "";
      }
      if (!number)
        throw new ApiError("Account number allocation unavailable", 503);
      after = { id: accountId, ownerId: target, accountNumber: number, type: payload.type, currency: "USD", balanceCents: 0, reservedCents: 0, realizedCents: 0, createdAt: FieldValue2.serverTimestamp() };
      tx.create(a, after);
      tx.create(ref("sparkAccountNumbers", number), { ownerId: target, accountId, createdAt: FieldValue2.serverTimestamp() });
      output = { saved: true, accountId, accountNumber: number };
      after = { ...after, createdAt: now };
    } else if (action === "account.status") {
      const uid = key2(payload.uid), a = await tx.get(db.doc(`sparkTradingAccounts/${uid}/accounts/${target}`));
      if (!a.exists || !["active", "restricted"].includes(payload.status))
        throw new ApiError("Invalid account");
      const r = controlRef("AccountStates", hash(uid + ":" + target));
      before = (await tx.get(r)).data() ?? { status: "active", revision: 0 };
      if (before.revision !== input.revision)
        throw new ApiError("Record changed", 409);
      after = { uid, accountId: target, status: payload.status, reason, revision: before.revision + 1 };
      tx.set(r, after);
    } else if (action === "kyc.review") {
      const r = ref("orinKycRequests", target);
      before = (await tx.get(r)).data();
      if (!before || before.revision !== input.revision)
        throw new ApiError("KYC request changed", 409);
      const transitions = { pending: ["review"], review: ["verified", "rejected", "more_information"], more_information: ["review"], rejected: ["review"], verified: [] };
      if (payload.status === "verified" && (!before.documentIds?.length || before.evidenceComplete !== true))
        throw new ApiError("Complete submitted evidence is required", 409);
      if (!transitions[before.status]?.includes(payload.status))
        throw new ApiError("Invalid KYC transition", 409);
      after = { ...before, status: payload.status, reason, reviewedBy: u.id, reviewedAt: now, revision: before.revision + 1 };
      tx.update(r, { status: after.status, reason, reviewedBy: u.id, reviewedAt: now, revision: after.revision });
      before = pick(before, ["uid", "status", "revision"]);
      after = pick(after, ["uid", "status", "revision", "reason", "reviewedBy"]);
    } else if (action === "reward.propose") {
      const s = await rewardSnapshot(tx, payload), reference = text(payload.reference, 128), unique = controlRef("FinancialReferences", hash(reference));
      if ((await tx.get(unique)).exists)
        throw new ApiError("Financial reference already used", 409);
      after = { kind: "reward", rewardKind: s.kind, rewardId: s.rewardId, rewardRevision: s.reward.revision ?? null, uid: s.uid, accountId: s.accountId, deltaCents: s.cents, beforeCents: s.account.balanceCents, afterCents: s.account.balanceCents + s.cents, status: "pending", reason, reference, requestedBy: u.id, revision: 0, createdAt: now };
      tx.create(controlRef("Approvals", requestId), after);
      tx.create(unique, { approvalId: requestId });
      output = { saved: true, approvalId: requestId };
    } else if (action === "finance.propose") {
      const cfg = (await tx.get(controlRef("Configuration", "current"))).data();
      if (!cfg?.maxAdjustmentCents || cfg.maintenance)
        throw new ApiError("Approve a finance limit before adjustments", 409);
      const uid = key2(payload.uid), accountId = key2(payload.accountId), delta = Number(payload.deltaCents);
      if (!Number.isSafeInteger(delta) || !delta || Math.abs(delta) > cfg.maxAdjustmentCents)
        throw new ApiError("Adjustment outside approved limit");
      await controlAccess({ id: uid }, true, tx);
      await controlAccount(uid, accountId, tx);
      const a = (await tx.get(db.doc(`sparkTradingAccounts/${uid}/accounts/${accountId}`))).data();
      if (!a || a.ownerId !== uid || a.type !== "real" || a.currency !== "USD")
        throw new ApiError("Real USD account required");
      integer(a.balanceCents + delta, Math.max(0, a.reservedCents ?? 0));
      const reference = text(payload.reference, 128), unique = controlRef("FinancialReferences", hash(reference));
      if ((await tx.get(unique)).exists)
        throw new ApiError("Financial reference already used", 409);
      after = { kind: "adjustment", uid, accountId, deltaCents: delta, beforeCents: a.balanceCents, afterCents: a.balanceCents + delta, status: "pending", reason, reference, requestedBy: u.id, revision: 0, createdAt: now };
      tx.create(controlRef("Approvals", requestId), after);
      tx.create(unique, { approvalId: requestId });
      output = { saved: true, approvalId: requestId };
    } else if (action === "finance.approve" || action === "finance.reject") {
      const r = controlRef("Approvals", target);
      before = (await tx.get(r)).data();
      if (!before || before.status !== "pending" || before.requestedBy === u.id || before.revision !== input.revision)
        throw new ApiError("Requires a different reviewer and a pending unchanged request", 409);
      const maker = (await tx.get(ref("orinStaff", before.requestedBy))).data();
      const makerProfile = (await tx.get(ref("users", before.requestedBy))).data();
      if (makerProfile?.disabled || maker?.validAfter > before.createdAt || maker?.status !== "active" || !permissionsFor(maker.roles).includes("finance.propose"))
        throw new ApiError("Requester no longer authorized", 403);
      after = { ...before, status: action === "finance.reject" ? "rejected" : "approved", approvedBy: u.id, reviewReason: reason, reviewedAt: now, revision: before.revision + 1 };
      if (action === "finance.approve") {
        const cfg = (await tx.get(controlRef("Configuration", "current"))).data();
        if (cfg?.maintenance)
          throw new ApiError("Maintenance", 503);
        await controlAccess({ id: before.uid }, true, tx);
        await controlAccount(before.uid, before.accountId, tx);
        if (before.kind === "adjustment") {
          if (!cfg?.maxAdjustmentCents || Math.abs(before.deltaCents) > cfg.maxAdjustmentCents)
            throw new ApiError("Adjustment policy changed", 409);
          const a = db.doc(`sparkTradingAccounts/${before.uid}/accounts/${before.accountId}`), data = (await tx.get(a)).data();
          if (!data || data.type !== "real" || data.ownerId !== before.uid || data.balanceCents !== before.beforeCents || data.currency !== "USD")
            throw new ApiError("Balance changed; submit a new request", 409);
          integer(data.balanceCents + before.deltaCents, Math.max(0, data.reservedCents ?? 0));
          tx.update(a, { balanceCents: data.balanceCents + before.deltaCents });
          tx.create(ref("orinProgramLedger", "control-" + target), { uid: before.uid, accountId: before.accountId, kind: "adjustment", entries: [{ account: "cash", cents: before.deltaCents }, { account: "adjustment-clearing", cents: -before.deltaCents }], createdAt: now, reference: before.reference, requestedBy: before.requestedBy, approvedBy: u.id });
          after.status = "completed";
        } else if (before.kind === "reward") {
          await settleReward(tx, before, target, u.id, now);
          after.status = "completed";
        } else if (before.kind === "payment") {
          const p = controlRef(before.module === "deposits" ? "Deposits" : "Withdrawals", before.paymentId), payment = (await tx.get(p)).data(), integration = (await tx.get(controlRef("Integrations", "current"))).data();
          if (!payment || payment.status !== "pending" || payment.revision !== before.paymentRevision)
            throw new ApiError("Payment changed", 409);
          if (!integration?.payments)
            throw new ApiError("Payment adapter is not connected", 409);
          tx.create(controlRef("PaymentOutbox", target), { paymentId: before.paymentId, module: before.module, decision: before.decision, uid: before.uid, accountId: before.accountId, status: "queued", requestedBy: before.requestedBy, approvedBy: u.id, createdAt: now });
          tx.update(p, { status: "processing", revision: payment.revision + 1, approvalId: target });
        } else
          throw new ApiError("Unknown financial operation");
      }
      tx.update(r, after);
    } else if (action === "payment.review") {
      if (!["deposits", "withdrawals"].includes(payload.module) || !["approve", "reject", "cancel"].includes(payload.decision))
        throw new ApiError("Invalid payment decision");
      const r = controlRef(payload.module === "deposits" ? "Deposits" : "Withdrawals", target);
      const p = (await tx.get(r)).data();
      if (!p || p.status !== "pending" || p.revision !== input.revision)
        throw new ApiError("Only pending payments can be reviewed", 409);
      after = { kind: "payment", paymentId: target, module: payload.module, decision: payload.decision, uid: p.uid, accountId: p.accountId, paymentRevision: p.revision, status: "pending", requestedBy: u.id, reason, revision: 0, createdAt: now };
      tx.create(controlRef("Approvals", requestId), after);
      output = { saved: true, approvalId: requestId };
    } else if (action === "staff.set" || action === "staff.invite") {
      if (!Array.isArray(payload.roles) || !payload.roles.length || !permissionsFor(payload.roles).length || payload.roles.some((x) => !Object.hasOwn(ROLES, x)))
        throw new ApiError("Invalid role");
      if (payload.roles.length !== 1)
        throw new ApiError("Assign one role; combine only through a reviewed role definition");
      const gate = await tx.get(ref("system", "control-center"));
      if (!gate.exists)
        throw new ApiError("Bootstrap required", 409);
      if (action === "staff.invite") {
        const email = text(payload.email, 320).toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || payload.roles.includes("super_admin"))
          throw new ApiError("Invite a non-super role; promote a verified existing staff member separately");
        after = { email, roles: payload.roles, status: "pending", createdBy: u.id, createdAt: now, expiresAt: now + 7 * 864e5 };
        tx.set(controlRef("Invitations", hash(email)), after);
      } else {
        if (target === u.id)
          throw new ApiError("Cannot change your own role or status", 403);
        if (!["active", "disabled"].includes(payload.status))
          throw new ApiError("Invalid staff status");
        const [profile, old] = await Promise.all([tx.get(ref("users", target)), tx.get(ref("orinStaff", target))]);
        if (!profile.exists)
          throw new ApiError("Existing registered user required");
        before = old.data() ?? { revision: 0, status: "disabled", roles: [] };
        if ((before.revision ?? 0) !== input.revision)
          throw new ApiError("Staff record changed", 409);
        const was = before.status === "active" && before.roles.includes("super_admin"), will = payload.status === "active" && payload.roles.includes("super_admin"), count = gate.data().superAdminCount + (will ? 1 : 0) - (was ? 1 : 0);
        if (count < 1)
          throw new ApiError("Cannot remove the last Super Admin", 409);
        after = { email: profile.data().email, roles: payload.roles, status: payload.status, revision: (before.revision ?? 0) + 1, validAfter: now, updatedBy: u.id, updatedAt: now };
        tx.set(ref("orinStaff", target), after);
        tx.update(gate.ref, { superAdminCount: count });
      }
    } else if (action === "configuration.save") {
      const r = controlRef("Configuration", "current");
      before = (await tx.get(r)).data() ?? { revision: 0 };
      if (input.revision !== before.revision)
        throw new ApiError("Configuration changed", 409);
      const c = validateConfig(payload), integration = (await tx.get(controlRef("Integrations", "current"))).data() ?? {};
      if (c.tradingEnabled && !integration.execution || (c.depositsEnabled || c.withdrawalsEnabled) && !integration.payments)
        throw new ApiError("Connect the trusted provider before enabling execution or payments", 409);
      after = { ...c, revision: before.revision + 1, updatedAt: now };
      tx.create(controlRef("ConfigurationHistory", String(after.revision)), { ...after, adminId: u.id, reason });
      tx.set(r, after);
      const { maxAdjustmentCents, ...publicConfig } = after;
      tx.set(ref("orinPublicConfiguration", "current"), publicConfig);
    } else if (action === "content.save" || action === "notification.save") {
      const notification = action.startsWith("notification"), r = controlRef(notification ? "Notifications" : "Content", target);
      before = (await tx.get(r)).data() ?? { revision: 0 };
      if (input.revision !== before.revision)
        throw new ApiError("Draft changed", 409);
      if (notification) {
        if (!["all", "user", "segment"].includes(payload.audience) || !["all", "real", "demo", "agents", "verified"].includes(payload.segment ?? "all"))
          throw new ApiError("Invalid audience");
        after = { title: text(payload.title, 80), message: text(payload.message, 500), audience: payload.audience, targetUid: payload.audience === "user" ? key2(payload.targetUid) : null, segment: payload.segment ?? "all", startsAt: integer(payload.startsAt), expiresAt: integer(payload.expiresAt) };
        if (after.expiresAt <= Math.max(now, after.startsAt))
          throw new ApiError("Invalid delivery period");
      } else
        after = { slug: target, titleAr: text(payload.titleAr, 100), titleEn: text(payload.titleEn, 100), bodyAr: text(payload.bodyAr, 2e4), bodyEn: text(payload.bodyEn, 2e4) };
      after = { ...after, status: "draft", revision: before.revision + 1, updatedAt: now, updatedBy: u.id };
      tx.set(r, after);
    } else if (action === "content.publish" || action === "notification.publish") {
      const notification = action.startsWith("notification"), r = controlRef(notification ? "Notifications" : "Content", target);
      before = (await tx.get(r)).data();
      if (!before || before.status !== "draft" || before.revision !== input.revision || payload.previewRevision !== before.revision)
        throw new ApiError("Preview the current draft before publishing", 409);
      after = { ...before, status: notification ? before.startsAt > now ? "scheduled" : "queued" : "published", revision: before.revision + 1, publishedAt: now, publishedBy: u.id };
      if (notification) {
        const integration = (await tx.get(controlRef("Integrations", "current"))).data();
        if (!integration?.scheduler)
          throw new ApiError("Notification delivery worker is not activated", 409);
        tx.create(controlRef("NotificationOutbox", target + "_" + after.revision), { ...after, campaignId: target, status: after.status });
      } else {
        tx.set(ref("orinPublicContent", target), after);
        tx.create(controlRef("ContentHistory", target + "_" + after.revision), after);
      }
      tx.update(r, after);
    } else if (action === "market.save") {
      const pair = String(payload.pair), symbol = MARKET_SYMBOLS.find((s) => s.pair === pair);
      if (!symbol || typeof payload.enabled !== "boolean")
        throw new ApiError("A connected supported symbol is required");
      integer(payload.order);
      if (target !== pair)
        throw new ApiError("Use the canonical market identifier");
      const r = controlRef("Markets", pair);
      before = (await tx.get(r)).data() ?? { revision: 0 };
      if (input.revision !== before.revision)
        throw new ApiError("Market changed", 409);
      const previous = (await tx.get(ref("sparkConfiguration", "markets"))).data(), config = { ...DEFAULT_CONFIGURATION, ...previous?.configuration };
      const enabled2 = config.enabledSymbols.filter((s) => s !== pair);
      if (payload.enabled)
        enabled2.splice(Math.min(payload.order, enabled2.length), 0, pair);
      if (!enabled2.length)
        throw new ApiError("At least one market must remain enabled");
      after = { pair, name: symbol.name, category: symbol.category, source: symbol.tv, enabled: payload.enabled, order: payload.order, revision: before.revision + 1 };
      tx.set(r, after);
      const configuration = { ...config, enabledSymbols: enabled2, defaultSymbol: enabled2.includes(config.defaultSymbol) ? config.defaultSymbol : enabled2[0] };
      tx.set(ref("sparkConfiguration", "markets"), { configuration, revision: (previous?.revision ?? 0) + 1, updatedAt: FieldValue2.serverTimestamp() });
      tx.set(ref("orinConfiguration", "markets"), { configuration, revision: (previous?.revision ?? 0) + 1, updated_at: now });
    } else if (action === "agency.set" || action === "badge.grant") {
      const r = ref("orinProgramMembers", target);
      before = (await tx.get(r)).data();
      if (!before)
        throw new ApiError("Program member required", 404);
      if ((before.revision ?? 0) !== input.revision)
        throw new ApiError("Member changed", 409);
      if (action === "agency.set") {
        if (typeof payload.granted !== "boolean")
          throw new ApiError("Invalid agency state");
        after = { agencyGranted: payload.granted, agencyId: before.agencyId ?? "AG-" + randomBytes(6).toString("hex").toUpperCase(), agencyReason: reason, agencyGrantedBy: u.id, revision: (before.revision ?? 0) + 1 };
      } else {
        const badge = BADGES.find((b) => b.id === payload.badge);
        if (!badge || ["verified", "first_deposit", "trader"].includes(badge.id))
          throw new ApiError("This badge requires trusted automatic evidence", 409);
        const evidence = text(payload.evidenceReference, 128);
        after = { badges: [.../* @__PURE__ */ new Set([...before.badges ?? [], badge.id])], badgeReview: { adminId: u.id, reason, evidenceReference: evidence, at: now }, revision: (before.revision ?? 0) + 1 };
      }
      tx.update(r, after);
      before = pick(before, ["agencyGranted", "agencyId", "badges", "revision"]);
    } else if (action === "referral.review") {
      const r = ref("orinReferralRewards", target);
      before = (await tx.get(r)).data();
      if (!before || (before.revision ?? 0) !== input.revision)
        throw new ApiError("Referral changed", 409);
      const transition = { pending: ["qualified", "rejected"], qualified: ["approved", "rejected"], approved: ["rejected"] };
      if (!transition[before.status]?.includes(payload.status))
        throw new ApiError("Invalid referral transition; payouts use the financial queue", 409);
      if (payload.status !== "rejected") {
        const [a, b, e] = await Promise.all([tx.get(ref("orinVerifiedCustomers", before.referrerId)), tx.get(ref("orinVerifiedCustomers", before.referredId)), tx.get(ref("orinProgramEvidence", key2(payload.evidenceId)))]);
        if (before.referrerId === before.referredId || !a.data()?.verified || !b.data()?.verified || a.data()?.revoked || b.data()?.revoked || a.data()?.customerKey === b.data()?.customerKey || e.data()?.uid !== before.referredId || e.data()?.kind !== "referral_qualified" || e.data()?.revoked || e.data()?.termsVersion !== before.termsVersion)
          throw new ApiError("Trusted evidence for distinct qualified customers required", 409);
      }
      const parent = ref("orinProgramMembers", before.referrerId), parentData = (await tx.get(parent)).data();
      if (!parentData)
        throw new ApiError("Referrer unavailable", 409);
      after = { status: payload.status, reason, reviewedBy: u.id, reviewedAt: now, evidenceId: payload.evidenceId ?? before.evidenceId ?? null, revision: (before.revision ?? 0) + 1 };
      tx.update(r, after);
      tx.update(ref("orinProgramMembers", before.referredId), { referralStatus: payload.status });
      if (before.status === "pending" && payload.status === "qualified")
        tx.update(parent, { qualifiedCount: (parentData.qualifiedCount ?? 0) + 1, pendingCents: (parentData.pendingCents ?? 0) + before.amountCents });
      if (["qualified", "approved"].includes(before.status) && payload.status === "rejected")
        tx.update(parent, { qualifiedCount: Math.max(0, (parentData.qualifiedCount ?? 0) - 1), pendingCents: Math.max(0, (parentData.pendingCents ?? 0) - before.amountCents) });
    } else if (action === "security.revoke") {
      if (target === u.id)
        throw new ApiError("Use sign out for your own session");
      const p = await tx.get(ref("users", target));
      if (!p.exists)
        throw new ApiError("User not found", 404);
      const isStaff = await tx.get(ref("orinStaff", target));
      if (isStaff.exists && !staff.roles.includes("super_admin"))
        throw new ApiError("Only Super Admin may revoke a staff session", 403);
      after = { uid: target, validAfter: now, revision: input.revision ?? 0 };
      tx.set(controlRef("SessionRevocations", target), after);
      if (isStaff.exists)
        tx.update(isStaff.ref, { validAfter: now });
      tx.create(controlRef("Security", requestId), { uid: target, event: "sessions_revoked", status: "revoked_at_api", adminId: u.id, createdAt: now });
    } else if (action === "program.configure")
      throw new ApiError("Use versioned program configuration endpoint", 409);
    else
      throw new ApiError("Action unavailable", 409);
    controlAudit(tx, "command-" + command.id, u, action, target, reason, before, after, requestId);
    tx.create(command, { fingerprint, result: output, createdAt: now });
  });
  if (action === "security.revoke") {
    try {
      await auth.revokeRefreshTokens(target);
    } catch {
      output = { ...output, authRevocationPending: true };
    }
  }
  return output;
}
async function acceptStaffInvitation(u) {
  if (!u.verified)
    throw new ApiError("Verified email required", 403);
  await db.runTransaction(async (tx) => {
    const r = controlRef("Invitations", hash(u.email.toLowerCase())), invite = (await tx.get(r)).data(), staff = await tx.get(ref("orinStaff", u.id));
    if (!invite || invite.status !== "pending" || invite.expiresAt < Date.now() || staff.exists || invite.roles.includes("super_admin"))
      throw new ApiError("No valid staff invitation", 403);
    const creator = (await tx.get(ref("orinStaff", invite.createdBy))).data();
    if (creator?.status !== "active" || !creator.roles.includes("super_admin"))
      throw new ApiError("Invitation issuer no longer authorized", 403);
    tx.create(ref("orinStaff", u.id), { email: u.email, roles: invite.roles, status: "active", revision: 0, createdAt: Date.now() });
    tx.update(r, { status: "accepted", uid: u.id });
    controlAudit(tx, randomUUID3(), u, "staff.accept", u.id, "Verified staff invitation accepted", null, { roles: invite.roles }, randomUUID3());
  });
  return controlSession(u);
}

// firebase-functions/src/programs.ts
import { randomBytes as randomBytes2 } from "node:crypto";
var member = (uid) => ref("orinProgramMembers", uid);
var configRef = () => ref("orinProgramConfiguration", "current");
var accountRef = (uid, id2) => db.doc(`sparkTradingAccounts/${uid}/accounts/${id2}`);
var money = (n) => Number.isSafeInteger(n) && Number(n) >= 0 && Number(n) <= Number.MAX_SAFE_INTEGER / 4;
function validConfig(v) {
  const p = { ...DEFAULT_PROGRAM_CONFIG, ...v };
  if (Object.keys(v).some((k) => !Object.hasOwn(DEFAULT_PROGRAM_CONFIG, k)) || typeof p.enabled !== "boolean" || !Number.isInteger(p.revision) || p.revision < 0) throw new ApiError("Invalid program settings");
  for (const k of ["termsVersion", "referralCriteria", "activeTeamCriteria", "activityPeriod", "bonusTradingTerms", "agencyCriteria"]) if (p[k] !== null && (typeof p[k] !== "string" || !p[k].trim() || p[k].length > 2e3)) throw new ApiError("Invalid terms");
  if (p.bonusDurationDays !== null && (!Number.isInteger(p.bonusDurationDays) || p.bonusDurationDays <= 0)) throw new ApiError("Invalid duration");
  if (p.bonusProfitLimitCents !== null && !money(p.bonusProfitLimitCents)) throw new ApiError("Invalid profit limit");
  if (p.eligibleAssets !== null && (!Array.isArray(p.eligibleAssets) || !p.eligibleAssets.length || p.eligibleAssets.some((x) => typeof x !== "string" || !/^[A-Z0-9-]{3,20}$/.test(x)))) throw new ApiError("Invalid eligible assets");
  if (!p.badgeCriteria || typeof p.badgeCriteria !== "object" || Array.isArray(p.badgeCriteria) || Object.entries(p.badgeCriteria).some(([k, x]) => !BADGES.some((b) => b.id === k) || typeof x !== "string" || x.length > 2e3)) throw new ApiError("Invalid badge criteria");
  for (const key3 of ["bonusAmountCents", "referralAmountCents", "firstDepositCents"]) if (!money(p[key3]) || p[key3] <= 0) throw new ApiError("Invalid program amount");
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
function ledger(tx, key3, uid, accountId, kind, cents, now) {
  if (!Number.isSafeInteger(cents)) throw new ApiError("Invalid ledger amount");
  tx.create(ref("orinProgramLedger", key3), { uid, accountId, kind, entries: [{ account: `customer:${uid}:${accountId}`, cents }, { account: `program:${kind}`, cents: -cents }], createdAt: now });
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
        tx.update(member(target), { agencyGranted: input.grant, agencyId: m.agencyId ?? "AG-" + randomBytes2(6).toString("hex").toUpperCase(), agencyReason: input.reason, agencyGrantedBy: u.id, agencyUpdatedAt: now });
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
          const id2 = cleanKey(input.accountId), a = accountRef(r.referrerId, id2), data = requireReal((await tx.get(a)).data(), r.referrerId), pv = (await tx.get(ref("orinVerifiedCustomers", r.referrerId))).data(), cv = (await tx.get(ref("orinVerifiedCustomers", target))).data(), e = (await tx.get(ref("orinProgramEvidence", r.evidenceId))).data();
          if (!pv?.verified || pv.revoked || !cv?.verified || cv.revoked || !e || e.revoked || e.termsVersion !== c.termsVersion) throw new ApiError("Eligibility changed; review again", 409);
          if (!money(data.balanceCents + (r.amountCents ?? 8e3))) throw new ApiError("Invalid balance");
          tx.update(a, { balanceCents: data.balanceCents + (r.amountCents ?? 8e3) });
          tx.update(rr, { status: "paid", accountId: id2, paidAt: now });
          tx.update(member(target), { referralStatus: "paid" });
          tx.update(parent, { paidCents: (p.paidCents ?? 0) + (r.amountCents ?? 8e3), pendingCents: p.pendingCents - (r.amountCents ?? 8e3) });
          ledger(tx, "referral-" + target, r.referrerId, id2, "referral_reward", r.amountCents ?? 8e3, now);
        } else throw new ApiError("Invalid reward transition", 409);
      } else if (input.action === "activity_reward") {
        const period = cleanKey(input.periodId), revenue = (await tx.get(ref("orinEligibleRevenue", target + "_" + period))).data(), pay = ref("orinActivityPayments", target + "_" + period), previous = await tx.get(pay);
        if (previous.exists || !revenue || revenue.uid !== target || !revenue.finalized || !money(revenue.netRevenueCents) || !Number.isInteger(revenue.direct) || !Number.isInteger(revenue.activeTeam)) throw new ApiError("Finalized eligible net revenue required", 409);
        const version = revenue.configurationRevision ? validConfig((await tx.get(ref("orinProgramConfigurationHistory", String(revenue.configurationRevision)))).data() ?? {}) : c;
        if (version.termsVersion !== revenue.termsVersion) throw new ApiError("Historical terms mismatch", 409);
        const level = [...version.levels].reverse().find((l) => revenue.direct >= l.direct && revenue.activeTeam >= l.active);
        if (!level) throw new ApiError("No eligible team level", 409);
        const cents = Math.min(level.capCents, Number(BigInt(revenue.netRevenueCents) * BigInt(level.bps) / BigInt(1e4))), id2 = cleanKey(input.accountId), a = accountRef(target, id2), data = requireReal((await tx.get(a)).data(), target);
        if (cents <= 0 || !money(data.balanceCents + cents)) throw new ApiError("No payable activity reward", 409);
        tx.update(a, { balanceCents: data.balanceCents + cents });
        tx.create(pay, { uid: target, periodId: period, netRevenueCents: revenue.netRevenueCents, cents, level: level.level, createdAt: now });
        tx.update(member(target), { activityRewardCents: (m.activityRewardCents ?? 0) + cents });
        ledger(tx, "activity-" + target + "_" + period, target, id2, "team_activity", cents, now);
      } else throw new ApiError("Invalid admin action");
    }
    tx.create(command, { fingerprint, action: input.action, createdAt: now });
    audit(tx, "program-" + command.id, u.id, "PROGRAM_" + input.action, input.uid ?? "configuration", { ...input, requestId }, now);
  });
  return adminPrograms(u);
}

// firebase-functions/src/control-programs.ts
async function controlProgramConfiguration(u, input) {
  await requirePermission(u, "programs.configure", void 0, true);
  if (typeof input.reason !== "string" || input.reason.trim().length < 3 || input.reason.length > 1e3)
    throw new ApiError("Review reason required");
  const c = validConfig(input.data);
  return adminPrograms(u, { action: "configure", configuration: c, revision: input.revision, requestId: input.requestId, reason: input.reason });
}

// firebase-functions/src/control-documents.ts
import { getStorage } from "firebase-admin/storage";
import { randomUUID as randomUUID4 } from "node:crypto";
async function controlDocument(u, requestId, documentId, res) {
  await requirePermission(u, "kyc.documents", void 0, true);
  if (!/^[-A-Za-z0-9_]{1,128}$/.test(requestId) || !/^[-A-Za-z0-9_]{1,128}$/.test(documentId))
    throw new ApiError("Invalid document");
  const request = (await ref("orinKycRequests", requestId).get()).data(), doc = (await ref("orinKycDocuments", documentId).get()).data();
  if (!request || !doc || doc.requestId !== requestId || doc.uid !== request.uid || !request.documentIds?.includes(documentId) || doc.path !== `kyc/${doc.uid}/${requestId}/${documentId}`)
    throw new ApiError("Document unavailable", 404);
  if (!process.env.ORIN_KYC_BUCKET)
    throw new ApiError("Private document storage is not connected", 503);
  const bucket = getStorage(app).bucket(process.env.ORIN_KYC_BUCKET), [policy] = await bucket.getMetadata();
  if (policy.iamConfiguration?.publicAccessPrevention !== "enforced" || !policy.iamConfiguration?.uniformBucketLevelAccess?.enabled)
    throw new ApiError("Private bucket access policy is not enforced", 409);
  const file = bucket.file(doc.path, { generation: doc.generation }), [metadata] = await file.getMetadata();
  if (Number(metadata.size) > 8 * 1024 * 1024 || !["application/pdf", "image/jpeg", "image/png"].includes(metadata.contentType ?? "") || metadata.metadata?.firebaseStorageDownloadTokens)
    throw new ApiError("Document storage policy requires review", 409);
  await db.runTransaction(async (tx) => {
    await requirePermission(u, "kyc.documents", tx, true);
    controlAudit(tx, randomUUID4(), u, "kyc.document.read", requestId, "Authorized private document review", null, { documentId }, randomUUID4());
  });
  res.set("Cache-Control", "private, no-store");
  res.set("Content-Security-Policy", "sandbox; default-src 'none'");
  res.set("Content-Type", metadata.contentType);
  res.set("Content-Disposition", 'attachment; filename="ORIN-KYC-document.' + (metadata.contentType === "application/pdf" ? "pdf" : metadata.contentType === "image/png" ? "png" : "jpg") + '"');
  await new Promise((resolve, reject) => {
    const stream = file.createReadStream();
    stream.on("error", reject);
    res.on("finish", resolve);
    res.on("close", () => {
      stream.destroy();
      resolve();
    });
    stream.pipe(res);
  });
}

// firebase-functions/src/control-worker.ts
import { randomUUID as randomUUID5 } from "node:crypto";
async function deliverControlNotifications(now = Date.now()) {
  if (!(await ref("orinControlIntegrations", "current").get()).data()?.scheduler)
    return { enabled: false };
  const jobs = await db.collection("orinControlNotificationOutbox").where("status", "in", ["queued", "scheduled", "delivering"]).limit(10).get();
  for (const job of jobs.docs) {
    const lease = randomUUID5();
    const d = await db.runTransaction(async (tx) => {
      const s = (await tx.get(job.ref)).data();
      if (!["queued", "scheduled", "delivering"].includes(s.status) || s.startsAt > now || s.leaseUntil > now)
        return null;
      const [staff, profile, campaign] = await Promise.all([tx.get(ref("orinStaff", s.publishedBy)), tx.get(ref("users", s.publishedBy)), tx.get(ref("orinControlNotifications", s.campaignId))]);
      if (s.expiresAt <= now || profile.data()?.disabled || staff.data()?.status !== "active" || !permissionsFor(staff.data()?.roles).includes("notifications.manage") || staff.data()?.validAfter > s.publishedAt || campaign.data()?.revision !== s.revision) {
        tx.update(job.ref, { status: "cancelled" });
        return null;
      }
      tx.update(job.ref, { status: "delivering", lease, leaseUntil: now + 12e4 });
      return s;
    });
    if (!d)
      continue;
    let query = db.collection("users").orderBy("__name__");
    if (d.cursor)
      query = query.startAfter(d.cursor);
    const users = d.audience === "user" ? [await ref("users", d.targetUid).get()] : (await query.limit(50).get()).docs;
    for (const user of users) {
      if (!user.exists)
        continue;
      await db.runTransaction(async (tx) => {
        const pointer = db.doc(`sparkProfiles/${user.id}/inbox/${job.id}`);
        const [staff, profile, recipient, access, latest, campaign, old] = await Promise.all([tx.get(ref("orinStaff", d.publishedBy)), tx.get(ref("users", d.publishedBy)), tx.get(user.ref), tx.get(ref("orinControlAccess", user.id)), tx.get(job.ref), tx.get(ref("orinControlNotifications", d.campaignId)), tx.get(pointer)]);
        if (old.exists || latest.data()?.lease !== lease || latest.data()?.leaseUntil < Date.now() || campaign.data()?.revision !== d.revision || recipient.data()?.disabled || access.data()?.status === "suspended" || profile.data()?.disabled || staff.data()?.status !== "active" || staff.data()?.validAfter > d.publishedAt || !permissionsFor(staff.data()?.roles).includes("notifications.manage"))
          return;
        if (d.audience === "segment") {
          let eligible = true;
          if (d.segment === "agents")
            eligible = (await tx.get(ref("orinProgramMembers", user.id))).data()?.agencyGranted === true;
          else if (d.segment === "verified") {
            const verified = (await tx.get(ref("orinVerifiedCustomers", user.id))).data();
            eligible = verified?.verified === true && !verified?.revoked;
          } else if (["real", "demo"].includes(d.segment))
            eligible = !(await tx.get(db.collection(`sparkTradingAccounts/${user.id}/accounts`).where("type", "==", d.segment).limit(1))).empty;
          if (!eligible)
            return;
        }
        tx.set(ref("sparkAnnouncements", job.id), { id: job.id, title: d.title, message: d.message, image: "", deep_link: "/notifications", expires_at: d.expiresAt, createdAt: FieldValue.serverTimestamp() });
        tx.create(pointer, { readAt: null, archivedAt: null, createdAt: FieldValue.serverTimestamp() });
        tx.create(ref("orinControlNotificationDelivery", hash(job.id + ":" + user.id)), { jobId: job.id, campaignId: d.campaignId, uid: user.id, status: "in_app_delivered", createdAt: now });
      });
    }
    const delivered = (await db.collection("orinControlNotificationDelivery").where("jobId", "==", job.id).count().get()).data().count, more = d.audience !== "user" && users.length === 50;
    await db.runTransaction(async (tx) => {
      const [latest, campaign] = await Promise.all([tx.get(job.ref), tx.get(ref("orinControlNotifications", d.campaignId))]);
      if (latest.data()?.lease !== lease)
        return;
      tx.update(job.ref, { status: more ? "delivering" : "completed", cursor: users.at(-1)?.id ?? null, delivered, leaseUntil: 0 });
      if (campaign.data()?.revision === d.revision)
        tx.update(campaign.ref, { status: more ? "delivering" : "completed", delivered, lastDeliveryAt: now });
    });
  }
  return { enabled: true, checked: jobs.size };
}

// firebase-functions/src/contracts.ts
async function publish(u, input, now = Date.now()) {
  const title = typeof input.title === "string" ? input.title.trim() : "", asset = input.asset, direction = input.direction, duration = Number(input.durationSec), bps = Number(input.settlementBps), opensAt = Number(input.opensAt), closesAt = Number(input.closesAt), eligibility = input.eligibility ?? "all";
  if (!title || title.length > 80 || !Object.hasOwn(ASSETS, asset) || !["BUY", "SELL"].includes(direction)) throw new ApiError("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0639\u0642\u062F \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629.");
  if (!Number.isInteger(duration) || duration < 60 || duration > 300 || !Number.isInteger(bps) || Math.abs(bps) > 1e3) throw new ApiError("\u0627\u0644\u0645\u062F\u0629 60\u2013300 \u062B\u0627\u0646\u064A\u0629 \u0648\u0627\u0644\u062A\u0633\u0648\u064A\u0629 \u0645\u0646 \u200E-10% \u0625\u0644\u0649 \u200E+10%.");
  if (!["all", "standard", "advanced"].includes(eligibility) || !Number.isSafeInteger(opensAt) || !Number.isSafeInteger(closesAt) || opensAt < now - 6e4 || closesAt <= Math.max(now, opensAt) || closesAt - opensAt > 30 * 864e5) throw new ApiError("\u0646\u0627\u0641\u0630\u0629 \u0627\u0644\u0645\u0634\u0627\u0631\u0643\u0629 \u0623\u0648 \u0627\u0644\u0623\u0647\u0644\u064A\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629.");
  const key3 = id(), code = `LAB-${id().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
  const terms = { version: 1, mode: "virtual-test-only", id: key3, code, title, asset, direction, durationSec: duration, settlementBps: bps, eligibility, opensAt, closesAt, publishedAt: now, adminId: u.id }, canonical = JSON.stringify(terms), digest = hash(canonical);
  await db.runTransaction(async (tx) => {
    if ((await tx.get(ref("system", "control-center"))).exists) throw new ApiError("Use the audited Control Center workflow", 409);
    await check(tx, u, true);
    const existing = await tx.get(ref("orinCodes", code));
    if (existing.exists) throw new ApiError("\u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0644\u0625\u0646\u0634\u0627\u0621 \u0643\u0648\u062F \u062C\u062F\u064A\u062F.", 409);
    tx.create(ref("orinContracts", key3), { id: key3, code, title, asset, direction, duration_sec: duration, settlement_bps: bps, eligibility, opens_at: opensAt, closes_at: closesAt, published_at: now, admin_id: u.id, canonical, hash: digest, participants: 0 });
    tx.create(ref("orinCodes", code), { contractId: key3 });
    audit(tx, `publish:${key3}`, u.id, "CONTRACT_PUBLISHED_AND_LOCKED", key3, { terms, sha256: digest }, now);
    notice(tx, `publish:${key3}`, "*", "\u062F\u0639\u0648\u0629 \u062C\u062F\u064A\u062F\u0629 \u0645\u0646 ORIN", `${title} \xB7 \u0627\u0644\u0643\u0648\u062F ${code} \xB7 \u062A\u0633\u0648\u064A\u0629 \u062F\u0627\u062E\u0644\u064A\u0629 \u0645\u062D\u062F\u062F\u0629 \u0645\u0633\u0628\u0642\u064B\u0627`, key3, now, { eligibility });
  });
  return { id: key3, code, hash: digest };
}
function integrity(c) {
  if (hash(c.canonical) !== c.hash) throw new ApiError("\u062A\u0639\u0630\u0631 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0633\u0644\u0627\u0645\u0629 \u0627\u0644\u0639\u0642\u062F.", 409);
}
async function verify(u, value, now = Date.now()) {
  await bootstrap(u, now);
  if (typeof value !== "string" || !/^LAB-[A-F0-9]{10}$/.test(value.trim().toUpperCase())) throw new ApiError("\u0643\u0648\u062F \u0627\u0644\u062F\u0639\u0648\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.");
  const code = await ref("orinCodes", value.trim().toUpperCase()).get(), a = (await account(u.id).get()).data(), c = code.exists ? (await ref("orinContracts", code.data().contractId).get()).data() : null;
  if (!c || c.eligibility !== "all" && c.eligibility !== a.tier) throw new ApiError("\u0644\u0627 \u062A\u0648\u062C\u062F \u062F\u0639\u0648\u0629 \u0645\u062A\u0627\u062D\u0629 \u0644\u062D\u0633\u0627\u0628\u0643 \u0628\u0647\u0630\u0627 \u0627\u0644\u0643\u0648\u062F.", 404);
  if ((await ref("orinControlContractStates", c.id).get()).data()?.status === "revoked") throw new ApiError("Contract code revoked", 409);
  integrity(c);
  return { contract: c, serverTime: now };
}
async function join(u, input, now = Date.now()) {
  const code = String(input.code ?? "").trim().toUpperCase(), amount = Number(input.amountCents);
  if (!/^LAB-[A-F0-9]{10}$/.test(code) || !Number.isSafeInteger(amount) || amount < 100 || amount > 1e8 || input.confirmed !== true) throw new ApiError("\u0631\u0627\u062C\u0639 \u0627\u0644\u0645\u0628\u0644\u063A \u0648\u0623\u0643\u0651\u062F \u0634\u0631\u0648\u0637 \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A.");
  return db.runTransaction(async (tx) => {
    await check(tx, u, false, true);
    const a = (await tx.get(account(u.id))).data(), lookup = await tx.get(ref("orinCodes", code));
    const c = lookup.exists ? (await tx.get(ref("orinContracts", lookup.data().contractId))).data() : null;
    if (c && (await tx.get(ref("orinControlContractStates", c.id))).data()?.status === "revoked") throw new ApiError("Contract code revoked", 409);
    if (!c || c.eligibility !== "all" && c.eligibility !== a.tier) throw new ApiError("\u0627\u0644\u062F\u0639\u0648\u0629 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u0644\u062D\u0633\u0627\u0628\u0643.", 404);
    if (a.profile.closureStatus !== "open" || !a.accepted_at) throw new ApiError("\u064A\u062C\u0628 \u0642\u0628\u0648\u0644 \u0627\u0644\u0634\u0631\u0648\u0637 \u0648\u0623\u0646 \u064A\u0643\u0648\u0646 \u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u0641\u062A\u0648\u062D\u064B\u0627.", 403);
    integrity(c);
    if (input.contractHash !== c.hash) throw new ApiError("\u0631\u0627\u062C\u0639 \u0634\u0631\u0648\u0637 \u0627\u0644\u0639\u0642\u062F \u0627\u0644\u062D\u0627\u0644\u064A\u0629.", 409);
    const key3 = hash(`position:${u.id}:${c.id}`), previous = await tx.get(ref("orinPositions", key3));
    if (previous.exists) {
      if (previous.data().amount_cents !== amount) throw new ApiError("\u0633\u0628\u0642 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u0628\u0645\u0628\u0644\u063A \u0645\u062E\u062A\u0644\u0641.", 409);
      return { id: key3, reused: true };
    }
    if (now < c.opens_at || now >= c.closes_at) throw new ApiError("\u0627\u0644\u0639\u0642\u062F \u062E\u0627\u0631\u062C \u0646\u0627\u0641\u0630\u0629 \u0627\u0644\u0645\u0634\u0627\u0631\u0643\u0629.", 409);
    if (a.balanceCents < amount) throw new ApiError("\u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A \u0627\u0644\u0645\u062A\u0627\u062D \u063A\u064A\u0631 \u0643\u0627\u0641\u064D.", 409);
    const counterRef = ref("orinContractCounts", c.id), count = (await tx.get(counterRef)).data()?.count ?? 0;
    const endsAt = now + c.duration_sec * 1e3, pnl = resultCents(amount, c.settlement_bps);
    tx.create(ref("orinPositions", key3), { id: key3, user_id: u.id, contract_id: c.id, amount_cents: amount, result_cents: pnl, started_at: now, ends_at: endsAt, status: "active", settled_at: null, contract: c });
    tx.update(account(u.id), { balanceCents: a.balanceCents - amount, reservedCents: a.reservedCents + amount });
    tx.set(counterRef, { count: count + 1 });
    journal(tx, `allocate:${key3}`, u.id, "allocation", key3, [[`user:${u.id}:cash`, -amount], [`user:${u.id}:reserved`, amount]], now, now);
    audit(tx, `join:${key3}`, u.id, "VIRTUAL_AMOUNT_ALLOCATED", key3, { contractId: c.id, contractHash: c.hash, amountCents: amount, startedAt: now, endsAt, internalSettlement: true }, now);
    notice(tx, `start:${key3}`, u.id, "\u0628\u062F\u0623 \u0627\u0644\u0639\u0642\u062F \u0627\u0644\u062F\u0627\u062E\u0644\u064A", `${c.title} \xB7 \u0631\u0635\u064A\u062F \u0627\u0641\u062A\u0631\u0627\u0636\u064A`, c.id, now);
    return { id: key3, reused: false };
  });
}
export {
  CONTROL_MODULES,
  PERMISSIONS,
  ROLES,
  acceptStaffInvitation,
  controlAccess,
  controlAccount,
  controlAction,
  controlDocument,
  controlProgramConfiguration,
  controlRead,
  controlSession,
  controlUser,
  db,
  deliverControlNotifications,
  hash,
  check as legacyCheck,
  join as legacyJoin,
  publish as legacyPublish,
  verify as legacyVerify,
  permissionsFor,
  requirePermission
};
