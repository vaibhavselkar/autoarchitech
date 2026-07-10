const express = require('express');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { JWT_SECRET, authMiddleware } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Register a new user
router.post('/register', asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Name, email and password are required'
    });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'User already exists with this email'
    });
  }

  const user = new User({ name, email, password });
  await user.save();

  const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      }
    }
  });
}));

// Login user
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }

  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      }
    }
  });
}));

// Get current user profile
router.get('/profile', authMiddleware, asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId).select('-password');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  res.json({
    success: true,
    data: { user }
  });
}));

// Google OAuth — verify ID token from frontend, return our JWT
router.post('/google', asyncHandler(async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ success: false, message: 'Google credential is required' });
  }

  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
  } catch (error) {
    console.error('Google credential verification failed:', error.message);
    return res.status(401).json({ success: false, message: 'Invalid Google credential' });
  }

  const payload = ticket.getPayload();
  const { sub: googleId, email, name, picture } = payload;

  // Find or create user
  let user = await User.findOne({ $or: [{ googleId }, { email }] });

  if (user) {
    // Existing user — update Google fields if missing
    if (!user.googleId) {
      user.googleId = googleId;
      user.authProvider = 'google';
      user.profilePicture = user.profilePicture || picture;
      await user.save();
    }
  } else {
    // New user via Google
    user = new User({
      name,
      email,
      googleId,
      authProvider: 'google',
      profilePicture: picture,
    });
    await user.save();
  }

  const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

  res.json({
    success: true,
    message: 'Google login successful',
    data: {
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, profilePicture: user.profilePicture },
    },
  });
}));

module.exports = router;
