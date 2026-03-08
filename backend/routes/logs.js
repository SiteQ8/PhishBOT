// routes/logs.js
const router = require('express').Router();
const db     = require('../db');

// GET /api/logs — paginated scan history
router.get('/', (req, res) => {
  const page    = Math.max(1, parseInt(req.query.page)  || 1);
  const limit   = Math.min(100, parseInt(req.query.limit) || 20);
  const offset  = (page - 1) * limit;
  const verdict = req.query.verdict;

  let sql     = 'SELECT * FROM scan_logs';
  const params = [];
  if (verdict) { sql += ' WHERE verdict = ?'; params.push(verdict); }
  sql += ' ORDER BY scanned_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows  = db.prepare(sql).all(...params).map(row => ({
    ...row,
    signals:    JSON.parse(row.signals    || '[]'),
    matched_kw: JSON.parse(row.matched_kw || '[]'),
  }));

  const countSql = verdict
    ? 'SELECT COUNT(*) AS n FROM scan_logs WHERE verdict = ?'
    : 'SELECT COUNT(*) AS n FROM scan_logs';
  const total = verdict
    ? db.prepare(countSql).get(verdict).n
    : db.prepare(countSql).get().n;

  res.json({ success: true, page, limit, total, pages: Math.ceil(total / limit), logs: rows });
});

// GET /api/logs/summary — dashboard stats
router.get('/summary', (req, res) => {
  const verdicts = db.prepare(`
    SELECT verdict, COUNT(*) AS count FROM scan_logs GROUP BY verdict
  `).all();

  const daily = db.prepare(`
    SELECT date(scanned_at) AS day, verdict, COUNT(*) AS count
    FROM scan_logs
    WHERE scanned_at >= datetime('now', '-30 days')
    GROUP BY day, verdict
    ORDER BY day ASC
  `).all();

  const topKw = db.prepare(`
    SELECT keyword, hits, severity, category
    FROM keywords ORDER BY hits DESC LIMIT 10
  `).all();

  const recent = db.prepare(`
    SELECT id, input, input_type, verdict, score, scanned_at
    FROM scan_logs ORDER BY scanned_at DESC LIMIT 5
  `).all();

  res.json({ success: true, verdicts, daily, topKeywords: topKw, recentScans: recent });
});

// DELETE /api/logs/:id
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM scan_logs WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ success: false, error: 'Log not found' });
  res.json({ success: true });
});

// DELETE /api/logs — clear all logs
router.delete('/', (req, res) => {
  const { confirm } = req.body;
  if (confirm !== 'CLEAR_ALL') return res.status(400).json({ success: false, error: 'Send confirm: "CLEAR_ALL"' });
  const { changes } = db.prepare('DELETE FROM scan_logs').run();
  res.json({ success: true, deleted: changes });
});

module.exports = router;
