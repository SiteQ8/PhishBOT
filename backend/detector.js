// detector.js — Core phishing detection engine
'use strict';

const db = require('./db');

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeParseDomain(input) {
  try {
    const url = input.startsWith('http') ? input : `https://${input}`;
    const u = new URL(url);
    return { hostname: u.hostname, pathname: u.pathname, full: url };
  } catch {
    return { hostname: input, pathname: '', full: input };
  }
}

// Levenshtein distance for typosquat detection
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

const BRAND_DOMAINS = [
  'paypal','google','apple','microsoft','amazon','netflix','facebook',
  'instagram','twitter','linkedin','chase','wellsfargo','bankofamerica',
  'citibank','hsbc','outlook','yahoo','dropbox','adobe','ebay',
];

const SUSPICIOUS_TLDS = new Set([
  '.xyz','.top','.club','.work','.date','.gq','.tk','.ml','.ga',
  '.cf','.click','.download','.stream','.win','.bid','.loan','.review',
]);

const URL_PATTERNS = [
  { re: /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,          signal: 'IP address used as host',            score: 30 },
  { re: /@/,                                              signal: 'URL contains @ symbol',              score: 25 },
  { re: /[a-z0-9-]{40,}/i,                               signal: 'Unusually long hostname/path',       score: 15 },
  { re: /https?:\/\/[^/]*%[0-9a-f]{2}/i,                 signal: 'URL-encoded characters in hostname', score: 20 },
  { re: /https?:\/\/[^/]+-[^/]+-[^/]+\./i,               signal: 'Multi-hyphenated domain',            score: 15 },
  { re: /\.(php|asp|aspx|cfm|cgi)\?/i,                   signal: 'Server-side script with params',     score: 10 },
  { re: /login|signin|account|verify|secure|update/i,     signal: 'Sensitive keyword in URL path',      score: 20 },
  { re: /free|win|prize|gift|claim|lucky/i,               signal: 'Scam lure keyword in URL',           score: 15 },
  { re: /bit\.ly|tinyurl|t\.co|goo\.gl|ow\.ly|short/i,   signal: 'URL shortener detected',             score: 15 },
  { re: /[а-яёА-ЯЁ\u0400-\u04FF]/,                       signal: 'Cyrillic characters (IDN homoglyph)', score: 35 },
  { re: /[^\x00-\x7F]/,                                   signal: 'Non-ASCII characters in URL',        score: 20 },
];

const TEXT_PATTERNS = [
  { re: /urgent.*action|action.*required/i,    signal: 'Urgency manipulation',        score: 20 },
  { re: /your account.*suspend|suspend.*account/i, signal: 'Account suspension threat', score: 25 },
  { re: /click here.{0,20}(now|immediately)/i, signal: 'High-pressure click-bait',    score: 20 },
  { re: /password.*expire|expire.*password/i,  signal: 'Password expiry lure',        score: 25 },
  { re: /social security|ssn/i,                signal: 'SSN request — high risk',     score: 35 },
  { re: /credit card.{0,20}number/i,           signal: 'Credit card harvesting',      score: 35 },
  { re: /bank.*details|routing.*number/i,      signal: 'Banking details request',     score: 30 },
  { re: /you won|you have won|you are selected/i, signal: 'Lottery / prize scam',     score: 25 },
  { re: /confirm.*identity|verify.*identity/i, signal: 'Identity verification lure',  score: 20 },
  { re: /dear (customer|user|member|client)/i, signal: 'Generic salutation (no name)',score: 10 },
  { re: /\b(login|sign.?in).{0,30}(link|here|below)/i, signal: 'Login link prompt',  score: 20 },
  { re: /do not share.{0,20}password/i,        signal: 'Reverse psychology password', score: 10 },
];

// ── Main detection function ───────────────────────────────────────────────────

