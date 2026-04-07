const express = require('express');
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/v1/user/profile
router.get('/profile', authenticateToken, (req, res) => {
  const db = getDb();
  const user = db.prepare(`
    SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.university_id, u.created_at,
           un.name as university_name
    FROM user u
    LEFT JOIN university un ON u.university_id = un.id
    WHERE u.id = ?
  `).get(req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'Uporabnik ne obstaja' });
  }

  res.json(user);
});

// DELETE /api/v1/user/account
router.delete('/account', authenticateToken, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM refresh_token WHERE user_id = ?').run(req.user.id);
  db.prepare('DELETE FROM subscription WHERE user_id = ?').run(req.user.id);
  db.prepare('DELETE FROM review WHERE user_id = ?').run(req.user.id);
  db.prepare('DELETE FROM report WHERE user_id = ?').run(req.user.id);
  db.prepare('DELETE FROM purchase WHERE user_id = ?').run(req.user.id);
  db.prepare('DELETE FROM user WHERE id = ?').run(req.user.id);
  res.json({ message: 'Račun uspešno izbrisan' });
});

module.exports = router;
