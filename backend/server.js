const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');

// Load environment variables
dotenv.config();

// ── Required env vars ────────────────────────────────────────────────────────
// Fail fast rather than silently falling back to a shared default secret,
// which would let anyone forge valid auth tokens.
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set.');
  process.exit(1);
}

// Import routes (after env validation, since some modules read JWT_SECRET at import time)
const planRoutes  = require('./routes/plans');
const authRoutes  = require('./routes/auth');
const aiRoutes    = require('./routes/ai');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);

// ── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow exported SVG/PDF/DXF downloads
}));

// ── Request logging ──────────────────────────────────────────────────────────
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── CORS ──────────────────────────────────────────────────────────────────────
// Uses Bearer tokens (not cookies) so credentials: false is safe.
// Allows all *.vercel.app preview URLs automatically.
const DEV_ORIGINS = ['http://localhost:3000', 'http://localhost:3004', 'http://localhost:5173'];

const envOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(u => u.trim()).filter(Boolean)
  : [];

const CORS_OPTIONS = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);                      // server-to-server / curl
    if (origin.endsWith('.vercel.app')) return callback(null, true); // all vercel deployments
    if ([...envOrigins, ...DEV_ORIGINS].includes(origin)) return callback(null, true);
    console.warn(`CORS: rejected request from origin "${origin}"`);
    callback(null, false); // silently reject (don't throw — prevents 500 on preflight)
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
};

// Handle OPTIONS preflight for every route FIRST, before any other middleware
app.options('*', cors(CORS_OPTIONS));
app.use(cors(CORS_OPTIONS));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts, please try again later.' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many AI requests, please slow down.' },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', apiLimiter);

// ── Database ──────────────────────────────────────────────────────────────────
// On serverless, module state may be lost between invocations.
// connectDB() is called as middleware so every request ensures a live connection.
let cachedConn = null;
async function connectDB() {
  if (mongoose.connection.readyState === 1) return; // already connected
  if (cachedConn) return cachedConn;                // connection in progress

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI environment variable is not set');

  cachedConn = await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8000,
    socketTimeoutMS: 45000,
  });
  console.log('MongoDB connected');
  return cachedConn;
}

// Middleware: ensure DB is connected before every API request
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('DB connection failed:', err.message);
    res.status(503).json({ error: 'Database unavailable', message: err.message });
  }
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',  authLimiter, authRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/ai',    aiLimiter, aiRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'AutoArchitect Backend is running', timestamp: new Date().toISOString() });
});

// ── 404 (JSON, consistent shape) ─────────────────────────────────────────────
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  const isProd = process.env.NODE_ENV === 'production';
  res.status(err.status || 500).json({
    error: 'Something went wrong!',
    message: isProd ? 'Internal server error' : err.message,
  });
});

// ── Process safety nets ──────────────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  // Serverless functions live per-invocation; on a long-running process this
  // state may now be corrupt, so exit and let the process manager restart it.
  if (!process.env.VERCEL) process.exit(1);
});

// ── Local dev server ──────────────────────────────────────────────────────────
if (!process.env.VERCEL) {
  const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down gracefully...`);
    server.close(async () => {
      await mongoose.connection.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app;
