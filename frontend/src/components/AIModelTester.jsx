import React, { useState, useEffect, useCallback } from 'react';

const FLASK_URL = process.env.REACT_APP_FLASK_URL || 'http://localhost:5000';

const ROOM_COLORS = {
  living_room:    '#dbeafe',
  kitchen:        '#fef9c3',
  dining_room:    '#fce7f3',
  master_bedroom: '#ede9fe',
  bedroom:        '#dcfce7',
  bathroom:       '#cffafe',
  study:          '#ffedd5',
  utility_room:   '#f3f4f6',
  balcony:        '#d1fae5',
  prayer_room:    '#fdf2f8',
};
const ROOM_BORDER = {
  living_room:    '#3b82f6',
  kitchen:        '#ca8a04',
  dining_room:    '#ec4899',
  master_bedroom: '#7c3aed',
  bedroom:        '#16a34a',
  bathroom:       '#0891b2',
  study:          '#ea580c',
  utility_room:   '#6b7280',
  balcony:        '#059669',
  prayer_room:    '#db2777',
};
const ROOM_LABEL = {
  living_room: 'Living', kitchen: 'Kitchen', dining_room: 'Dining',
  master_bedroom: 'Master Bed', bedroom: 'Bedroom', bathroom: 'Bath',
  study: 'Study', utility_room: 'Utility', balcony: 'Balcony',
  prayer_room: 'Prayer',
};

const MODEL_META = {
  housediffusion: {
    label: 'HouseDiffusion',
    color: '#6366f1',
    bg: '#eef2ff',
    desc: 'Diffusion model — vector floorplan generation',
    tag: 'Sample output (needs pretrained checkpoint)',
  },
  ce2eplan: {
    label: 'CE2EPlan (HouseGAN++)',
    color: '#0891b2',
    bg: '#ecfeff',
    desc: 'GAN-based end-to-end floorplan generation',
    tag: 'Checkpoint loaded — simplified inference',
  },
  graph2plan: {
    label: 'Graph2Plan',
    color: '#16a34a',
    bg: '#f0fdf4',
    desc: 'Graph neural network — layout graph to floorplan',
    tag: 'Sample output (needs MATLAB + dataset)',
  },
};

/* ─── SVG Floor Plan ─────────────────────────────────────────────── */
function FloorPlanSVG({ floorplan, size = 260 }) {
  if (!floorplan?.output?.rooms?.length) return (
    <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 8 }}>
      <span style={{ color: '#94a3b8', fontSize: 13 }}>No floor plan data</span>
    </div>
  );

  const rooms = floorplan.output.rooms;
  const bW = floorplan.input?.boundary?.width  || 30;
  const bH = floorplan.input?.boundary?.depth  || 50;
  const PAD = 16;
  const scaleX = (size - PAD * 2) / bW;
  const scaleY = (size - PAD * 2) / bH;
  const sc = Math.min(scaleX, scaleY);
  const drawW = bW * sc;
  const drawH = bH * sc;
  const offX = (size - drawW) / 2;
  const offY = (size - drawH) / 2;

  return (
    <svg width={size} height={size} style={{ borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
      {/* Plot boundary */}
      <rect x={offX} y={offY} width={drawW} height={drawH}
        fill="#f1f5f9" stroke="#334155" strokeWidth={1.5} />

      {/* Rooms */}
      {rooms.map((room, i) => {
        const x = offX + room.bbox.x1 * sc;
        const y = offY + room.bbox.y1 * sc;
        const w = (room.bbox.x2 - room.bbox.x1) * sc;
        const h = (room.bbox.y2 - room.bbox.y1) * sc;
        const fill   = ROOM_COLORS[room.type]  || '#e2e8f0';
        const stroke = ROOM_BORDER[room.type]  || '#64748b';
        const label  = ROOM_LABEL[room.type]   || room.type;
        const fontSize = Math.min(10, w / label.length * 1.4, h / 2.2);
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h}
              fill={fill} stroke={stroke} strokeWidth={1} rx={1} />
            {w > 28 && h > 18 && (
              <>
                <text x={x + w / 2} y={y + h / 2 - 3}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={Math.max(6, fontSize)} fill="#1e293b" fontWeight="600">
                  {label}
                </text>
                <text x={x + w / 2} y={y + h / 2 + 8}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={Math.max(5, fontSize - 1)} fill="#475569">
                  {room.area_sqft}ft²
                </text>
              </>
            )}
          </g>
        );
      })}

      {/* Doors */}
      {floorplan.output.doors?.map((door, i) => (
        door.position && (
          <circle key={i}
            cx={offX + door.position[0] * sc}
            cy={offY + door.position[1] * sc}
            r={4} fill="#f59e0b" stroke="#b45309" strokeWidth={1} />
        )
      ))}

      {/* Dimension label */}
      <text x={offX + drawW / 2} y={offY + drawH + 11}
        textAnchor="middle" fontSize={9} fill="#64748b">
        {bW}ft × {bH}ft
      </text>
    </svg>
  );
}

