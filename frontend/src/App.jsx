import { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// ── Theme ─────────────────────────────────────────────────────────────────────
const C = {
  bg:       '#080c18',
  panel:    '#0d1526',
  border:   '#1a2540',
  accent:   '#00e5ff',
  danger:   '#ff3b3b',
  warn:     '#ffb300',
  success:  '#00e676',
  muted:    '#4a5980',
  text:     '#c8d8f0',
  textDim:  '#6b7fa3',
};

const styles = {
  root: {
    fontFamily: "'Space Mono', monospace",
    background: C.bg,
    color: C.text,
    minHeight: '100vh',
    padding: '0',
  },
};

// ── API helpers ───────────────────────────────────────────────────────────────
const apiFetch = (path, opts = {}) =>
  fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  }).then(r => r.json());

// ── Components ────────────────────────────────────────────────────────────────

function VerdictBadge({ verdict, score }) {
  const cfg = {
    phishing:   { bg: '#3d0c0c', border: C.danger,  color: C.danger,  label: '🚨 PHISHING'   },
    suspicious: { bg: '#2d1c00', border: C.warn,    color: C.warn,    label: '⚠ SUSPICIOUS'  },
    clean:      { bg: '#002318', border: C.success,  color: C.success, label: '✓ CLEAN'       },
  }[verdict] || { bg: '#111', border: C.muted, color: C.muted, label: '? UNKNOWN' };

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      color: cfg.color, borderRadius: 4, padding: '3px 10px',
      fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
    }}>
      {cfg.label}
      {score !== undefined && (
        <span style={{ opacity: 0.7, marginLeft: 4 }}>{score}/100</span>
      )}
    </span>
  );
}

