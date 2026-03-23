import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import ThreeDViewer from '../components/ThreeDViewer';
import SVGFloorPlan from '../components/SVGFloorPlan';

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PlanResults() {
  const navigate      = useNavigate();
  const location      = useLocation();
  const [plans,        setPlans]        = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [show3D,       setShow3D]       = useState(false);
  const [showPro,      setShowPro]      = useState(false);

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
        <div className="flex gap-3">
          <button onClick={() => selectedPlan && navigate(`/editor/${selectedPlan._id}`)}
            disabled={!selectedPlan}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Edit Plan
          </button>
          <button onClick={() => selectedPlan && setShow3D(true)}
            disabled={!selectedPlan}
            className="bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5">
            <span>🏠</span> View in 3D
          </button>
          <button onClick={() => selectedPlan && setShowPro(true)}
            disabled={!selectedPlan}
            className="bg-slate-700 hover:bg-slate-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5">
            <span>📐</span> Full Screen
          </button>
          <button onClick={() => selectedPlan && navigate(`/export/${selectedPlan._id}`)}
            disabled={!selectedPlan}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Export Plan
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

        {/* ── Preview ── */}
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
                  </div>
                </div>
                <div className="text-right text-xs text-gray-400 flex-shrink-0">
                  {new Date(selectedPlan.createdAt).toLocaleString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </div>
              </div>

              {/* SVG Floor Plan canvas — fluid, min 70vh */}
              <div style={{
                width: '100%', minHeight: '70vh',
                display: 'flex', alignItems: 'stretch',
                background: '#f5f2ea', padding: 0, lineHeight: 0,
              }}>
                <div style={{ flex: 1 }}>
                  <SVGFloorPlan layout={layout} />
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 divide-x divide-gray-100 border-t border-gray-100">
                {[
                  { label: 'Plot',   value: `${layout.plot.width}' × ${layout.plot.length}'` },
                  { label: 'Rooms',  value: layout.rooms?.length || 0 },
                  { label: 'Facing', value: (layout.plot.facing || '').toUpperCase() },
                  { label: 'Doors',  value: layout.doors?.length || 0 },
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

      {/* ── Full-screen Professional View Modal ── */}
      {showPro && selectedPlan?.layoutJson && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#f5f2ea' }}>
          <div className="flex items-center justify-between px-5 py-3 bg-gray-900 border-b border-gray-700 flex-shrink-0">
            <div>
              <h2 className="text-white font-semibold text-base">{selectedPlan.title} — Full Drawing</h2>
              <p className="text-gray-400 text-xs mt-0.5">Hover over rooms for details · Use layer toggles above the plan</p>
            </div>
            <button onClick={() => setShowPro(false)}
              className="text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors">
              ✕ Close
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-auto" style={{ background: '#f5f2ea' }}>
            <SVGFloorPlan layout={selectedPlan.layoutJson} />
          </div>
        </div>
      )}

      {/* ── 3D Viewer Modal ── */}
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
