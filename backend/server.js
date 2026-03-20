const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Import routes
const planRoutes = require('./routes/plans');
const authRoutes = require('./routes/auth');
const aiRoutes = require('./routes/ai');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

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
    callback(null, false); // silently reject (don't throw — prevents 500 on preflight)
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
};

// Handle OPTIONS preflight for every route FIRST, before any other middleware
app.options('*', cors(CORS_OPTIONS));
app.use(cors(CORS_OPTIONS));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use('/api/auth', authRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/ai', aiRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'AutoArchitect Backend is running', timestamp: new Date().toISOString() });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!', message: err.message });
});

// ── Local dev server ──────────────────────────────────────────────────────────
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
