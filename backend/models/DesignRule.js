'use strict';
const mongoose = require('mongoose');

/**
 * DesignRule — an architectural constraint that the layout engine ALWAYS enforces.
 *
 * Rules are set by admin. They are never optional for regular users.
 * The layout generator loads all enabled rules before generating any plan.
 *
 * Categories:
 *   room_minimum     — a room type must be at least X ft wide/tall
 *   adjacency_required  — room A must share a wall with room B
 *   adjacency_forbidden — room A must NEVER share a wall with room B
 *   zone_rule        — room type must be in front/middle/rear zone
 *   mandatory_room   — this room type must always appear in every plan
 *   forbidden_room   — this room type must never appear (e.g. no prayer_room)
 *   score_threshold  — minimum validator score — plans below this are rejected
 */
const designRuleSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: [
      'room_minimum',
      'adjacency_required',
      'adjacency_forbidden',
      'zone_rule',
      'mandatory_room',
      'forbidden_room',
      'score_threshold',
    ],
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 400,
  },

  // ── room_minimum fields ─────────────────────────────────────────────────
  roomType: {
    type: String,
    enum: [
      'living_room', 'dining', 'kitchen', 'master_bedroom', 'bedroom',
      'bathroom', 'balcony', 'parking', 'staircase', 'entry', 'corridor',
      'study', 'guest_room', 'utility_room', 'prayer_room', 'terrace',
      '*',  // wildcard = applies to all room types
    ],
  },
  minWidth:  { type: Number, min: 0 },  // feet
  minHeight: { type: Number, min: 0 },  // feet

  // ── adjacency_required / adjacency_forbidden fields ──────────────────────
  roomTypeA: { type: String },  // e.g. 'kitchen'
  roomTypeB: { type: String },  // e.g. 'bathroom'

  // ── zone_rule fields ─────────────────────────────────────────────────────
  zone: {
    type: String,
    enum: ['front', 'middle', 'rear'],
  },
  // room must be within this fraction of the buildable depth
  // front=0-0.35, middle=0.35-0.65, rear=0.65-1.0
  zoneYMin: { type: Number },  // 0-1 fraction
  zoneYMax: { type: Number },  // 0-1 fraction

  // ── score_threshold fields ───────────────────────────────────────────────
  minScore: { type: Number, min: 0, max: 100 },

  // ── enforcement ──────────────────────────────────────────────────────────
  severity: {
    type: String,
    enum: ['error', 'warning'],
    default: 'error',
  },
  // error   → plan is rejected / auto-fixed until rule passes
  // warning → plan is flagged but still delivered

  enabled: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('DesignRule', designRuleSchema);
