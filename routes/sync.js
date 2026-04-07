const express = require('express');
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/v1/sync/check?since=2026-01-01T00:00:00
router.get('/check', authenticateToken, (req, res) => {
  const { since } = req.query;

  if (!since) {
    return res.status(400).json({ error: 'Manjka parameter since (ISO datum)' });
  }

  const db = getDb();
  const updatedMaterials = db.prepare(`
    SELECT m.*, s.name as subject_name
    FROM material m
    LEFT JOIN subject s ON m.subject_id = s.id
    WHERE m.updated_at > ? OR m.created_at > ?
    ORDER BY m.updated_at DESC
  `).all(since, since);

  res.json({
    since,
    count: updatedMaterials.length,
    materials: updatedMaterials
  });
});

module.exports = router;
