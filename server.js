const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDb, seedDb } = require('./db/database');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Initialize database
initDb();
seedDb();

// Routes
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/oauth', require('./routes/oauth'));
app.use('/api/v1/user', require('./routes/users'));
app.use('/api/v1/materials', require('./routes/materials'));
app.use('/api/v1', require('./routes/purchases'));
app.use('/api/v1/reviews', require('./routes/reviews'));
app.use('/api/v1/reports', require('./routes/reports'));
app.use('/api/v1/sync', require('./routes/sync'));
app.use('/api/v1/push', require('./routes/push'));

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'StudyHub REST API',
    version: '1.0.0',
    endpoints: [
      'POST   /api/v1/auth/register',
      'POST   /api/v1/auth/login',
      'POST   /api/v1/oauth/token',
      'GET    /api/v1/user/profile',
      'DELETE /api/v1/user/account',
      'GET    /api/v1/materials',
      'GET    /api/v1/materials/:id',
      'POST   /api/v1/materials/upload',
      'PUT    /api/v1/materials/:id',
      'DELETE /api/v1/materials/:id',
      'POST   /api/v1/payments/checkout',
      'GET    /api/v1/purchases/library',
      'GET    /api/v1/purchases/download/:id',
      'POST   /api/v1/reviews',
      'GET    /api/v1/reviews/:materialId',
      'DELETE /api/v1/reviews/:id',
      'POST   /api/v1/reports',
      'GET    /api/v1/reports',
      'DELETE /api/v1/reports/:id',
      'GET    /api/v1/sync/check',
      'POST   /api/v1/push/subscribe',
      'DELETE /api/v1/push/unsubscribe',
    ]
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`StudyHub API strežnik teče na http://localhost:${PORT}`);
});
