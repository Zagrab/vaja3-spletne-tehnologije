const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getDb } = require('../db/database');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/v1/auth/register
router.post('/register', (req, res) => {
  const { email, password, first_name, last_name, university_id } = req.body;

  if (!email || !password || !first_name || !last_name) {
    return res.status(400).json({ error: 'Manjkajo obvezna polja (email, password, first_name, last_name)' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM user WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Uporabnik s tem emailom že obstaja' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO user (email, password_hash, first_name, last_name, university_id) VALUES (?, ?, ?, ?, ?)'
  ).run(email, passwordHash, first_name, last_name, university_id || null);

  const user = db.prepare('SELECT id, email, first_name, last_name, role, university_id, created_at FROM user WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(user);
});

// POST /api/v1/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Manjkata email in geslo' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM user WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Napačen email ali geslo' });
  }

  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const refreshToken = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO refresh_token (token, user_id, expires_at) VALUES (?, ?, ?)').run(refreshToken, user.id, expiresAt);

  res.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: refreshToken
  });
});

module.exports = router;
