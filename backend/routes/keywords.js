// routes/keywords.js
const router  = require('express').Router();
const db      = require('../db');

// GET /api/keywords — list all
router.get('/', (req, res) => {
  const { category, severity, search } = req.query;
  let sql    = 'SELECT * FROM keywords';
  const wheres = [], params = [];

  if (category) { wheres.push('category = ?');           params.push(category); }
  if (severity) { wheres.push('severity = ?');           params.push(severity); }
  if (search)   { wheres.push('keyword LIKE ?');         params.push(`%${search}%`); }

  if (wheres.length) sql += ' WHERE ' + wheres.join(' AND ');
  sql += ' ORDER BY hits DESC, created_at DESC';

  const rows = db.prepare(sql).all(...params);
  res.json({ success: true, count: rows.length, keywords: rows });
});

// GET /api/keywords/stats
router.get('/stats', (req, res) => {
  const totals = db.prepare(`
    SELECT category, severity, COUNT(*) AS count, SUM(hits) AS total_hits
    FROM keywords GROUP BY category, severity ORDER BY total_hits DESC
  `).all();
  res.json({ success: true, stats: totals });
});

// POST /api/keywords — add single or bulk
router.post('/', (req, res) => {
  const { keyword, keywords, category = 'general', severity = 'medium' } = req.body;

  const items = keywords
    ? (Array.isArray(keywords) ? keywords : [keywords])
    : keyword
    ? [{ keyword, category, severity }]
    : [];

  if (!items.length) return res.status(400).json({ success: false, error: 'No keyword(s) provided' });

  const VALID_SEV  = new Set(['low','medium','high','critical']);
  const insert     = db.prepare('INSERT OR IGNORE INTO keywords (keyword, category, severity) VALUES (?,?,?)');
  const insertMany = db.transaction((list) =>
    list.map(item => {
      const kw  = (item.keyword || item).toString().trim().toLowerCase();
      const cat = (item.category || category).toString().trim();
      const sev = VALID_SEV.has(item.severity) ? item.severity : severity;
      if (!kw) return { keyword: kw, status: 'skipped', reason: 'empty' };
      const res = insert.run(kw, cat, sev);
      return { keyword: kw, status: res.changes ? 'added' : 'duplicate' };
    })
  );

  const results = insertMany(items);
  const added   = results.filter(r => r.status === 'added').length;
  res.status(201).json({ success: true, added, results });
});

// PATCH /api/keywords/:id — update severity / category
router.patch('/:id', (req, res) => {
  const { category, severity } = req.body;
  const VALID_SEV = new Set(['low','medium','high','critical']);

  if (severity && !VALID_SEV.has(severity))
    return res.status(400).json({ success: false, error: 'Invalid severity' });

  const sets = [], params = [];
  if (category) { sets.push('category = ?'); params.push(category); }
  if (severity) { sets.push('severity = ?'); params.push(severity); }
  if (!sets.length) return res.status(400).json({ success: false, error: 'Nothing to update' });

  params.push(req.params.id);
  const result = db.prepare(`UPDATE keywords SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  if (!result.changes) return res.status(404).json({ success: false, error: 'Keyword not found' });

  const updated = db.prepare('SELECT * FROM keywords WHERE id = ?').get(req.params.id);
  res.json({ success: true, keyword: updated });
});

// DELETE /api/keywords/:id
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM keywords WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ success: false, error: 'Keyword not found' });
  res.json({ success: true, deleted: req.params.id });
});

// DELETE /api/keywords — bulk delete by ids array
router.delete('/', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length)
    return res.status(400).json({ success: false, error: 'ids[] required' });

  const del = db.transaction((list) =>
    list.reduce((acc, id) => acc + db.prepare('DELETE FROM keywords WHERE id = ?').run(id).changes, 0)
  );
  res.json({ success: true, deleted: del(ids) });
});

module.exports = router;
