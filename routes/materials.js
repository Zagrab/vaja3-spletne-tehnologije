const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// GET /api/v1/materials
router.get('/', (req, res) => {
  const db = getDb();
  const { subject_id, search } = req.query;

  let sql = `
    SELECT m.*, s.name as subject_name,
           u.first_name || ' ' || u.last_name as author_name,
           COALESCE(AVG(r.rating), 0) as avg_rating,
           COUNT(r.id) as review_count
    FROM material m
    LEFT JOIN subject s ON m.subject_id = s.id
    LEFT JOIN user u ON m.author_id = u.id
    LEFT JOIN review r ON m.id = r.material_id
  `;

  const conditions = [];
  const params = [];

  if (subject_id) {
    conditions.push('m.subject_id = ?');
    params.push(subject_id);
  }
  if (search) {
    conditions.push('(m.title LIKE ? OR m.description LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' GROUP BY m.id ORDER BY m.created_at DESC';

  const materials = db.prepare(sql).all(...params);
  res.json(materials);
});

// GET /api/v1/materials/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const material = db.prepare(`
    SELECT m.*, s.name as subject_name,
           u.first_name || ' ' || u.last_name as author_name,
           COALESCE(AVG(r.rating), 0) as avg_rating,
           COUNT(r.id) as review_count
    FROM material m
    LEFT JOIN subject s ON m.subject_id = s.id
    LEFT JOIN user u ON m.author_id = u.id
    LEFT JOIN review r ON m.id = r.material_id
    WHERE m.id = ?
    GROUP BY m.id
  `).get(req.params.id);

  if (!material) {
    return res.status(404).json({ error: 'Gradivo ne obstaja' });
  }

  res.json(material);
});

// POST /api/v1/materials/upload
router.post('/upload', authenticateToken, upload.single('file'), (req, res) => {
  const { title, description, price, subject_id } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Naslov je obvezen' });
  }

  const db = getDb();
  const filePath = req.file ? req.file.path : null;

  const result = db.prepare(
    'INSERT INTO material (title, description, file_path, price, subject_id, author_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(title, description || null, filePath, parseFloat(price) || 0, subject_id || null, req.user.id);

  const material = db.prepare('SELECT * FROM material WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(material);
});

// PUT /api/v1/materials/:id
router.put('/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const material = db.prepare('SELECT * FROM material WHERE id = ?').get(req.params.id);

  if (!material) {
    return res.status(404).json({ error: 'Gradivo ne obstaja' });
  }
  if (material.author_id !== req.user.id) {
    return res.status(403).json({ error: 'Samo avtor lahko ureja gradivo' });
  }

  const { title, description, price } = req.body;
  db.prepare(`
    UPDATE material SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      price = COALESCE(?, price),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(title || null, description || null, price != null ? price : null, req.params.id);

  const updated = db.prepare('SELECT * FROM material WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/v1/materials/:id
router.delete('/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const material = db.prepare('SELECT * FROM material WHERE id = ?').get(req.params.id);

  if (!material) {
    return res.status(404).json({ error: 'Gradivo ne obstaja' });
  }
  if (material.author_id !== req.user.id) {
    return res.status(403).json({ error: 'Samo avtor lahko izbriše gradivo' });
  }

  if (material.file_path && fs.existsSync(material.file_path)) {
    fs.unlinkSync(material.file_path);
  }

  db.prepare('DELETE FROM review WHERE material_id = ?').run(req.params.id);
  db.prepare('DELETE FROM report WHERE material_id = ?').run(req.params.id);
  db.prepare('DELETE FROM purchase WHERE material_id = ?').run(req.params.id);
  db.prepare('DELETE FROM material WHERE id = ?').run(req.params.id);
  res.json({ message: 'Gradivo uspešno izbrisano' });
});

module.exports = router;