/* ─── Vastu Bar ──────────────────────────────────────────────────── */
function VastuBar({ vastu }) {
  if (!vastu) return null;
  const pct = vastu.percentage || 0;
  const color = pct >= 60 ? '#16a34a' : pct >= 30 ? '#d97706' : '#dc2626';
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
        <span style={{ color: '#64748b' }}>Vastu compliance</span>
        <span style={{ color, fontWeight: 700 }}>{pct.toFixed(0)}%</span>
      </div>
      <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.6s' }} />
      </div>
      <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {vastu.details?.map((d, i) => (
          <span key={i} style={{
            fontSize: 10, padding: '1px 6px', borderRadius: 10,
            background: d.status === 'pass' ? '#dcfce7' : '#fee2e2',
            color: d.status === 'pass' ? '#15803d' : '#dc2626',
          }}>
            {d.status === 'pass' ? '✓' : '✗'} {d.room.replace('_', ' ')}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Single Model Card ──────────────────────────────────────────── */
function ModelCard({ modelId, result, loading, error }) {
  const meta = MODEL_META[modelId] || { label: modelId, color: '#64748b', bg: '#f8fafc', desc: '', tag: '' };
  const rooms = result?.output?.rooms || [];
  const efficiency = result?.metrics?.efficiency;
  const genTime = result?.metrics?.generation_time_seconds;
  const vastu = result?._vastu;

  return (
    <div style={{
      border: `1.5px solid ${meta.color}30`, borderRadius: 12,
      background: '#fff', overflow: 'hidden', minHeight: 420,
    }}>
      {/* Header */}
      <div style={{ background: meta.bg, padding: '12px 16px', borderBottom: `1px solid ${meta.color}20` }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{meta.label}</div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{meta.desc}</div>
        <div style={{
          marginTop: 4, fontSize: 10, padding: '2px 8px', borderRadius: 10, display: 'inline-block',
          background: result?.metrics?.using_real_model ? '#dcfce7' : '#fef9c3',
          color: result?.metrics?.using_real_model ? '#15803d' : '#92400e',
        }}>
          {result?.metrics?.using_real_model ? 'Real ML inference' : meta.tag}
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
            <div style={{ fontSize: 13 }}>Generating...</div>
          </div>
        )}

        {error && !loading && (
          <div style={{ background: '#fee2e2', borderRadius: 8, padding: 12, fontSize: 12, color: '#dc2626' }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && !loading && (
          <>
            {/* Floor plan SVG */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <FloorPlanSVG floorplan={result} size={240} />
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1, background: '#f8fafc', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{rooms.length}</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>rooms</div>
              </div>
              <div style={{ flex: 1, background: '#f8fafc', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                  {efficiency ? `${(efficiency * 100).toFixed(0)}%` : '—'}
                </div>
                <div style={{ fontSize: 10, color: '#64748b' }}>efficiency</div>
              </div>
              <div style={{ flex: 1, background: '#f8fafc', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                  {genTime !== undefined ? `${genTime}s` : '—'}
                </div>
                <div style={{ fontSize: 10, color: '#64748b' }}>time</div>
              </div>
            </div>

            {/* Room list */}
            <div style={{ fontSize: 11, color: '#475569', marginBottom: 8 }}>
              {rooms.map((r, i) => {
                const w = r.bbox.x2 - r.bbox.x1;
                const h = r.bbox.y2 - r.bbox.y1;
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span>{ROOM_LABEL[r.type] || r.type}</span>
                    <span style={{ color: '#94a3b8' }}>{w}×{h}ft ({r.area_sqft}ft²)</span>
                  </div>
                );
              })}
            </div>

            <VastuBar vastu={vastu} />
          </>
        )}

        {!result && !loading && !error && (
          <div style={{ textAlign: 'center', padding: 40, color: '#cbd5e1', fontSize: 13 }}>
            Press Test to generate
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */
export default function AIModelTester() {
  const [plotWidth, setPlotWidth]   = useState(30);
  const [plotDepth, setPlotDepth]   = useState(50);
  const [flaskOk, setFlaskOk]       = useState(null); // null=checking, true/false
  const [loadingAll, setLoadingAll] = useState(false);
  const [results, setResults]       = useState({}); // { housediffusion: {...}, ce2eplan: {...}, graph2plan: {...} }
  const [errors, setErrors]         = useState({});
  const [loading, setLoading]       = useState({});

  /* check Flask health on mount */
  useEffect(() => {
    fetch(`${FLASK_URL}/health`, { signal: AbortSignal.timeout(3000) })
      .then(r => r.json())
      .then(d => setFlaskOk(d.status === 'healthy'))
      .catch(() => setFlaskOk(false));
  }, []);

  const analyzeVastu = async (floorplan) => {
    try {
      const r = await fetch(`${FLASK_URL}/analyze-vastu`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ floorplan }),
      });
      return await r.json();
    } catch { return null; }
  };

  const testModel = useCallback(async (modelId) => {
    setLoading(prev => ({ ...prev, [modelId]: true }));
    setErrors(prev => ({ ...prev, [modelId]: null }));
    try {
      const res = await fetch(`${FLASK_URL}/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plot_width: plotWidth, plot_depth: plotDepth, model: modelId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const vastu = await analyzeVastu(data);
      setResults(prev => ({ ...prev, [modelId]: { ...data, _vastu: vastu } }));
    } catch (e) {
      setErrors(prev => ({ ...prev, [modelId]: e.message }));
    } finally {
      setLoading(prev => ({ ...prev, [modelId]: false }));
    }
  }, [plotWidth, plotDepth]);

  const testAll = async () => {
    setLoadingAll(true);
    await Promise.all(['housediffusion', 'ce2eplan', 'graph2plan'].map(testModel));
    setLoadingAll(false);
  };

  const anyResult = Object.keys(results).length > 0;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px', fontFamily: 'system-ui, sans-serif' }}>

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0 }}>AI Model Tester</h1>
        <p style={{ color: '#64748b', marginTop: 4, fontSize: 14 }}>
          Test HouseDiffusion, CE2EPlan, and Graph2Plan — compare floor plan quality side by side.
        </p>
      </div>

      {/* Flask status banner */}
      {flaskOk === false && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#92400e' }}>
          <strong>Flask service not running.</strong> Start it locally:
          <code style={{ marginLeft: 8, background: '#fef3c7', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>
            cd models/flask_service && python app.py
          </code>
        </div>
      )}
      {flaskOk === true && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#15803d' }}>
          Flask service running at {FLASK_URL} — ready to test
        </div>
      )}

      {/* Controls */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 24, display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Plot Width (ft)</label>
          <input type="number" value={plotWidth} min={20} max={100}
            onChange={e => setPlotWidth(Number(e.target.value))}
            style={{ width: 90, padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14 }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Plot Depth (ft)</label>
          <input type="number" value={plotDepth} min={20} max={150}
            onChange={e => setPlotDepth(Number(e.target.value))}
            style={{ width: 90, padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14 }} />
        </div>

        {/* Individual test buttons */}
        {['housediffusion', 'ce2eplan', 'graph2plan'].map(m => (
          <button key={m}
            onClick={() => testModel(m)}
            disabled={loading[m] || flaskOk === false}
            style={{
              padding: '8px 14px', borderRadius: 8, border: `1.5px solid ${MODEL_META[m].color}`,
              background: loading[m] ? '#f8fafc' : MODEL_META[m].bg,
              color: MODEL_META[m].color, fontWeight: 600, fontSize: 12, cursor: 'pointer',
              opacity: flaskOk === false ? 0.4 : 1,
            }}>
            {loading[m] ? '⟳ Testing...' : `Test ${MODEL_META[m].label.split(' ')[0]}`}
          </button>
        ))}

        <button onClick={testAll} disabled={loadingAll || flaskOk === false}
          style={{
            padding: '8px 20px', borderRadius: 8, border: 'none',
            background: loadingAll ? '#cbd5e1' : '#0f172a',
            color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            marginLeft: 'auto', opacity: flaskOk === false ? 0.4 : 1,
          }}>
          {loadingAll ? 'Testing all…' : 'Test All 3 Models'}
        </button>
      </div>

      {/* Results — 3 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {['housediffusion', 'ce2eplan', 'graph2plan'].map(m => (
          <ModelCard key={m} modelId={m}
            result={results[m]}
            loading={loading[m]}
            error={errors[m]} />
        ))}
      </div>

      {/* Summary table once we have results */}
      {anyResult && (
        <div style={{ marginTop: 24, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginTop: 0, marginBottom: 14 }}>Summary</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Model', 'Rooms', 'Efficiency', 'Vastu', 'Gen Time', 'Mode'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#64748b', fontWeight: 600, fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {['housediffusion', 'ce2eplan', 'graph2plan'].map(m => {
                const r = results[m];
                const err = errors[m];
                const meta = MODEL_META[m];
                return (
                  <tr key={m} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '9px 12px', fontWeight: 600, color: meta.color }}>{meta.label}</td>
                    <td style={{ padding: '9px 12px' }}>{r ? r.output?.rooms?.length : err ? '—' : '...'}</td>
                    <td style={{ padding: '9px 12px' }}>{r ? `${((r.metrics?.efficiency || 0) * 100).toFixed(0)}%` : '—'}</td>
                    <td style={{ padding: '9px 12px' }}>
                      {r?._vastu ? (
                        <span style={{ color: r._vastu.percentage >= 50 ? '#15803d' : '#dc2626', fontWeight: 600 }}>
                          {r._vastu.percentage.toFixed(0)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '9px 12px' }}>{r ? `${r.metrics?.generation_time_seconds}s` : '—'}</td>
                    <td style={{ padding: '9px 12px', fontSize: 11 }}>
                      {r?.metrics?.using_real_model
                        ? <span style={{ color: '#15803d', background: '#dcfce7', padding: '2px 7px', borderRadius: 8 }}>Real ML</span>
                        : <span style={{ color: '#92400e', background: '#fef9c3', padding: '2px 7px', borderRadius: 8 }}>Sample</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
