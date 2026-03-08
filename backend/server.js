// server.js — PhishBOT API server
'use strict';

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Security middleware ────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*',
  methods: ['GET','POST','PATCH','DELETE','OPTIONS'],
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '1mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});
const scanLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { success: false, error: 'Scan rate limit exceeded.' },
});

app.use(limiter);

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/scan',      scanLimiter, require('./routes/scan'));
app.use('/api/keywords',  require('./routes/keywords'));
app.use('/api/logs',      require('./routes/logs'));
app.use('/api/allowlist', require('./routes/allowlist'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    service: 'PhishBOT API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// 404
app.use((req, res) => res.status(404).json({ success: false, error: 'Not found' }));

// Error handler
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║        PhishBOT API  v1.0.0           ║
║  Listening on http://localhost:${PORT}   ║
╚═══════════════════════════════════════╝
  `);
});

module.exports = app;
