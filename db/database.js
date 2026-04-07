const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'studyhub.db');
let db;

function getDb() {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS university (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      role TEXT DEFAULT 'student' CHECK(role IN ('student','admin')),
      university_id INTEGER REFERENCES university(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subject (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      university_id INTEGER REFERENCES university(id)
    );

    CREATE TABLE IF NOT EXISTS material (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      file_path TEXT,
      price REAL DEFAULT 0,
      subject_id INTEGER REFERENCES subject(id),
      author_id INTEGER REFERENCES user(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchase (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES user(id),
      material_id INTEGER REFERENCES material(id),
      price REAL NOT NULL,
      stripe_session_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS review (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES user(id),
      material_id INTEGER REFERENCES material(id),
      rating INTEGER CHECK(rating BETWEEN 1 AND 5),
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS report (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES user(id),
      material_id INTEGER REFERENCES material(id),
      reason TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subscription (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES user(id),
      endpoint TEXT NOT NULL,
      keys TEXT
    );

    CREATE TABLE IF NOT EXISTS refresh_token (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      user_id INTEGER REFERENCES user(id),
      expires_at DATETIME NOT NULL
    );
  `);

  return db;
}

function seedDb() {
  const db = getDb();

  const userCount = db.prepare('SELECT COUNT(*) as count FROM university').get();
  if (userCount.count > 0) return;

  const passwordHash = bcrypt.hashSync('geslo123', 10);

  db.exec(`
    INSERT INTO university (name) VALUES ('Univerza v Ljubljani');
    INSERT INTO university (name) VALUES ('Univerza v Mariboru');

    INSERT INTO subject (name, university_id) VALUES ('Matematika 1', 1);
    INSERT INTO subject (name, university_id) VALUES ('Programiranje', 1);
    INSERT INTO subject (name, university_id) VALUES ('Algoritmi', 1);
    INSERT INTO subject (name, university_id) VALUES ('Baze podatkov', 2);
    INSERT INTO subject (name, university_id) VALUES ('Racunalniske mreze', 2);
  `);

  const insertUser = db.prepare(
    'INSERT INTO user (email, password_hash, first_name, last_name, role, university_id) VALUES (?, ?, ?, ?, ?, ?)'
  );
  insertUser.run('admin@studyhub.si', passwordHash, 'Admin', 'Uporabnik', 'admin', 1);
  insertUser.run('janez@student.si', passwordHash, 'Janez', 'Novak', 'student', 1);
  insertUser.run('meta@student.si', passwordHash, 'Meta', 'Kovac', 'student', 2);

  db.exec(`
    INSERT INTO material (title, description, file_path, price, subject_id, author_id)
    VALUES ('Zapiski Matematika 1', 'Celoviti zapiski predavanj za Matematiko 1', 'uploads/mat1-zapiski.pdf', 4.99, 1, 2);

    INSERT INTO material (title, description, file_path, price, subject_id, author_id)
    VALUES ('Programiranje - vaje', 'Resene vaje iz programiranja v Pythonu', 'uploads/prog-vaje.pdf', 2.99, 2, 2);

    INSERT INTO material (title, description, file_path, price, subject_id, author_id)
    VALUES ('Algoritmi povzetek', 'Povzetek snovi za izpit iz algoritmov', 'uploads/algo-povzetek.pdf', 3.50, 3, 3);

    INSERT INTO material (title, description, file_path, price, subject_id, author_id)
    VALUES ('Baze podatkov skripta', 'Skripta za predmet Baze podatkov', 'uploads/bp-skripta.pdf', 5.00, 4, 3);

    INSERT INTO purchase (user_id, material_id, price, stripe_session_id)
    VALUES (3, 1, 4.99, 'sess_demo_001');

    INSERT INTO purchase (user_id, material_id, price, stripe_session_id)
    VALUES (3, 2, 2.99, 'sess_demo_002');

    INSERT INTO review (user_id, material_id, rating, comment)
    VALUES (3, 1, 5, 'Odlicni zapiski, zelo pomagajo pri ucenju!');

    INSERT INTO review (user_id, material_id, rating, comment)
    VALUES (3, 2, 4, 'Dobre vaje, manjka pa par tezjih nalog.');
  `);
}

module.exports = { getDb, initDb, seedDb };
