// routes/allowlist.js
const router = require('express').Router();
const db     = require('../db');

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM allowlist ORDER BY added_at DESC').all();
  res.json({ success: true, count: rows.length, allowlist: rows });
});

router.post('/', (req, res) => {
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ success: false, error: 'domain required' });
  const clean = domain.trim().toLowerCase().replace(/^https?:\/\//,'').replace(/\/.*/,'');
  try {
    db.prepare('INSERT INTO allowlist (domain) VALUES (?)').run(clean);
    res.status(201).json({ success: true, domain: clean });
  } catch {
    res.status(409).json({ success: false, error: 'Domain already allowlisted' });
  }
});

router.delete('/:id', (req, res) => {
  const r = db.prepare('DELETE FROM allowlist WHERE id = ?').run(req.params.id);
  if (!r.changes) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true });
});

module.exports = router;
