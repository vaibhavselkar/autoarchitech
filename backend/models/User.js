const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please enter a valid email'
    ]
  },
  password: {
    type: String,
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  authProvider: {
    type: String,
    enum: ['email', 'google'],
    default: 'email'
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  profilePicture: {
    type: String
  },
  preferences: {
    defaultPlotSize: {
      width: { type: Number, default: 40 },
      length: { type: Number, default: 60 }
    },
    defaultFacing: { type: String, default: 'north' },
    defaultRooms: {
      bedrooms: { type: Number, default: 3 },
      bathrooms: { type: Number, default: 2 },
      kitchen: { type: Number, default: 1 }
    }
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

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);