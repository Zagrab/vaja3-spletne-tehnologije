const express = require('express');
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/v1/reviews
router.post('/', authenticateToken, (req, res) => {
  const { material_id, rating, comment } = req.body;

  if (!material_id || !rating) {
    return res.status(400).json({ error: 'Manjkata material_id in rating' });
  }

  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Ocena mora biti med 1 in 5' });
  }

  const db = getDb();

  const purchase = db.prepare('SELECT id FROM purchase WHERE user_id = ? AND material_id = ?').get(req.user.id, material_id);
  if (!purchase) {
    return res.status(403).json({ error: 'Oceno lahko oddate samo po nakupu gradiva' });
  }

  const existing = db.prepare('SELECT id FROM review WHERE user_id = ? AND material_id = ?').get(req.user.id, material_id);
  if (existing) {
    return res.status(409).json({ error: 'Ocena za to gradivo je že oddana' });
  }

  const result = db.prepare(
    'INSERT INTO review (user_id, material_id, rating, comment) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, material_id, rating, comment || null);

  const review = db.prepare('SELECT * FROM review WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(review);
});

// GET /api/v1/reviews/:materialId
router.get('/:materialId', (req, res) => {
  const db = getDb();
  const reviews = db.prepare(`
    SELECT r.*, u.first_name || ' ' || u.last_name as author_name
    FROM review r
    JOIN user u ON r.user_id = u.id
    WHERE r.material_id = ?
    ORDER BY r.created_at DESC
  `).all(req.params.materialId);

  res.json(reviews);
});

// DELETE /api/v1/reviews/:id
router.delete('/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const review = db.prepare('SELECT * FROM review WHERE id = ?').get(req.params.id);

  if (!review) {
    return res.status(404).json({ error: 'Ocena ne obstaja' });
  }
  if (review.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Samo avtor lahko izbriše oceno' });
  }

  db.prepare('DELETE FROM review WHERE id = ?').run(req.params.id);
  res.json({ message: 'Ocena uspešno izbrisana' });
});

module.exports = router;
