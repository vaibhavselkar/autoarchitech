const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const axios = require('axios');

/**
 * Authentication Service with Google OAuth integration
 */
class AuthService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    this.googleClientId = process.env.GOOGLE_CLIENT_ID;
    this.googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    this.googleRedirectUri = process.env.GOOGLE_REDIRECT_URI;
  }

  /**
   * Register a new user
   */
  async register(userData) {
    try {
      const { name, email, password } = userData;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new Error('User already exists');
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create user
      const user = new User({
        name,
        email,
        password: hashedPassword,
        authProvider: 'email'
      });

      await user.save();

      // Generate JWT token
      const token = this.generateToken(user._id);

      return {
        success: true,
        message: 'User registered successfully',
        data: {
          user: this.sanitizeUser(user),
          token
        }
      };

    } catch (error) {
      throw new Error(error.message || 'Registration failed');
    }
  }

  /**
   * Login user with email/password
   */
  async login(email, password) {
    try {
      // Find user
      const user = await User.findOne({ email });
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }

      // Generate JWT token
      const token = this.generateToken(user._id);

      return {
        success: true,
        message: 'Login successful',
        data: {
          user: this.sanitizeUser(user),
          token
        }
      };

    } catch (error) {
      throw new Error(error.message || 'Login failed');
    }
  }

  /**
   * Google OAuth login
   */
  async googleLogin(code) {
    try {
      // Exchange code for tokens
      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: this.googleClientId,
        client_secret: this.googleClientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: this.googleRedirectUri
      });

      const { access_token } = tokenResponse.data;

      // Get user info from Google
      const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      });

      const googleUser = userInfoResponse.data;

      // Check if user exists
      let user = await User.findOne({ email: googleUser.email });

      if (!user) {
        // Create new user
        user = new User({
          name: googleUser.name,
          email: googleUser.email,
          password: null, // No password for Google auth
          authProvider: 'google',
          googleId: googleUser.id,
          profilePicture: googleUser.picture
        });

        await user.save();
      } else if (!user.authProvider) {
        // Update existing user with Google info
        user.authProvider = 'google';
        user.googleId = googleUser.id;
        user.profilePicture = googleUser.picture;
        await user.save();
      }

      // Generate JWT token
      const token = this.generateToken(user._id);

      return {
        success: true,
        message: 'Google login successful',
        data: {
          user: this.sanitizeUser(user),
          token
        }
      };

    } catch (error) {
      console.error('Google login error:', error);
      throw new Error('Google authentication failed');
    }
  }

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      return { valid: true, userId: decoded.userId };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Get user profile
   */
  async getProfile(userId) {
    try {
      const user = await User.findById(userId).select('-password');
      if (!user) {
        throw new Error('User not found');
      }

      return {
        success: true,
        data: {
          user: this.sanitizeUser(user)
        }
      };
    } catch (error) {
      throw new Error(error.message || 'Failed to get profile');
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(userId, updateData) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Update fields
      Object.keys(updateData).forEach(key => {
        if (key !== 'password' && updateData[key]) {
          user[key] = updateData[key];
        }
      });

      await user.save();

      return {
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: this.sanitizeUser(user)
        }
      };
    } catch (error) {
      throw new Error(error.message || 'Failed to update profile');
    }
  }

  /**
   * Generate JWT token
   */
  generateToken(userId) {
    return jwt.sign({ userId }, this.jwtSecret, {
      expiresIn: '7d'
    });
  }

  /**
   * Sanitize user object (remove sensitive data)
   */
  sanitizeUser(user) {
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      authProvider: user.authProvider,
      profilePicture: user.profilePicture,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  /**
   * Get Google OAuth URL
   */
  getGoogleAuthUrl() {
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ].join(' ');

    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${this.googleClientId}&redirect_uri=${encodeURIComponent(this.googleRedirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline`;
  }
}

module.exports = new AuthService();