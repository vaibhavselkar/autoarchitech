const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      'living_room', 'bedroom', 'kitchen', 'dining', 'bathroom', 
      'master_bedroom', 'guest_room', 'study', 'balcony', 'terrace'
    ]
  },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  label: { type: String }
});

const wallSchema = new mongoose.Schema({
  x1: { type: Number, required: true },
  y1: { type: Number, required: true },
  x2: { type: Number, required: true },
  y2: { type: Number, required: true },
  thickness: { type: Number, default: 0.3 }
});

const doorSchema = new mongoose.Schema({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  width: { type: Number, default: 3 },
  height: { type: Number, default: 7 },
  orientation: { type: String, enum: ['horizontal', 'vertical'] }
});

const dimensionSchema = new mongoose.Schema({
  type: { type: String, enum: ['length', 'width', 'height'] },
  value: { type: Number, required: true },
  position: {
    x: Number,
    y: Number
  }
});

const planSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  plotId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plot',
    required: true
  },
  layoutJson: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  title: {
    type: String,
    default: 'Generated Floor Plan'
  },
  description: {
    type: String
  },
  version: {
    type: Number,
    default: 1
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp before saving
planSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Plan', planSchema);