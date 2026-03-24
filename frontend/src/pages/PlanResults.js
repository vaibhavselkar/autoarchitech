import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import ThreeDViewer from '../components/ThreeDViewer';
import SVGFloorPlan from '../components/SVGFloorPlan';

// ─── Room meta for architect schedule ────────────────────────────────────────
const ROOM_NOTES = {
  living_room:    'Primary social space. Natural light from front façade.',
  master_bedroom: 'En-suite attached. South-west placement for Vastu.',
  bedroom:        'Window on exterior wall for cross ventilation.',
  kitchen:        'L-shaped platform, double sink. Exhaust on outer wall.',
  dining:         'Adjacent to kitchen. Central to circulation.',
  bathroom:       'WC + washbasin. Exhaust vent on exterior wall.',
  balcony:        'Open to sky. Buffer zone + ventilation corridor.',
  study:          'Work-from-home room. Quiet zone, north light preferred.',
  guest_room:     'Secondary bedroom or guest accommodation.',
  terrace:        'Roof terrace / open-to-sky area.',
  prayer_room:    'North-east corner recommended for Vastu compliance.',
  utility_room:   'Washing machine / utility storage.',
};
const ROOM_LABEL = {
  living_room:'Living Room', master_bedroom:'Master Bedroom', bedroom:'Bedroom',
  kitchen:'Kitchen', dining:'Dining Room', bathroom:'Bathroom', balcony:'Balcony',
  study:'Study', guest_room:'Guest Room', terrace:'Terrace',
  prayer_room:'Prayer Room', utility_room:'Utility Room',
};
const ROOM_COLOR = {
  living_room:'#e8f4f8', master_bedroom:'#e8e0f0', bedroom:'#fce4d6',
  kitchen:'#fde8d8', dining:'#fff3cd', bathroom:'#d0e8f0', balcony:'#d4edda',
  study:'#f3f0f8', guest_room:'#fdf0e8', terrace:'#e8f8e8',
  prayer_room:'#fff0f8', utility_room:'#f0f0f0',
};