function detect(input, inputType = 'auto') {
  const type  = inputType === 'auto' ? guessType(input) : inputType;
  const signals     = [];
  const matchedKw   = [];
  let   score       = 0;

  // ── 1. Allowlist check (URL only) ──────────────────────────────────────
  if (type === 'url') {
    const { hostname } = safeParseDomain(input);
    const rootDomain   = hostname.replace(/^www\./, '').split('.').slice(-2).join('.');
    const allowed = db.prepare('SELECT 1 FROM allowlist WHERE domain = ? COLLATE NOCASE').get(rootDomain);
    if (allowed) {
      return buildResult(input, type, 'clean', 0, [{ signal: 'Domain is in allowlist', score: 0 }], []);
    }
  }

  // ── 2. URL structural analysis ────────────────────────────────────────
  if (type === 'url') {
    const { hostname, full } = safeParseDomain(input);

    // Suspicious TLD
    const tld = '.' + hostname.split('.').pop().toLowerCase();
    if (SUSPICIOUS_TLDS.has(tld)) {
      signals.push({ signal: `Suspicious TLD: ${tld}`, score: 25 });
      score += 25;
    }

    // Typosquatting
    const parts    = hostname.replace(/^www\./, '').split('.');
    const namePart = parts.slice(0, -1).join('.');
    for (const brand of BRAND_DOMAINS) {
      if (namePart !== brand && namePart.includes(brand)) {
        signals.push({ signal: `Brand keyword "${brand}" embedded in domain`, score: 30 });
        score += 30;
        break;
      }
      const dist = levenshtein(namePart.toLowerCase(), brand);
      if (dist > 0 && dist <= 2 && namePart.length > 3) {
        signals.push({ signal: `Possible typosquat of "${brand}" (edit dist: ${dist})`, score: 35 });
        score += 35;
        break;
      }
    }

    // Subdomain depth
    const subdomains = hostname.split('.').length - 2;
    if (subdomains >= 3) {
      signals.push({ signal: `Deep subdomain nesting (${subdomains} levels)`, score: 15 });
      score += 15;
    }

    // Pattern matching
    for (const { re, signal, score: pts } of URL_PATTERNS) {
      if (re.test(full)) {
        signals.push({ signal, score: pts });
        score += pts;
      }
    }
  }

  // ── 3. Text / email body analysis ─────────────────────────────────────
  if (type === 'text' || type === 'email') {
    for (const { re, signal, score: pts } of TEXT_PATTERNS) {
      if (re.test(input)) {
        signals.push({ signal, score: pts });
        score += pts;
      }
    }

    // Embedded URL detection inside text
    const urlRe = /https?:\/\/[^\s"'<>]+/gi;
    const urls  = input.match(urlRe) || [];
    for (const u of urls.slice(0, 5)) {
      const sub = detect(u, 'url');
      if (sub.score > 0) {
        signals.push({ signal: `Embedded URL flagged: ${u.slice(0, 60)}`, score: sub.score });
        score += Math.round(sub.score * 0.6);
      }
    }
  }

  // ── 4. Keyword database matching ──────────────────────────────────────
  const allKw = db.prepare('SELECT id, keyword, severity FROM keywords').all();
  const lower  = input.toLowerCase();
  const sevScore = { low: 10, medium: 20, high: 30, critical: 45 };

  for (const { id, keyword, severity } of allKw) {
    if (lower.includes(keyword.toLowerCase())) {
      matchedKw.push(keyword);
      const pts = sevScore[severity] || 20;
      signals.push({ signal: `Keyword match: "${keyword}" [${severity}]`, score: pts });
      score += pts;
      db.prepare('UPDATE keywords SET hits = hits + 1 WHERE id = ?').run(id);
    }
  }

  // ── 5. Verdict ─────────────────────────────────────────────────────────
  const verdict = score >= 70 ? 'phishing' : score >= 35 ? 'suspicious' : 'clean';
  return buildResult(input, type, verdict, Math.min(score, 100), signals, matchedKw);
}

function guessType(input) {
  if (/^https?:\/\//i.test(input) || /^[a-z0-9-]+\.[a-z]{2,}/i.test(input)) return 'url';
  if (input.includes('\n') || input.length > 200) return 'text';
  return 'text';
}

function buildResult(input, type, verdict, score, signals, matchedKw) {
  return { input: input.slice(0, 500), inputType: type, verdict, score, signals, matchedKw };
}

module.exports = { detect };
