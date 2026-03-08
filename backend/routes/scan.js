// routes/scan.js
const router   = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db       = require('../db');
const { detect } = require('../detector');

// POST /api/scan
router.post('/', (req, res) => {
  const { input, type = 'auto', source = null } = req.body;

  if (!input || typeof input !== 'string' || !input.trim())
    return res.status(400).json({ success: false, error: 'input is required' });

  const result = detect(input.trim(), type);
  const id     = uuidv4();

  db.prepare(`
    INSERT INTO scan_logs (id, input, input_type, verdict, score, signals, matched_kw, source)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(
    id,
    result.input,
    result.inputType,
    result.verdict,
    result.score,
    JSON.stringify(result.signals),
    JSON.stringify(result.matchedKw),
    source,
  );

  res.json({ success: true, id, ...result });
});

// POST /api/scan/bulk — scan multiple inputs at once
router.post('/bulk', (req, res) => {
  const { inputs, type = 'auto', source = null } = req.body;

  if (!Array.isArray(inputs) || !inputs.length)
    return res.status(400).json({ success: false, error: 'inputs[] array required' });

  if (inputs.length > 50)
    return res.status(400).json({ success: false, error: 'Max 50 inputs per bulk request' });

  const insert = db.prepare(`
    INSERT INTO scan_logs (id, input, input_type, verdict, score, signals, matched_kw, source)
    VALUES (?,?,?,?,?,?,?,?)
  `);

  const bulkInsert = db.transaction((items) =>
    items.map(input => {
      if (!input || typeof input !== 'string') return { error: 'invalid input' };
      const result = detect(input.trim(), type);
      const id = uuidv4();
      insert.run(id, result.input, result.inputType, result.verdict,
        result.score, JSON.stringify(result.signals), JSON.stringify(result.matchedKw), source);
      return { id, ...result };
    })
  );

  const results = bulkInsert(inputs);
  const summary = {
    total:      results.length,
    phishing:   results.filter(r => r.verdict === 'phishing').length,
    suspicious: results.filter(r => r.verdict === 'suspicious').length,
    clean:      results.filter(r => r.verdict === 'clean').length,
  };

  res.json({ success: true, summary, results });
});

module.exports = router;
