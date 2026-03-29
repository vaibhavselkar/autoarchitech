'use strict';
const express    = require('express');
const jwt        = require('jsonwebtoken');
const User       = require('../models/User');
const DesignRule = require('../models/DesignRule');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'Banayengakyaghartoiskojaldistemaalkr';

// ── Auth middleware ──────────────────────────────────────────────────────────
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'No token' });
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId   = decoded.userId;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// ── Admin-only middleware ────────────────────────────────────────────────────
const adminMiddleware = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('role');
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const guard = [authMiddleware, adminMiddleware];

// ── Default rules seeded on first load ───────────────────────────────────────
const DEFAULT_RULES = [
  // Room minimums
  { category: 'room_minimum', name: 'Living Room — Min Width',  roomType: 'living_room',    minWidth: 12, minHeight: 10, severity: 'error',   description: 'Living room must be at least 12ft wide and 10ft deep (NBC 2016)' },
  { category: 'room_minimum', name: 'Living Room — Min Height', roomType: 'living_room',    minWidth: 10, minHeight: 12, severity: 'error',   description: 'Living room depth must be at least 12ft' },
  { category: 'room_minimum', name: 'Master Bedroom — Min',     roomType: 'master_bedroom', minWidth: 12, minHeight: 12, severity: 'error',   description: 'Master bedroom minimum 12×12ft (NBC 2016)' },
  { category: 'room_minimum', name: 'Bedroom — Min',            roomType: 'bedroom',        minWidth: 10, minHeight: 10, severity: 'error',   description: 'Standard bedroom minimum 10×10ft' },
  { category: 'room_minimum', name: 'Kitchen — Min',            roomType: 'kitchen',        minWidth: 8,  minHeight: 7,  severity: 'error',   description: 'Kitchen minimum 8ft wide × 7ft deep (NBC 2016)' },
  { category: 'room_minimum', name: 'Dining — Min',             roomType: 'dining',         minWidth: 10, minHeight: 10, severity: 'error',   description: 'Dining room minimum 10×10ft' },
  { category: 'room_minimum', name: 'Bathroom — Min',           roomType: 'bathroom',       minWidth: 5,  minHeight: 7,  severity: 'error',   description: 'Bathroom minimum 5ft wide × 7ft deep (NBC 2016)' },
  { category: 'room_minimum', name: 'Balcony — Min Depth',      roomType: 'balcony',        minWidth: 8,  minHeight: 4,  severity: 'warning', description: 'Balcony must be at least 4ft deep to be usable' },
  { category: 'room_minimum', name: 'Parking — Min Size',       roomType: 'parking',        minWidth: 9,  minHeight: 18, severity: 'error',   description: 'Parking must fit a standard Indian car (9×18ft)' },
  // Forbidden adjacencies
  { category: 'adjacency_forbidden', name: 'Bathroom ≠ Kitchen', roomTypeA: 'bathroom', roomTypeB: 'kitchen', severity: 'error', description: 'Bathroom must never share a wall with kitchen — hygiene and building code' },
  { category: 'adjacency_forbidden', name: 'Bathroom ≠ Dining',  roomTypeA: 'bathroom', roomTypeB: 'dining',  severity: 'error', description: 'Bathroom must not be adjacent to dining room' },
  // Required adjacencies
  { category: 'adjacency_required', name: 'Kitchen adj. Dining', roomTypeA: 'kitchen', roomTypeB: 'dining', severity: 'error', description: 'Kitchen must share a wall with dining room for practical workflow' },
  // Zone rules
  { category: 'zone_rule', name: 'Balcony — Front Zone',         roomType: 'balcony',        zone: 'front',  zoneYMin: 0,    zoneYMax: 0.35, severity: 'warning', description: 'Balcony should face the road (front zone)' },
  { category: 'zone_rule', name: 'Master Bedroom — Rear Zone',   roomType: 'master_bedroom', zone: 'rear',   zoneYMin: 0.50, zoneYMax: 1.0,  severity: 'warning', description: 'Master bedroom should be at the rear for privacy' },
  { category: 'zone_rule', name: 'Kitchen — Middle/Rear Zone',   roomType: 'kitchen',        zone: 'middle', zoneYMin: 0.20, zoneYMax: 0.85, severity: 'warning', description: 'Kitchen away from road noise — middle or rear zone' },
  // Mandatory rooms
  { category: 'mandatory_room', name: 'Must have Living Room', roomType: 'living_room',    severity: 'error',   description: 'Every plan must include a living room' },
  { category: 'mandatory_room', name: 'Must have Kitchen',     roomType: 'kitchen',        severity: 'error',   description: 'Every plan must include a kitchen' },
  { category: 'mandatory_room', name: 'Must have Dining',      roomType: 'dining',         severity: 'error',   description: 'Every plan must include a dining room' },
  { category: 'mandatory_room', name: 'Must have Master Bed',  roomType: 'master_bedroom', severity: 'error',   description: 'Every plan must include a master bedroom' },
  // Score threshold
  { category: 'score_threshold', name: 'Minimum Plan Quality', minScore: 70, severity: 'error', description: 'Plans scoring below 70/100 are rejected and regenerated' },
];

// ── GET /api/admin/rules ─────────────────────────────────────────────────────
router.get('/rules', guard, async (req, res) => {
  try {
    let rules = await DesignRule.find().sort({ category: 1, name: 1 });

    // Seed defaults if DB is empty
    if (rules.length === 0) {
      await DesignRule.insertMany(DEFAULT_RULES.map(r => ({ ...r, createdBy: req.userId })));
      rules = await DesignRule.find().sort({ category: 1, name: 1 });
    }

    res.json({ success: true, data: { rules, total: rules.length } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/admin/rules ────────────────────────────────────────────────────
router.post('/rules', guard, async (req, res) => {
  try {
    const rule = await DesignRule.create({ ...req.body, createdBy: req.userId });
    res.status(201).json({ success: true, data: { rule } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── PATCH /api/admin/rules/:id ───────────────────────────────────────────────
router.patch('/rules/:id', guard, async (req, res) => {
  try {
    const rule = await DesignRule.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!rule) return res.status(404).json({ success: false, message: 'Rule not found' });
    res.json({ success: true, data: { rule } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/admin/rules/:id ──────────────────────────────────────────────
router.delete('/rules/:id', guard, async (req, res) => {
  try {
    await DesignRule.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── POST /api/admin/rules/seed ── restore defaults ──────────────────────────
router.post('/rules/seed', guard, async (req, res) => {
  try {
    await DesignRule.deleteMany({});
    const rules = await DesignRule.insertMany(
      DEFAULT_RULES.map(r => ({ ...r, createdBy: req.userId }))
    );
    res.json({ success: true, data: { rules, total: rules.length } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/admin/promote?email=x ── promote user to admin (dev utility) ───
router.get('/promote', authMiddleware, async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ success: false, message: 'email required' });
    const user = await User.findOneAndUpdate({ email }, { role: 'admin' }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: `${user.email} is now admin` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