// ─── Architect View modal ─────────────────────────────────────────────────────
function ArchitectView({ plan, onClose }) {
  const layout = plan.layoutJson;
  const plot   = layout.plot;
  const sb     = plot.setback || { front: 6, back: 4, left: 4, right: 4 };
  const rooms  = layout.rooms || [];

  const totalPlotArea    = (plot.width * plot.length * 0.0929).toFixed(1);
  const buildableW       = (plot.width  - sb.left - sb.right).toFixed(1);
  const buildableL       = (plot.length - sb.front - sb.back).toFixed(1);
  const buildableArea    = (buildableW * buildableL * 0.0929).toFixed(1);
  const builtUpSqFt      = rooms.reduce((s, r) => s + r.width * r.height, 0);
  const builtUpSqM       = (builtUpSqFt * 0.0929).toFixed(1);
  const efficiency       = ((builtUpSqFt / (plot.width * plot.length)) * 100).toFixed(0);

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#f0ede4' }}>

      {/* Header */}
      <div style={{
        background: '#1a2336', borderBottom: '1px solid #2d3a52',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px', flexShrink: 0,
      }}>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>
            {plan.title} — Architect View
          </div>
          <div style={{ color: '#7a8bab', fontSize: 11, marginTop: 2 }}>
            {layout.metadata?.theme} · {(layout.metadata?.layoutStyle || '').replace('-', ' ')} layout · Scale 1:100
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: '#7a8bab', fontSize: 11 }}>
            Hover rooms for details
          </span>
          <button onClick={onClose} style={{
            background: '#2d3a52', border: 'none', color: '#ccc',
            padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
            fontSize: 13, fontWeight: 500,
          }}>✕ Close</button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

        {/* ── Left: Floor plan (takes ~62% width) ── */}
        <div style={{ flex: '0 0 62%', overflow: 'auto', background: '#f5f2ea', borderRight: '1px solid #d8d0c0' }}>
          <SVGFloorPlan layout={layout} />
        </div>

        {/* ── Right: Room schedule + stats ── */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 18px', background: '#fafaf8' }}>

          {/* Plot summary strip */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8, marginBottom: 18,
          }}>
            {[
              { label: 'Plot Size',      value: `${plot.width}' × ${plot.length}'`, sub: `${totalPlotArea} sq.m` },
              { label: 'Buildable Area', value: `${buildableW}' × ${buildableL}'`, sub: `${buildableArea} sq.m` },
              { label: 'Space Efficiency', value: `${efficiency}%`, sub: `${builtUpSqM} sq.m built-up` },
            ].map(({ label, value, sub }) => (
              <div key={label} style={{
                background: '#fff', border: '1px solid #e5e0d8',
                borderRadius: 8, padding: '10px 12px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 10, color: '#999', marginBottom: 3 }}>{label}</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e' }}>{value}</div>
                <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Room Schedule */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: '#1a2336', marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Room Schedule
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#1a2336', color: '#fff' }}>
                  {['Room', 'W × D (ft)', 'Area (sq.ft)', 'Area (sq.m)'].map(h => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, fontSize: 10 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rooms.map((r, i) => {
                  const sqFt = (r.width * r.height).toFixed(0);
                  const sqM  = (r.width * r.height * 0.0929).toFixed(1);
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #ede8e0', background: i % 2 === 0 ? '#fff' : '#f8f6f2' }}>
                      <td style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          width: 10, height: 10, borderRadius: 2, flexShrink: 0,
                          background: ROOM_COLOR[r.type] || '#e8e8e8',
                          border: '1px solid #ccc', display: 'inline-block',
                        }}/>
                        {ROOM_LABEL[r.type] || r.type}
                      </td>
                      <td style={{ padding: '6px 8px', color: '#333' }}>{r.width}' × {r.height}'</td>
                      <td style={{ padding: '6px 8px', color: '#333', fontWeight: 600 }}>{sqFt}</td>
                      <td style={{ padding: '6px 8px', color: '#555' }}>{sqM}</td>
                    </tr>
                  );
                })}
                {/* Total row */}
                <tr style={{ background: '#1a2336', color: '#fff', fontWeight: 700 }}>
                  <td style={{ padding: '6px 8px' }}>TOTAL BUILT-UP</td>
                  <td style={{ padding: '6px 8px' }}>—</td>
                  <td style={{ padding: '6px 8px' }}>{builtUpSqFt.toFixed(0)}</td>
                  <td style={{ padding: '6px 8px' }}>{builtUpSqM}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Setback Table */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: '#1a2336', marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Setbacks
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <tbody>
                {[
                  { label: 'Front (Road side)', value: sb.back, note: 'Min. required varies by road width' },
                  { label: 'Rear (Garden side)', value: sb.front, note: 'Utility / service access' },
                  { label: 'Left side', value: sb.left, note: 'Shared boundary buffer' },
                  { label: 'Right side', value: sb.right, note: 'Shared boundary buffer' },
                ].map(({ label, value, note }) => (
                  <tr key={label} style={{ borderBottom: '1px solid #ede8e0' }}>
                    <td style={{ padding: '5px 8px', color: '#555', width: '40%' }}>{label}</td>
                    <td style={{ padding: '5px 8px', fontWeight: 600, color: '#1a2336', width: '20%' }}>{value} ft</td>
                    <td style={{ padding: '5px 8px', color: '#999', fontSize: 10 }}>{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Room Notes */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 12, color: '#1a2336', marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Design Notes
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[...new Set(rooms.map(r => r.type))].map(type => (
                <div key={type} style={{
                  display: 'flex', gap: 8, padding: '6px 10px',
                  background: '#fff', borderRadius: 6, border: '1px solid #e8e4dc',
                  alignItems: 'flex-start',
                }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: 2, flexShrink: 0, marginTop: 2,
                    background: ROOM_COLOR[type] || '#e8e8e8',
                    border: '1px solid #ccc', display: 'inline-block',
                  }}/>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 11, color: '#1a2336' }}>{ROOM_LABEL[type] || type}</div>
                    <div style={{ fontSize: 10, color: '#777', marginTop: 1, lineHeight: 1.5 }}>
                      {ROOM_NOTES[type] || 'Standard residential room.'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PlanResults() {
  const navigate      = useNavigate();
  const location      = useLocation();
  const [plans,        setPlans]        = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [show3D,       setShow3D]       = useState(false);
  const [showFull,     setShowFull]     = useState(false);
  const [showArch,     setShowArch]     = useState(false);

  useEffect(() => {
    if (location.state?.plans) {
      setPlans(location.state.plans);
      setSelectedPlan(location.state.plans[0] || null);
    } else {
      (async () => {
        setLoading(true);
        try {
          const res = await api.get('/plans');
          const p   = res.data.data.plans;
          setPlans(p);
          setSelectedPlan(p[0] || null);
        } catch { toast.error('Failed to fetch plans'); }
        finally   { setLoading(false); }
      })();
    }
  }, [location.state]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
    </div>
  );

  const layout = selectedPlan?.layoutJson;

  return (
    <div className="max-w-7xl mx-auto px-4 pb-10">

      {/* Header */}
      <div className="flex justify-between items-center py-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Generated Floor Plans</h1>
          <p className="text-sm text-gray-500 mt-0.5">{plans.length} plan{plans.length !== 1 ? 's' : ''}</p>
        </div>

        {/* ── 5 Action Buttons ── */}
        <div className="flex flex-wrap gap-2">
          {/* Full Screen */}
          <button onClick={() => selectedPlan && setShowFull(true)}
            disabled={!selectedPlan}
            className="bg-slate-600 hover:bg-slate-500 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5">
            <span>⛶</span> Full Screen
          </button>

          {/* Architect View */}
          <button onClick={() => selectedPlan && setShowArch(true)}
            disabled={!selectedPlan}
            className="bg-amber-700 hover:bg-amber-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5">
            <span>📐</span> Architect View
          </button>

          {/* 3D View */}
          <button onClick={() => selectedPlan && setShow3D(true)}
            disabled={!selectedPlan}
            className="bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5">
            <span>🏠</span> 3D View
          </button>

          {/* Edit Plan */}
          <button onClick={() => selectedPlan && navigate(`/editor/${selectedPlan._id}`)}
            disabled={!selectedPlan}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5">
            <span>✏️</span> Edit Plan
          </button>

          {/* Export */}
          <button onClick={() => selectedPlan && navigate(`/export/${selectedPlan._id}`)}
            disabled={!selectedPlan}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5">
            <span>⬇</span> Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Plan list ── */}
        <div className="lg:col-span-1" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest" style={{ marginBottom: 4 }}>Plans</p>
          {plans.length === 0
            ? <p className="text-sm text-gray-400">No plans yet. Generate some first.</p>
            : plans.map(plan => {
                const meta     = plan.layoutJson?.metadata || {};
                const isAI     = meta.generator === 'ai-enhanced' || meta.generator === 'ai-placement';
                const selected = selectedPlan?._id === plan._id;
                return (
                  <div key={plan._id} onClick={() => setSelectedPlan(plan)}
                    style={{
                      padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                      border: selected ? '1.5px solid #3b82f6' : '1px solid #e5e7eb',
                      background: selected ? '#eff6ff' : '#fff',
                      boxShadow: selected ? '0 1px 4px rgba(59,130,246,0.15)' : 'none',
                      transition: 'border-color 0.15s, background 0.15s',
                      userSelect: 'none',
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontWeight: 600, color: '#111', fontSize: 13, margin: 0,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {plan.title}
                        </p>
                        {meta.theme && (
                          <p style={{ fontSize: 11, color: '#888', margin: '1px 0 0',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {meta.theme}
                          </p>
                        )}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5, alignItems: 'center' }}>
                          <span style={{ fontSize: 10, color: '#777' }}>
                            {plan.layoutJson?.rooms?.length || 0} rooms
                          </span>
                          {meta.layoutStyle && (
                            <span style={{ fontSize: 10, background: '#f3f4f6', color: '#555',
                              padding: '2px 6px', borderRadius: 4 }}>
                              {meta.layoutStyle.replace('-', ' ')}
                            </span>
                          )}
                          {isAI && (
                            <span style={{ fontSize: 10, background: '#dbeafe', color: '#1d4ed8',
                              padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>AI</span>
                          )}
                        </div>
                      </div>
                      <span style={{ fontSize: 10, color: '#aaa', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {new Date(plan.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </div>
                );
              })}
        </div>

        {/* ── Normal Plan Preview ── */}
        <div className="lg:col-span-2">
          {selectedPlan && layout ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

              {/* Plan header */}
              <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-start gap-4 flex-wrap">
                <div>
                  <h2 className="font-bold text-gray-900 text-lg">{selectedPlan.title}</h2>
                  {layout.metadata?.description && (
                    <p className="text-sm text-gray-500 mt-0.5">{layout.metadata.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {layout.metadata?.layoutStyle && (
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium capitalize">
                        {layout.metadata.layoutStyle.replace('-', ' ')} layout
                      </span>
                    )}
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      Facing: {(layout.plot.facing || '').toUpperCase()}
                    </span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {layout.plot.width}' × {layout.plot.length}'
                    </span>
                  </div>
                </div>
                <div className="text-right text-xs text-gray-400 flex-shrink-0">
                  {new Date(selectedPlan.createdAt).toLocaleString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </div>
              </div>

              {/* SVG Floor Plan canvas */}
              <div style={{
                width: '100%', minHeight: '70vh',
                display: 'flex', alignItems: 'stretch',
                background: '#f5f2ea', padding: 0, lineHeight: 0,
              }}>
                <div style={{ flex: 1 }}>
                  <SVGFloorPlan layout={layout} />
                </div>
              </div>

              {/* Stats bar */}
              <div className="grid grid-cols-4 divide-x divide-gray-100 border-t border-gray-100">
                {[
                  { label: 'Plot',       value: `${layout.plot.width}' × ${layout.plot.length}'` },
                  { label: 'Rooms',      value: layout.rooms?.length || 0 },
                  { label: 'Built-up',   value: `${((layout.rooms || []).reduce((s,r)=>s+r.width*r.height,0)*0.0929).toFixed(0)} sq.m` },
                  { label: 'Facing',     value: (layout.plot.facing || '').toUpperCase() },
                ].map(({ label, value }) => (
                  <div key={label} className="px-4 py-3 text-center">
                    <div className="text-xs text-gray-400">{label}</div>
                    <div className="font-bold text-gray-900 text-sm mt-0.5">{value}</div>
                  </div>
                ))}
              </div>

            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 flex items-center justify-center h-72">
              <p className="text-gray-400 text-sm">Select a plan from the left to preview it</p>
            </div>
          )}
        </div>

      </div>

      {/* ── Full Screen Modal ── */}
      {showFull && selectedPlan?.layoutJson && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#f5f2ea' }}>
          <div className="flex items-center justify-between px-5 py-3 bg-gray-900 border-b border-gray-700 flex-shrink-0">
            <div>
              <h2 className="text-white font-semibold text-base">{selectedPlan.title} — Full Screen</h2>
              <p className="text-gray-400 text-xs mt-0.5">Hover over rooms for details · Use layer toggles inside the plan</p>
            </div>
            <button onClick={() => setShowFull(false)}
              className="text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors">
              ✕ Close
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-auto" style={{ background: '#f5f2ea' }}>
            <SVGFloorPlan layout={selectedPlan.layoutJson} />
          </div>
        </div>
      )}

      {/* ── Architect View Modal ── */}
      {showArch && selectedPlan && (
        <ArchitectView plan={selectedPlan} onClose={() => setShowArch(false)} />
      )}

      {/* ── 3D View Modal ── */}
      {show3D && selectedPlan?.layoutJson && (
        <div className="fixed inset-0 z-50 flex flex-col bg-gray-950">
          <div className="flex items-center justify-between px-5 py-3 bg-gray-900 border-b border-gray-700 flex-shrink-0">
            <div>
              <h2 className="text-white font-semibold text-base">{selectedPlan.title} — 3D View</h2>
              <p className="text-gray-400 text-xs mt-0.5">
                {selectedPlan.layoutJson.metadata?.theme}&nbsp;·&nbsp;
                {(selectedPlan.layoutJson.metadata?.layoutStyle || '').replace('-', ' ')} layout
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-xs hidden sm:block">
                🖱 Drag to rotate &nbsp;·&nbsp; Right-drag to pan &nbsp;·&nbsp; Scroll to zoom
              </span>
              <button onClick={() => setShow3D(false)}
                className="text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors">
                ✕ Close
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ThreeDViewer layout={selectedPlan.layoutJson} />
          </div>
        </div>
      )}

    </div>
  );
}
