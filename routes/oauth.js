const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getDb } = require('../db/database');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/v1/oauth/token
router.post('/token', (req, res) => {
  const { grant_type } = req.body;

  if (grant_type === 'password') {
    return handlePasswordGrant(req, res);
  } else if (grant_type === 'refresh_token') {
    return handleRefreshTokenGrant(req, res);
  } else {
    return res.status(400).json({ error: 'unsupported_grant_type', error_description: 'Podprt je samo password in refresh_token grant type' });
  }
});

function handlePasswordGrant(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'Manjkata username in password' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM user WHERE email = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'invalid_grant', error_description: 'Napačni podatki za prijavo' });
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
}

function handleRefreshTokenGrant(req, res) {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'Manjka refresh_token' });
  }

  const db = getDb();
  const stored = db.prepare('SELECT * FROM refresh_token WHERE token = ?').get(refresh_token);

  if (!stored) {
    return res.status(401).json({ error: 'invalid_grant', error_description: 'Neveljaven refresh token' });
  }

  if (new Date(stored.expires_at) < new Date()) {
    db.prepare('DELETE FROM refresh_token WHERE id = ?').run(stored.id);
    return res.status(401).json({ error: 'invalid_grant', error_description: 'Refresh token je potekel' });
  }

  const user = db.prepare('SELECT * FROM user WHERE id = ?').get(stored.user_id);
  if (!user) {
    return res.status(401).json({ error: 'invalid_grant', error_description: 'Uporabnik ne obstaja' });
  }

  // Delete old refresh token and issue new one
  db.prepare('DELETE FROM refresh_token WHERE id = ?').run(stored.id);

  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const newRefreshToken = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO refresh_token (token, user_id, expires_at) VALUES (?, ?, ?)').run(newRefreshToken, user.id, expiresAt);

  res.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: newRefreshToken
  });
}

module.exports = router;
