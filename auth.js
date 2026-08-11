// auth.js
// Signup/Login using custom handles (e.g. @arun34) - NO phone number required.
// Client generates its own public/private keypair (libsodium) BEFORE signup.
// Only the PUBLIC key is sent to server. Private key never leaves the device.

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production';

// POST /auth/signup
router.post('/signup', (req, res) => {
  const { handle, password, publicKey } = req.body;

  if (!handle || !password || !publicKey) {
    return res.status(400).json({ error: 'handle, password, and publicKey are required' });
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(handle)) {
    return res.status(400).json({ error: 'handle must be 3-20 chars, letters/numbers/underscore only' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE handle = ?').get(handle);
  if (existing) {
    return res.status(409).json({ error: 'handle already taken' });
  }

  const password_hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (handle, password_hash, public_key) VALUES (?, ?, ?)')
    .run(handle, password_hash, publicKey);

  const token = jwt.sign({ handle }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, handle });
});

// POST /auth/login
router.post('/login', (req, res) => {
  const { handle, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE handle = ?').get(handle);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'invalid handle or password' });
  }

  const token = jwt.sign({ handle }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, handle });
});

// GET /auth/publickey/:handle -> needed so sender can encrypt for receiver
router.get('/publickey/:handle', (req, res) => {
  const user = db.prepare('SELECT public_key FROM users WHERE handle = ?').get(req.params.handle);
  if (!user) return res.status(404).json({ error: 'user not found' });
  res.json({ publicKey: user.public_key });
});

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'no token provided' });
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.handle = decoded.handle;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

module.exports = { router, authMiddleware, JWT_SECRET };