function Card({ title, children, style = {}, action }) {
  return (
    <div style={{
      background: C.panel, border: `1px solid ${C.border}`,
      borderRadius: 8, padding: '20px 24px', ...style,
    }}>
      {title && (
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h3 style={{ margin:0, fontSize:11, letterSpacing:'0.12em', color:C.accent, textTransform:'uppercase' }}>
            {title}
          </h3>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

function StatBox({ label, value, color = C.accent, sub }) {
  return (
    <div style={{
      background: C.panel, border: `1px solid ${C.border}`,
      borderRadius: 8, padding: '18px 22px',
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 30, fontWeight: 700, color, fontFamily: "'Syne', sans-serif" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Scanner Tab ───────────────────────────────────────────────────────────────

function Scanner() {
  const [input, setInput]     = useState('');
  const [type, setType]       = useState('auto');
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);

  async function scan() {
    if (!input.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await apiFetch('/api/scan', {
        method: 'POST',
        body: JSON.stringify({ input: input.trim(), type }),
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Card title="Scan Input">
        <div style={{ display:'flex', gap:8, marginBottom:12 }}>
          {['auto','url','text','email'].map(t => (
            <button key={t} onClick={() => setType(t)} style={{
              background: type === t ? C.accent : 'transparent',
              color: type === t ? C.bg : C.textDim,
              border: `1px solid ${type === t ? C.accent : C.border}`,
              borderRadius: 4, padding: '4px 14px', cursor:'pointer',
              fontFamily:'inherit', fontSize:11, letterSpacing:'0.08em', textTransform:'uppercase',
            }}>{t}</button>
          ))}
        </div>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Paste a URL, email body, or suspicious text here..."
          rows={5}
          style={{
            width:'100%', boxSizing:'border-box', background:'#060b17',
            border:`1px solid ${C.border}`, color:C.text, borderRadius:6,
            padding:'12px 14px', fontFamily:'inherit', fontSize:13,
            resize:'vertical', outline:'none',
          }}
        />
        <button
          onClick={scan}
          disabled={loading || !input.trim()}
          style={{
            marginTop:12, background: loading ? C.muted : C.accent,
            color: C.bg, border:'none', borderRadius:6,
            padding:'10px 28px', fontFamily:'inherit', fontWeight:700,
            fontSize:13, cursor: loading ? 'not-allowed' : 'pointer',
            letterSpacing:'0.06em',
          }}
        >
          {loading ? '⏳ SCANNING...' : '⚡ SCAN NOW'}
        </button>
      </Card>

      {result && (
        <Card title="Analysis Result" style={{ marginTop:16 }}>
          <div style={{ display:'flex', gap:16, alignItems:'center', marginBottom:20 }}>
            <VerdictBadge verdict={result.verdict} score={result.score} />
            <span style={{ fontSize:11, color:C.textDim }}>
              Type: <span style={{ color:C.text }}>{result.inputType}</span>
            </span>
            <span style={{ fontSize:11, color:C.textDim }}>
              ID: <span style={{ color:C.textDim, fontFamily:'monospace' }}>{result.id?.slice(0,8)}</span>
            </span>
          </div>

          <div style={{ marginBottom:16 }}>
            <ScoreBar score={result.score} verdict={result.verdict} />
          </div>

          {result.signals?.length > 0 && (
            <>
              <div style={{ fontSize:11, color:C.accent, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:10 }}>
                Threat Signals ({result.signals.length})
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {result.signals.map((s, i) => (
                  <SignalRow key={i} signal={s} />
                ))}
              </div>
            </>
          )}

          {result.matchedKw?.length > 0 && (
            <div style={{ marginTop:16 }}>
              <div style={{ fontSize:11, color:C.warn, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>
                Matched Keywords
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {result.matchedKw.map((kw, i) => (
                  <span key={i} style={{
                    background:'#2d1c00', border:`1px solid ${C.warn}`,
                    color:C.warn, borderRadius:4, padding:'3px 10px',
                    fontSize:11,
                  }}>{kw}</span>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function ScoreBar({ score, verdict }) {
  const color = verdict === 'phishing' ? C.danger : verdict === 'suspicious' ? C.warn : C.success;
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:C.textDim, marginBottom:6 }}>
        <span>Threat Score</span>
        <span style={{ color, fontWeight:700 }}>{score}/100</span>
      </div>
      <div style={{ height:8, background:'#1a2540', borderRadius:4, overflow:'hidden' }}>
        <div style={{
          height:'100%', width:`${score}%`,
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          borderRadius:4, transition:'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}

function SignalRow({ signal }) {
  const pts   = signal.score || 0;
  const color = pts >= 30 ? C.danger : pts >= 15 ? C.warn : C.success;
  return (
    <div style={{
      display:'flex', justifyContent:'space-between', alignItems:'center',
      background:'#060b17', border:`1px solid ${C.border}`,
      borderRadius:5, padding:'8px 12px',
    }}>
      <span style={{ fontSize:12, color:C.text }}>{signal.signal}</span>
      <span style={{ fontSize:11, color, fontWeight:700, marginLeft:12, whiteSpace:'nowrap' }}>+{pts}</span>
    </div>
  );
}

// ── Keywords Tab ──────────────────────────────────────────────────────────────

function Keywords() {
  const [keywords, setKeywords]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [newKw, setNewKw]           = useState({ keyword:'', category:'general', severity:'medium' });
  const [adding, setAdding]         = useState(false);
  const [msg, setMsg]               = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    const data = await apiFetch(`/api/keywords${qs}`);
    setKeywords(data.keywords || []);
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  async function addKeyword() {
    if (!newKw.keyword.trim()) return;
    setAdding(true);
    const data = await apiFetch('/api/keywords', {
      method:'POST',
      body: JSON.stringify(newKw),
    });
    setAdding(false);
    if (data.success) {
      setMsg({ type:'success', text:`Added: "${newKw.keyword}"` });
      setNewKw({ keyword:'', category:'general', severity:'medium' });
      load();
    } else {
      setMsg({ type:'error', text: data.error || 'Failed' });
    }
    setTimeout(() => setMsg(null), 3000);
  }

  async function deleteKw(id) {
    await apiFetch(`/api/keywords/${id}`, { method:'DELETE' });
    setKeywords(prev => prev.filter(k => k.id !== id));
  }

  const sevColor = { low:C.success, medium:C.warn, high:C.danger, critical:'#ff00ff' };

  return (
    <div style={{ maxWidth:900, margin:'0 auto' }}>
      {/* Add keyword form */}
      <Card title="Add Keyword" style={{ marginBottom:16 }}>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <input
            placeholder="Keyword or phrase..."
            value={newKw.keyword}
            onChange={e => setNewKw(p => ({ ...p, keyword: e.target.value }))}
            style={inputStyle}
          />
          <select value={newKw.category} onChange={e => setNewKw(p => ({ ...p, category: e.target.value }))} style={inputStyle}>
            {['general','credential','urgency','financial','brand-abuse','scam'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select value={newKw.severity} onChange={e => setNewKw(p => ({ ...p, severity: e.target.value }))} style={inputStyle}>
            {['low','medium','high','critical'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button onClick={addKeyword} disabled={adding || !newKw.keyword.trim()} style={{
            background:C.accent, color:C.bg, border:'none', borderRadius:6,
            padding:'8px 20px', fontFamily:'inherit', fontWeight:700,
            fontSize:12, cursor:'pointer',
          }}>
            {adding ? '...' : '+ ADD'}
          </button>
        </div>
        {msg && (
          <div style={{
            marginTop:10, padding:'8px 12px', borderRadius:5, fontSize:12,
            background: msg.type === 'success' ? '#002318' : '#3d0c0c',
            color: msg.type === 'success' ? C.success : C.danger,
            border: `1px solid ${msg.type === 'success' ? C.success : C.danger}`,
          }}>{msg.text}</div>
        )}
      </Card>

      {/* Keyword list */}
      <Card title={`Keywords (${keywords.length})`} action={
        <input
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, width:160, padding:'5px 10px' }}
        />
      }>
        {loading ? (
          <div style={{ color:C.textDim, textAlign:'center', padding:24 }}>Loading...</div>
        ) : keywords.length === 0 ? (
          <div style={{ color:C.textDim, textAlign:'center', padding:24 }}>No keywords found</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {keywords.map(kw => (
              <div key={kw.id} style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                background:'#060b17', border:`1px solid ${C.border}`,
                borderRadius:5, padding:'10px 14px',
              }}>
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  <span style={{
                    display:'inline-block', width:8, height:8, borderRadius:'50%',
                    background: sevColor[kw.severity] || C.muted,
                  }} />
                  <span style={{ fontSize:13, color:C.text }}>{kw.keyword}</span>
                  <span style={{ fontSize:11, color:C.textDim }}>[{kw.category}]</span>
                </div>
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  <span style={{ fontSize:11, color:C.textDim }}>{kw.hits} hits</span>
                  <span style={{ fontSize:11, color: sevColor[kw.severity] || C.muted, fontWeight:700 }}>
                    {kw.severity.toUpperCase()}
                  </span>
                  <button onClick={() => deleteKw(kw.id)} style={{
                    background:'transparent', border:`1px solid ${C.border}`,
                    color:C.danger, borderRadius:4, padding:'2px 10px',
                    cursor:'pointer', fontFamily:'inherit', fontSize:11,
                  }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────────

function Dashboard() {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    apiFetch('/api/logs/summary').then(d => setSummary(d));
  }, []);

  if (!summary) return (
    <div style={{ color:C.textDim, textAlign:'center', padding:60, fontSize:13 }}>
      Loading dashboard...
    </div>
  );

  const verdicts = summary.verdicts || [];
  const phishing   = verdicts.find(v => v.verdict === 'phishing')?.count || 0;
  const suspicious = verdicts.find(v => v.verdict === 'suspicious')?.count || 0;
  const clean      = verdicts.find(v => v.verdict === 'clean')?.count || 0;
  const total      = phishing + suspicious + clean;

  // Build chart data
  const dailyMap = {};
  for (const row of summary.daily || []) {
    if (!dailyMap[row.day]) dailyMap[row.day] = { day: row.day, phishing:0, suspicious:0, clean:0 };
    dailyMap[row.day][row.verdict] = row.count;
  }
  const chartData = Object.values(dailyMap).slice(-14);

  const pieData = [
    { name:'Phishing',   value: phishing,   color: C.danger  },
    { name:'Suspicious', value: suspicious,  color: C.warn    },
    { name:'Clean',      value: clean,       color: C.success },
  ].filter(d => d.value > 0);

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginBottom:16 }}>
        <StatBox label="Total Scans"  value={total}     color={C.accent}  />
        <StatBox label="Phishing"     value={phishing}  color={C.danger}  />
        <StatBox label="Suspicious"   value={suspicious} color={C.warn}   />
        <StatBox label="Clean"        value={clean}     color={C.success} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:12, marginBottom:16 }}>
        <Card title="Detection Trend (last 14 days)">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gPhish" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.danger}  stopOpacity={0.4}/>
                  <stop offset="95%" stopColor={C.danger}  stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gSusp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.warn}    stopOpacity={0.4}/>
                  <stop offset="95%" stopColor={C.warn}    stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fill:C.textDim, fontSize:10 }} />
              <YAxis tick={{ fill:C.textDim, fontSize:10 }} />
              <Tooltip
                contentStyle={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:6, fontSize:11 }}
                labelStyle={{ color:C.text }}
              />
              <Area type="monotone" dataKey="phishing"   stroke={C.danger} fill="url(#gPhish)" strokeWidth={2} />
              <Area type="monotone" dataKey="suspicious" stroke={C.warn}   fill="url(#gSusp)"  strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Verdict Distribution">
          {pieData.length ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                    dataKey="value" paddingAngle={3}>
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:8 }}>
                {pieData.map((d, i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                    <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ width:8, height:8, borderRadius:'50%', background:d.color, display:'inline-block' }} />
                      {d.name}
                    </span>
                    <span style={{ color:d.color, fontWeight:700 }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ color:C.textDim, textAlign:'center', padding:40, fontSize:12 }}>No data yet</div>
          )}
        </Card>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <Card title="Top Triggered Keywords">
          {(summary.topKeywords || []).length === 0 ? (
            <div style={{ color:C.textDim, fontSize:12 }}>No data yet</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {(summary.topKeywords || []).map((kw, i) => (
                <div key={i} style={{
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                  fontSize:12, borderBottom:`1px solid ${C.border}`, paddingBottom:6,
                }}>
                  <span style={{ color:C.text }}>{kw.keyword}</span>
                  <span style={{ color:C.accent, fontWeight:700 }}>{kw.hits} hits</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Recent Scans">
          {(summary.recentScans || []).length === 0 ? (
            <div style={{ color:C.textDim, fontSize:12 }}>No scans yet</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {(summary.recentScans || []).map((s, i) => (
                <div key={i} style={{ fontSize:12, borderBottom:`1px solid ${C.border}`, paddingBottom:8 }}>
                  <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:3 }}>
                    <VerdictBadge verdict={s.verdict} score={s.score} />
                    <span style={{ color:C.textDim, fontSize:11 }}>{s.input_type}</span>
                  </div>
                  <div style={{ color:C.textDim, fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {s.input?.slice(0,70)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ── Logs Tab ──────────────────────────────────────────────────────────────────

function Logs() {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [total, setTotal]     = useState(0);
  const [verdict, setVerdict] = useState('');
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = [`page=${page}`, 'limit=15', verdict ? `verdict=${verdict}` : ''].filter(Boolean).join('&');
    const data = await apiFetch(`/api/logs?${qs}`);
    setLogs(data.logs || []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [page, verdict]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ maxWidth:1000, margin:'0 auto' }}>
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {['','phishing','suspicious','clean'].map(v => (
          <button key={v} onClick={() => { setVerdict(v); setPage(1); }} style={{
            background: verdict === v ? (v === 'phishing' ? C.danger : v === 'suspicious' ? C.warn : v === 'clean' ? C.success : C.accent) : 'transparent',
            color: verdict === v ? C.bg : C.textDim,
            border:`1px solid ${v === 'phishing' ? C.danger : v === 'suspicious' ? C.warn : v === 'clean' ? C.success : C.border}`,
            borderRadius:4, padding:'5px 14px', cursor:'pointer',
            fontFamily:'inherit', fontSize:11, letterSpacing:'0.06em', textTransform:'uppercase',
          }}>{v || 'ALL'} {v === '' ? `(${total})` : ''}</button>
        ))}
      </div>

      <Card title={`Scan Logs (${total})`}>
        {loading ? (
          <div style={{ color:C.textDim, textAlign:'center', padding:24 }}>Loading...</div>
        ) : logs.length === 0 ? (
          <div style={{ color:C.textDim, textAlign:'center', padding:24 }}>No logs found</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {logs.map(log => (
              <div key={log.id}>
                <div
                  onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                  style={{
                    display:'flex', gap:12, alignItems:'center', justifyContent:'space-between',
                    background:'#060b17', border:`1px solid ${C.border}`,
                    borderRadius:5, padding:'10px 14px', cursor:'pointer',
                  }}
                >
                  <VerdictBadge verdict={log.verdict} score={log.score} />
                  <span style={{ flex:1, fontSize:12, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {log.input?.slice(0,80)}
                  </span>
                  <span style={{ fontSize:11, color:C.textDim, whiteSpace:'nowrap' }}>
                    {new Date(log.scanned_at).toLocaleString()}
                  </span>
                </div>
                {expanded === log.id && (
                  <div style={{ background:'#030712', border:`1px solid ${C.border}`, borderTop:'none', borderRadius:'0 0 5px 5px', padding:'12px 14px' }}>
                    <div style={{ fontSize:12, color:C.textDim, marginBottom:8 }}>
                      <strong style={{ color:C.text }}>Full Input:</strong> {log.input}
                    </div>
                    {Array.isArray(log.signals) && log.signals.length > 0 && (
                      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        {log.signals.map((s, i) => <SignalRow key={i} signal={s} />)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <div style={{ display:'flex', gap:8, marginTop:14, justifyContent:'center' }}>
          <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} style={pageBtn}>← Prev</button>
          <span style={{ fontSize:11, color:C.textDim, padding:'6px 10px' }}>Page {page}</span>
          <button onClick={() => setPage(p => p+1)} disabled={logs.length < 15} style={pageBtn}>Next →</button>
        </div>
      </Card>
    </div>
  );
}

const pageBtn = {
  background:'transparent', border:`1px solid ${C.border}`, color:C.textDim,
  borderRadius:4, padding:'5px 14px', cursor:'pointer', fontFamily:'inherit', fontSize:11,
};

const inputStyle = {
  background:'#060b17', border:`1px solid ${C.border}`, color:C.text,
  borderRadius:5, padding:'8px 12px', fontFamily:"'Space Mono', monospace",
  fontSize:12, outline:'none',
};

// ── App Shell ─────────────────────────────────────────────────────────────────

// ── How It Works Tab ──────────────────────────────────────────────────────────

function HowItWorks() {
  const layers = [
    {
      num: '01',
      title: 'Input Ingestion',
      color: C.accent,
      icon: '⬇',
      desc: 'Any URL, raw email body, or free-form text is accepted. The engine auto-detects the input type (URL / text / email) or you can force a specific mode.',
      points: ['Supports single scan & bulk batch (up to 50 inputs per call)', 'Input is normalised and truncated to 500 chars for analysis', 'Source tagging lets you track which integration triggered the scan'],
    },
    {
      num: '02',
      title: 'Allowlist Check',
      color: C.success,
      icon: '✓',
      desc: 'Before any analysis, the domain is checked against a trusted allowlist. Allowlisted domains are immediately returned as clean, avoiding false positives on major platforms.',
      points: ['Pre-seeded with google.com, microsoft.com, github.com and 7 others', 'Fully editable via API: POST /api/allowlist', 'Root-domain matching: "login.google.com" matches "google.com"'],
    },
    {
      num: '03',
      title: 'URL Structural Analysis',
      color: '#ff9800',
      icon: '🔗',
      desc: 'For URL inputs the engine performs deep structural dissection, flagging patterns statistically correlated with phishing infrastructure.',
      points: [
        'IP-as-hostname detection (+30 pts) — legitimate sites use domain names',
        'Suspicious TLD blacklist — .tk .ml .xyz .top .gq and 14 others (+25 pts)',
        'URL-encoding tricks in hostname (+20 pts)',
        'URL shortener detection — bit.ly, tinyurl, goo.gl (+15 pts)',
        'Deep subdomain nesting ≥3 levels (+15 pts)',
        'Non-ASCII / Cyrillic homoglyph characters (+20–35 pts)',
      ],
    },
    {
      num: '04',
      title: 'Brand Impersonation / Typosquat Detection',
      color: C.danger,
      icon: '🎭',
      desc: 'The engine compares every scanned hostname against a list of 20+ major brands using Levenshtein edit-distance, catching subtle misspellings designed to deceive users.',
      points: [
        'Covers PayPal, Google, Apple, Microsoft, Amazon, Netflix, Chase, HSBC and more',
        'Edit distance ≤ 2 triggers a typosquat alert (+35 pts)',
        'Brand keyword embedded in domain also flagged (+30 pts)',
        'Example: "paypa1-secure.tk" → detected as PayPal typosquat',
      ],
    },
    {
      num: '05',
      title: 'Text & Email Heuristics',
      color: C.warn,
      icon: '📧',
      desc: 'For text/email inputs, 12 regex-based heuristic rules fire against the body, targeting common social-engineering language patterns.',
      points: [
        'Urgency manipulation: "urgent action required" (+20 pts)',
        'Account suspension threats (+25 pts)',
        'Password expiry lures (+25 pts)',
        'SSN / credit card harvesting language (+35 pts)',
        'Generic salutations: "Dear Customer" (+10 pts)',
        'Embedded URLs inside text are recursively scanned at 60% weight',
      ],
    },
    {
      num: '06',
      title: 'Keyword Database Matching',
      color: '#b388ff',
      icon: '🔑',
      desc: 'The input is matched against your managed keyword library. Each keyword carries a severity level that maps directly to a score contribution.',
      points: [
        'Severity → score: LOW +10 · MEDIUM +20 · HIGH +30 · CRITICAL +45',
        '18 default keywords pre-seeded across 6 categories',
        'Full CRUD API — add, update severity, bulk import, delete',
        'Hit counter increments per keyword per scan for analytics',
        'Categories: credential · urgency · financial · brand-abuse · scam · general',
      ],
    },
    {
      num: '07',
      title: 'Verdict & Scoring',
      color: C.accent,
      icon: '⚖',
      desc: 'All signal scores are summed and capped at 100. The final verdict is derived from three clearly defined thresholds.',
      points: [
        '0–34   → ✅ CLEAN — No significant threat signals',
        '35–69  → ⚠️ SUSPICIOUS — Review recommended',
        '70–100 → 🚨 PHISHING — High confidence threat',
        'Each scan returns full signal breakdown for explainability',
        'Every result is persisted to SQLite for audit and analytics',
      ],
    },
  ];

  const integrations = [
    { icon: '🌐', name: 'REST API', desc: 'POST /api/scan from any app, SIEM, or script. Supports single and bulk (50×) scan endpoints.' },
    { icon: '🤖', name: 'Telegram Bot', desc: 'Auto-scans URLs and messages in any chat. Add keywords via /addkeyword command.' },
    { icon: '🐍', name: 'Python / cURL', desc: 'Lightweight client — no SDK needed. Standard JSON in/out over HTTP.' },
    { icon: '🐳', name: 'Docker', desc: 'docker-compose up -d deploys the full stack: API + Dashboard + Bot in one command.' },
  ];

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Hero */}
      <div style={{
        background: `linear-gradient(135deg, #0d1a2e 0%, #0a1525 100%)`,
        border: `1px solid ${C.border}`,
        borderLeft: `4px solid ${C.accent}`,
        borderRadius: 10, padding: '32px 36px', marginBottom: 24,
      }}>
        <div style={{ fontFamily:"'Syne', sans-serif", fontSize: 28, fontWeight: 800, color: C.accent, marginBottom: 10 }}>
          How PhishBOT Works
        </div>
        <div style={{ fontSize: 14, color: C.textDim, lineHeight: 1.7, maxWidth: 720 }}>
          PhishBOT is a <span style={{ color: C.text }}>multi-layer phishing detection engine</span> that
          analyses URLs, email bodies, and raw text through a pipeline of structural, heuristic, and keyword-based
          checks. Every scan produces an <span style={{ color: C.text }}>explainable score</span> — not just a verdict.
        </div>
        <div style={{ display: 'flex', gap: 24, marginTop: 20 }}>
          {[
            { label: 'Detection Layers', value: '7' },
            { label: 'Default Keywords', value: '18' },
            { label: 'Brand Watchlist', value: '20+' },
            { label: 'Scoring Cap', value: '100' },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: C.accent, fontFamily: "'Syne', sans-serif" }}>{s.value}</div>
              <div style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline flow */}
      <div style={{ marginBottom: 12, fontSize: 11, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
        Detection Pipeline
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 28 }}>
        {layers.map((layer, i) => (
          <LayerCard key={i} layer={layer} />
        ))}
      </div>

      {/* Scoring table */}
      <Card title="Scoring Reference" style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            { range: '0 – 34', verdict: 'CLEAN', color: C.success, note: 'No action needed' },
            { range: '35 – 69', verdict: 'SUSPICIOUS', color: C.warn, note: 'Manual review' },
            { range: '70 – 100', verdict: 'PHISHING', color: C.danger, note: 'Block / report' },
            { range: 'CRITICAL kw', verdict: '+45 pts', color: '#b388ff', note: 'Highest weight' },
          ].map((s, i) => (
            <div key={i} style={{
              background: '#060b17', border: `1px solid ${s.color}33`,
              borderTop: `3px solid ${s.color}`,
              borderRadius: 6, padding: '14px 16px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: s.color, fontFamily: "'Syne', sans-serif" }}>{s.range}</div>
              <div style={{ fontSize: 12, color: s.color, fontWeight: 700, margin: '6px 0 4px' }}>{s.verdict}</div>
              <div style={{ fontSize: 11, color: C.textDim }}>{s.note}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Integrations */}
      <div style={{ marginBottom: 12, fontSize: 11, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
        Integrations
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 24 }}>
        {integrations.map((int, i) => (
          <div key={i} style={{
            background: C.panel, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: '18px 20px', display: 'flex', gap: 14,
          }}>
            <span style={{ fontSize: 24 }}>{int.icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>{int.name}</div>
              <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6 }}>{int.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer credit */}
      <div style={{
        textAlign: 'center', padding: '18px 0', fontSize: 12, color: C.textDim,
        borderTop: `1px solid ${C.border}`,
      }}>
        Built by <span style={{ color: C.accent, fontWeight: 700 }}>Ali AlEnezi</span>
        {' '}&nbsp;·&nbsp;{' '}
        <a href="https://github.com/SiteQ8/PhishBOT" style={{ color: C.accent }} target="_blank" rel="noreferrer">
          github.com/SiteQ8/PhishBOT
        </a>
      </div>
    </div>
  );
}

function LayerCard({ layer }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      background: C.panel, border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${layer.color}`,
      borderRadius: 6, overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 18px', cursor: 'pointer',
        }}
      >
        <span style={{
          fontFamily: "'Syne', sans-serif", fontWeight: 800,
          fontSize: 13, color: layer.color, minWidth: 28,
        }}>{layer.num}</span>
        <span style={{ fontSize: 22 }}>{layer.icon}</span>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: C.text }}>{layer.title}</span>
        <span style={{ fontSize: 11, color: C.textDim }}>{open ? '▲ collapse' : '▼ details'}</span>
      </div>
      {open && (
        <div style={{ padding: '0 18px 16px 60px', borderTop: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 13, color: C.textDim, lineHeight: 1.7, margin: '12px 0 10px' }}>{layer.desc}</p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {layer.points.map((pt, i) => (
              <li key={i} style={{ fontSize: 12, color: C.text, display: 'flex', gap: 8 }}>
                <span style={{ color: layer.color, flexShrink: 0 }}>›</span>
                <span>{pt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const TABS = ['Dashboard', 'Scanner', 'Keywords', 'Logs', 'How It Works'];

export default function App() {
  const [tab, setTab]     = useState('Dashboard');
  const [health, setHealth] = useState(null);

  useEffect(() => {
    apiFetch('/api/health')
      .then(d => setHealth(d.success ? 'online' : 'error'))
      .catch(() => setHealth('offline'));
  }, []);

  return (
    <div style={styles.root}>
      {/* Top bar */}
      <div style={{
        background: C.panel,
        borderBottom: `1px solid ${C.border}`,
        padding: '0 28px',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        height: 56,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <span style={{
            fontFamily:"'Syne', sans-serif", fontWeight:800, fontSize:18,
            color:C.accent, letterSpacing:'0.05em',
          }}>
            🎣 PHISHBOT
          </span>
          <span style={{ fontSize:11, color:C.textDim }}>v1.0.0</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{
            width:7, height:7, borderRadius:'50%', display:'inline-block',
            background: health === 'online' ? C.success : health === 'offline' ? C.danger : C.warn,
            boxShadow: `0 0 6px ${health === 'online' ? C.success : C.danger}`,
          }}/>
          <span style={{ fontSize:11, color:C.textDim }}>
            API {health || 'checking...'}
          </span>
        </div>
      </div>

      {/* Nav tabs */}
      <div style={{
        background:C.panel, borderBottom:`1px solid ${C.border}`,
        padding:'0 28px', display:'flex', gap:0,
      }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background:'transparent', border:'none',
            borderBottom: tab === t ? `2px solid ${C.accent}` : '2px solid transparent',
            color: tab === t ? C.accent : C.textDim,
            padding:'14px 20px', cursor:'pointer', fontFamily:'inherit',
            fontSize:12, letterSpacing:'0.08em', textTransform:'uppercase',
            transition:'color 0.15s',
          }}>{t}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding:'24px 28px' }}>
        {tab === 'Dashboard'    && <Dashboard />}
        {tab === 'Scanner'      && <Scanner />}
        {tab === 'Keywords'     && <Keywords />}
        {tab === 'Logs'         && <Logs />}
        {tab === 'How It Works' && <HowItWorks />}
      </div>
    </div>
  );
}
