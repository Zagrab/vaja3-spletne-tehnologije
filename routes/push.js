const express = require('express');
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/v1/push/subscribe
router.post('/subscribe', authenticateToken, (req, res) => {
  const { endpoint, keys } = req.body;

  if (!endpoint) {
    return res.status(400).json({ error: 'Manjka endpoint' });
  }

  const db = getDb();

  const existing = db.prepare('SELECT id FROM subscription WHERE user_id = ? AND endpoint = ?').get(req.user.id, endpoint);
  if (existing) {
    return res.status(409).json({ error: 'Naročnina za ta endpoint že obstaja' });
  }

  const result = db.prepare(
    'INSERT INTO subscription (user_id, endpoint, keys) VALUES (?, ?, ?)'
  ).run(req.user.id, endpoint, keys ? JSON.stringify(keys) : null);

  const sub = db.prepare('SELECT * FROM subscription WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(sub);
});

// DELETE /api/v1/push/unsubscribe
router.delete('/unsubscribe', authenticateToken, (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM subscription WHERE user_id = ?').run(req.user.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Ni aktivnih naročnin' });
  }

  res.json({ message: 'Naročnina uspešno preklicana' });
});

module.exports = router;
