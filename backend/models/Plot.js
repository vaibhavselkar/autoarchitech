const mongoose = require('mongoose');

const plotSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  width: {
    type: Number,
    required: [true, 'Plot width is required'],
    min: [10, 'Plot width must be at least 10 feet'],
    max: [200, 'Plot width cannot exceed 200 feet']
  },
  length: {
    type: Number,
    required: [true, 'Plot length is required'],
    min: [10, 'Plot length must be at least 10 feet'],
    max: [300, 'Plot length cannot exceed 300 feet']
  },
  facing: {
    type: String,
    required: [true, 'Facing direction is required'],
    enum: ['north', 'south', 'east', 'west'],
    lowercase: true
  },
  setback: {
    front: { type: Number, default: 6 },
    back: { type: Number, default: 4 },
    left: { type: Number, default: 4 },
    right: { type: Number, default: 4 }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Plot', plotSchema);