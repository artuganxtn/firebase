import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT=(.*)/);
const sa = JSON.parse(match[1]);
const app = initializeApp({ credential: cert(sa) });
const db = getFirestore(app);

const DEFAULT_CONFIGURATION = {
  defaultSymbol: 'BTC-USD',
  enabledSymbols: ['BTC-USD','ETH-USD','XRP-USD','SOL-USD','BNB-USDT','DOGE-USD','TON-USDT','ADA-USD','EUR-USD','GBP-USD','XAU-USD','XAG-USD','SPX-USD','NDX-USD'],
  defaultTimeframe: '15',
  enabledTimeframes: ['1','5','15','60','240','D'],
  defaultChartType: '1',
  enabledChartTypes: ['1','2','3'],
  allowedIndicators: ['MA','EMA','RSI','MACD','BB'],
  allowedDrawingTools: [],
  volume: false,
  gridDefault: true,
  crosshairDefault: true,
  fullscreen: true,
  alerts: false,
  favorites: true
};

const DEFAULT_APP_CONFIG = {
  maintenance: false,
  messageAr: 'نعمل على تحسين ORIN. حاول بعد قليل.',
  messageEn: 'ORIN is being updated. Please try again shortly.',
  welcomeAr: '',
  welcomeEn: '',
  supportEmail: ''
};

async function seed() {
  const marketRef = db.collection('sparkConfiguration').doc('markets');
  const marketSnap = await marketRef.get();
  if (!marketSnap.exists) {
    await marketRef.set({
      configuration: DEFAULT_CONFIGURATION,
      revision: 1,
      updatedAt: FieldValue.serverTimestamp()
    });
    console.log('[SEEDED] sparkConfiguration/markets created successfully.');
  } else {
    console.log('[EXISTS] sparkConfiguration/markets already exists.');
  }

  const appRef = db.collection('sparkConfiguration').doc('app');
  const appSnap = await appRef.get();
  if (!appSnap.exists) {
    await appRef.set({
      configuration: DEFAULT_APP_CONFIG,
      revision: 1,
      updatedAt: FieldValue.serverTimestamp()
    });
    console.log('[SEEDED] sparkConfiguration/app created successfully.');
  } else {
    console.log('[EXISTS] sparkConfiguration/app already exists.');
  }
}

seed().catch(console.error);
