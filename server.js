const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Static files with caching
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1y',
  immutable: true,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html') || filePath === '/' ) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    }
  }
}));

// Database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS submissions (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT,
      message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('Database ready');
}

// API endpoint
app.post('/api/submit', async (req, res) => {
  const { name, email, company, message } = req.body;

  if (!name || !email) {
    return res.status(400).json({ success: false, error: 'Name and email are required' });
  }

  try {
    await pool.query(
      'INSERT INTO submissions (name, email, company, message) VALUES ($1, $2, $3, $4)',
      [name, email, company || null, message || null]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('DB insert error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to save submission' });
  }
});

// Fallback to index.html
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDb()
  .then(() => app.listen(port, () => console.log(`Server running on port ${port}`)))
  .catch(err => {
    console.error('DB init failed:', err.message);
    app.listen(port, () => console.log(`Server running on port ${port} (no database)`));
  });
