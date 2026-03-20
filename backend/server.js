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

// Middleware — CORS
const DEV_ORIGINS = ['http://localhost:3000', 'http://localhost:3004', 'http://localhost:5173'];

// FRONTEND_URL can be a single URL or comma-separated list
const envOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(u => u.trim()).filter(Boolean)
  : [];

const allowedOrigins = [...envOrigins, ...DEV_ORIGINS];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, mobile)
    if (!origin) return callback(null, true);
    // Allow if explicitly listed
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Allow all *.vercel.app preview deployments
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection — cached for serverless environments
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

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/ai', aiRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'AutoArchitect Backend is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: err.message
  });
});

// Start server only outside Vercel (local dev)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;