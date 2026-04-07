const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/v1/payments/checkout
router.post('/payments/checkout', authenticateToken, (req, res) => {
  const { material_id } = req.body;

  if (!material_id) {
    return res.status(400).json({ error: 'Manjka material_id' });
  }

  const db = getDb();
  const material = db.prepare('SELECT * FROM material WHERE id = ?').get(material_id);
  if (!material) {
    return res.status(404).json({ error: 'Gradivo ne obstaja' });
  }

  const existing = db.prepare('SELECT id FROM purchase WHERE user_id = ? AND material_id = ?').get(req.user.id, material_id);
  if (existing) {
    return res.status(409).json({ error: 'Gradivo je že kupljeno' });
  }

  const sessionId = 'sess_' + crypto.randomBytes(12).toString('hex');
  const result = db.prepare(
    'INSERT INTO purchase (user_id, material_id, price, stripe_session_id) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, material_id, material.price, sessionId);

  const purchase = db.prepare('SELECT * FROM purchase WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ message: 'Nakup uspešen', purchase });
});

// GET /api/v1/purchases/library
router.get('/purchases/library', authenticateToken, (req, res) => {
  const db = getDb();
  const library = db.prepare(`
    SELECT p.id as purchase_id, p.price as purchase_price, p.created_at as purchased_at,
           m.id as material_id, m.title, m.description, m.price as current_price,
           s.name as subject_name
    FROM purchase p
    JOIN material m ON p.material_id = m.id
    LEFT JOIN subject s ON m.subject_id = s.id
    WHERE p.user_id = ?
    ORDER BY p.created_at DESC
  `).all(req.user.id);

  res.json(library);
});

// GET /api/v1/purchases/download/:id
router.get('/purchases/download/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const purchase = db.prepare(`
    SELECT p.*, m.file_path, m.title
    FROM purchase p
    JOIN material m ON p.material_id = m.id
    WHERE p.material_id = ? AND p.user_id = ?
  `).get(req.params.id, req.user.id);

  if (!purchase) {
    return res.status(403).json({ error: 'Gradivo ni kupljeno ali ne obstaja' });
  }

  if (!purchase.file_path || !fs.existsSync(purchase.file_path)) {
    return res.status(404).json({ error: 'Datoteka ne obstaja na strežniku' });
  }

  res.download(purchase.file_path, purchase.title + '.pdf');
});

module.exports = router;
