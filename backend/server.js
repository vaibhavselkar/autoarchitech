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
let cachedConn = null;
async function connectDB() {
  if (cachedConn && mongoose.connection.readyState === 1) return cachedConn;
  cachedConn = await mongoose.connect(
    process.env.MONGODB_URI || 'mongodb://localhost:27017/autoarchitect'
  );
  console.log('MongoDB connected');
  return cachedConn;
}
connectDB().catch(err => console.error('MongoDB connection error:', err));

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
