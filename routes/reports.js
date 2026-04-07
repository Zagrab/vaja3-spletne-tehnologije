const express = require('express');
const { getDb } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// POST /api/v1/reports
router.post('/', authenticateToken, (req, res) => {
  const { material_id, reason } = req.body;

  if (!material_id || !reason) {
    return res.status(400).json({ error: 'Manjkata material_id in reason' });
  }

  const db = getDb();
  const material = db.prepare('SELECT id FROM material WHERE id = ?').get(material_id);
  if (!material) {
    return res.status(404).json({ error: 'Gradivo ne obstaja' });
  }

  const result = db.prepare(
    'INSERT INTO report (user_id, material_id, reason) VALUES (?, ?, ?)'
  ).run(req.user.id, material_id, reason);

  const report = db.prepare('SELECT * FROM report WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(report);
});

// GET /api/v1/reports (admin only)
router.get('/', authenticateToken, requireAdmin, (req, res) => {
  const db = getDb();
  const reports = db.prepare(`
    SELECT r.*, m.title as material_title,
           u.first_name || ' ' || u.last_name as reporter_name
    FROM report r
    JOIN material m ON r.material_id = m.id
    JOIN user u ON r.user_id = u.id
    ORDER BY r.created_at DESC
  `).all();

  res.json(reports);
});

// DELETE /api/v1/reports/:id (admin only)
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  const db = getDb();
  const report = db.prepare('SELECT * FROM report WHERE id = ?').get(req.params.id);

  if (!report) {
    return res.status(404).json({ error: 'Prijava ne obstaja' });
  }

  db.prepare('DELETE FROM report WHERE id = ?').run(req.params.id);
  res.json({ message: 'Prijava uspešno odstranjena' });
});

module.exports = router;
