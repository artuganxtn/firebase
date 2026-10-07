import express from 'express';
import cors from 'cors';
import {
  handle,
  paymentsHandle,
  securityHandle,
  identityHandle,
  deliverControlNotifications
} from './lib/index.js';

const app = express();
const port = Number(process.env.PORT) || 10000;

// Configurable CORS origins
const defaultOrigins = [
  'https://orin-99951.web.app',
  'https://orin-99951.firebaseapp.com'
];
const allowedOrigins = [...defaultOrigins];
if (process.env.ALLOWED_ORIGINS) {
  allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()));
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    // Allow Render subdomains if requested
    if (origin.endsWith('.onrender.com')) return callback(null, true);
    return callback(null, true); // Allow client requests, handlers do origin checks internally as needed
  },
  credentials: true,
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Orin-Session', 'x-nowpayments-sig'],
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS']
}));

// Body parsing with generous limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health and Status endpoints
app.get('/', (req, res) => {
  res.json({
    ok: true,
    app: 'ORIN',
    role: 'Production Standalone Backend (Render)',
    status: 'online',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ ok: true, app: 'ORIN', status: 'healthy', timestamp: Date.now() });
});

// Automatically load .env if available (Node 21.7+)
try {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile();
  }
} catch {
  // Ignore if .env is missing or variables are provided by host environment
}

// Mount specialized handlers
// Payments (NOWPayments invoices, status refresh, IPN webhook)
app.use('/api/payments', (req, res) => {
  req.url = '/api/payments' + req.url;
  paymentsHandle(req, res);
});
app.use('/orinPayments', (req, res) => {
  paymentsHandle(req, res);
});

// Security (2FA, sessions, passkeys, step-up)
app.use('/api/security', (req, res) => {
  req.url = '/api/security' + req.url;
  securityHandle(req, res);
});
app.use('/orinSecurity', (req, res) => {
  securityHandle(req, res);
});

// Identity (email challenge verification, registration)
app.use('/api/identity', (req, res) => {
  identityHandle(req, res);
});
app.use('/orinIdentity', (req, res) => {
  identityHandle(req, res);
});
app.post('/send-code', (req, res) => {
  req.url = '/send-code';
  identityHandle(req, res);
});
app.post('/register', (req, res) => {
  req.url = '/register';
  identityHandle(req, res);
});

// Main API (Gemini Assistant, Control Center, Referral, Programs, Settings)
app.use('/api', (req, res) => {
  req.url = '/api' + req.url;
  handle(req, res);
});
app.use('/orinApi', (req, res) => {
  handle(req, res);
});

// Background Control Worker (every 60 seconds)
if (typeof deliverControlNotifications === 'function') {
  setInterval(() => {
    deliverControlNotifications().catch(err => {
      console.error('[ORIN Worker] Delivery tick error:', err?.message || err);
    });
  }, 60_000);
}

app.listen(port, '0.0.0.0', () => {
  console.log(`[ORIN Server] Backend running at http://0.0.0.0:${port}`);
  console.log(`[ORIN Server] Ready to receive NOWPayments webhooks and Gemini AI requests.`);
});
