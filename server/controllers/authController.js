const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// In-memory store for OAuth states (state -> expiry timestamp)
const oauthStateStore = new Map();

const generateToken = (userId, email) => {
  return jwt.sign({ userId, email }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

exports.signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Please provide all fields' });
    }

    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    if (user) {
      res.status(201).json({
        token: generateToken(user._id, user.email),
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
        },
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        token: generateToken(user._id, user.email),
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
        },
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.googleAuth = (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  // Store state for 10 minutes
  oauthStateStore.set(state, Date.now() + 10 * 60 * 1000);
  
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = 'http://localhost:5000/api/auth/google/callback';
  const scope = 'openid email profile';
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=select_account&state=${state}`;
  
  res.redirect(authUrl);
};

exports.googleCallback = async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      console.error('Missing code or state from Google');
      return res.redirect('http://localhost:5173/auth-error');
    }

    // Validate state
    const expiration = oauthStateStore.get(state);
    if (!expiration || Date.now() > expiration) {
      if (expiration) oauthStateStore.delete(state);
      console.error('Invalid or expired state during Google OAuth callback');
      return res.redirect('http://localhost:5173/auth-error');
    }
    // State is valid, remove it to prevent replay
    oauthStateStore.delete(state);

    // Exchange code for tokens
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = 'http://localhost:5000/api/auth/google/callback';

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      console.error('Failed to get access token from Google:', tokenData);
      return res.redirect('http://localhost:5173/auth-error');
    }

    // Fetch user metadata/profile
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`
      }
    });

    const userInfo = await userInfoResponse.json();

    if (!userInfo.email) {
       console.error('No email provided from Google user info');
       return res.redirect('http://localhost:5173/auth-error');
    }

    // User lookup and creation
    let user = await User.findOne({ email: userInfo.email });

    if (!user) {
      // Minimal schema approach
      user = await User.create({
        email: userInfo.email,
        name: userInfo.name,
        avatar: userInfo.picture,
        username: userInfo.email.split('@')[0] // Fallback for UI that still needs username
      });
    } else {
      // Optionally sync their name and avatar
      user.name = userInfo.name || user.name;
      user.avatar = userInfo.picture || user.avatar;
      await user.save();
    }

    // JWT Creation matching the application schema
    const token = generateToken(user._id, user.email);

    // Redirect safely back to frontend with the token
    res.redirect(`http://localhost:5173/auth-success?token=${token}`);

  } catch (error) {
    console.error('Google OAuth Error:', error);
    res.redirect('http://localhost:5173/auth-error');
  }
};
