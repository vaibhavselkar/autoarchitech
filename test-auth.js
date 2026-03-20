const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/autoarchitect', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// User schema
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: { type: String, select: false }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

async function testAuth() {
  try {
    // Test password hashing and comparison
    const testPassword = 'password123';
    const user = new User({
      name: 'Test User',
      email: 'test@example.com',
      password: testPassword
    });

    await user.save();
    console.log('User created with password:', testPassword);
    console.log('Hashed password in DB:', user.password);

    // Test password comparison
    const isValid = await user.comparePassword(testPassword);
    console.log('Password comparison result:', isValid);

    // Test with wrong password
    const isInvalid = await user.comparePassword('wrongpassword');
    console.log('Wrong password comparison result:', isInvalid);

    // Clean up
    await User.deleteOne({ email: 'test@example.com' });
    mongoose.disconnect();

  } catch (error) {
    console.error('Test failed:', error);
    mongoose.disconnect();
  }
}

testAuth();