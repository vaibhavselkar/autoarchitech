import { useState, useRef, useId } from 'react';

// ─── Room palette ─────────────────────────────────────────────────────────────
const ROOM_STYLE = {
  living_room:    { fill: '#e8f4f8', stroke: '#4a8aaa', text: '#1a3a5c', label: 'Living Room' },
  master_bedroom: { fill: '#e8e0f0', stroke: '#7a5aaa', text: '#3a2060', label: 'Master Bedroom' },
  bedroom:        { fill: '#fce4d6', stroke: '#c07040', text: '#6a2a10', label: 'Bedroom' },
  kitchen:        { fill: '#fde8d8', stroke: '#a06040', text: '#6a2a00', label: 'Kitchen' },
  dining:         { fill: '#fff3cd', stroke: '#b08030', text: '#5a4000', label: 'Dining Room' },
  bathroom:       { fill: '#d0e8f0', stroke: '#3a7a9a', text: '#0a3a5a', label: 'Bathroom' },
  balcony:        { fill: '#d4edda', stroke: '#3a8a5a', text: '#1a4a2a', label: 'Balcony' },
  study:          { fill: '#f3f0f8', stroke: '#6a6a8a', text: '#3a3060', label: 'Study' },
  guest_room:     { fill: '#fdf0e8', stroke: '#b06040', text: '#5a2a10', label: 'Guest Room' },
  terrace:        { fill: '#e8f8e8', stroke: '#3a8a3a', text: '#1a4a1a', label: 'Terrace' },
  prayer_room:    { fill: '#fff0f8', stroke: '#aa5a8a', text: '#5a1a3a', label: 'Prayer Room' },
  utility_room:   { fill: '#f0f0f0', stroke: '#808080', text: '#404040', label: 'Utility' },
  default:        { fill: '#f8f6f0', stroke: '#9CA3AF', text: '#374151', label: 'Room' },
};

const ROOM_NOTES = {
  living_room:    'Natural light from primary façade. Connect to dining.',
  master_bedroom: 'En-suite access recommended. South-west for Vastu.',
  bedroom:        'Window on exterior wall for cross ventilation.',
  kitchen:        'L-shaped platform with double sink. Exhaust on outer wall.',
  dining:         'Adjacent to kitchen. Central to circulation.',
  bathroom:       'WC + washbasin. Exhaust vent on exterior wall.',
  balcony:        'Open to sky. Buffer zone + ventilation.',
  study:          'Work-from-home / study room.',
  guest_room:     'Secondary bedroom or guest accommodation.',
  terrace:        'Roof terrace / open area.',
  prayer_room:    'North-east corner for Vastu compliance.',
  utility_room:   'Washing machine / utility storage.',
};

function rs(type) { return ROOM_STYLE[type] || ROOM_STYLE.default; }
function fmtFt(ft) { return `${Math.round(ft)}'`; }
function fmtDim(ft) { return `${Math.round(ft)}' [${(ft * 0.3048).toFixed(2)}m]`; }
function sqm(w, h) { return `${(w * h * 0.0929).toFixed(1)} sq.m`; }

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function Tooltip({ visible, x, y, data }) {
  if (!data) return null;
  return (
    <div style={{
      position: 'absolute', left: x, top: y,
      background: '#1a1a2e', color: '#fff',
      padding: '10px 14px', borderRadius: 6,
      fontSize: 12, pointerEvents: 'none',
      minWidth: 160, maxWidth: 220, lineHeight: 1.65,
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      zIndex: 30, transition: 'opacity 0.12s',
      opacity: visible ? 1 : 0,
    }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 5, color: '#a8d8ea' }}>{data.name}</div>
      {data.area && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: '#ccc' }}>
          <span>Area</span><span style={{ color: '#fff', fontWeight: 500 }}>{data.area}</span>
        </div>
      )}
      {data.dim && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: '#ccc' }}>
          <span>Size</span><span style={{ color: '#fff', fontWeight: 500 }}>{data.dim}</span>
        </div>
      )}
      {data.type && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: '#ccc' }}>
          <span>Type</span><span style={{ color: '#fff', fontWeight: 500 }}>{data.type}</span>
        </div>
      )}
      {data.note && (
        <div style={{ marginTop: 6, fontSize: 11, color: '#aaa', borderTop: '1px solid #2a2a4e', paddingTop: 5 }}>
          {data.note}
        </div>
      )}
    </div>
  );
}

// ─── Main component — uses fixed viewBox (900×680) so it scales with CSS ──────
export default function SVGFloorPlan({ layout }) {
  const uid = useId().replace(/:/g, '');
  const [tip, setTip]       = useState({ visible: false, x: 0, y: 0, data: null });
  const [layers, setLayers] = useState({ walls: true, dims: true, symbols: true, labels: true });
  const wrapRef = useRef(null);

  const toggleLayer = k => setLayers(l => ({ ...l, [k]: !l[k] }));

  const showTip = (e, data) => {
    if (!wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    let x = e.clientX - r.left + 14, y = e.clientY - r.top - 12;
    if (x + 240 > r.width) x -= 258;
    if (y < 0) y = 4;
    setTip({ visible: true, x, y, data });
  };
  const moveTip = e => {
    if (!tip.visible || !wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    let x = e.clientX - r.left + 14, y = e.clientY - r.top - 12;
    if (x + 240 > r.width) x -= 258;
    if (y < 0) y = 4;
    setTip(t => ({ ...t, x, y }));
  };
  const hideTip = () => setTip(t => ({ ...t, visible: false }));

  if (!layout?.plot) return null;

  // ── Fixed internal viewport ────────────────────────────────────────────────
  // SVG always renders at viewBox 900×680; CSS scales it to container width.
  const VW = 900, VH = 680;
  const PAD_L = 58, PAD_R = 70, PAD_T = 64, PAD_B = 88;
  const TOOL_H = 36, LEG_H = 48;

  const plot  = layout.plot;
  const sb    = plot.setback || { front: 6, back: 4, left: 4, right: 4 };
  const rooms = layout.rooms   || [];
  const doors = layout.doors   || [];
  const wins  = layout.windows || [];

  const drawW = VW - PAD_L - PAD_R;   // usable width inside margins
  const drawH = VH - PAD_T - PAD_B;   // usable height inside margins

  const scale  = Math.min(drawW / plot.width, drawH / plot.length);
  const plotPW = plot.width  * scale;
  const plotPH = plot.length * scale;
  const ox     = PAD_L + (drawW - plotPW) / 2;
  const oy     = PAD_T + (drawH - plotPH) / 2;

  const px = v => ox + v * scale;
  const py = v => oy + v * scale;

  // Buildable area corners
  const bx1 = px(sb.left), by1 = py(sb.back);
  const bx2 = px(plot.width - sb.right), by2 = py(plot.length - sb.front);
  const bW  = bx2 - bx1, bH = by2 - by1;

  // Wall thickness in pixels (thinner at smaller scales)
  const WO = Math.max(4, Math.min(10, scale * 0.28));   // outer wall
  const WI = Math.max(3, Math.min(7,  scale * 0.18));   // inner wall
  const DOOR_W = 3; // ft

  const facing    = (plot.facing || 'north').toUpperCase();
  const intWalls  = (layout.walls || []).filter(w => w.type === 'interior');
  const presentTypes = [...new Set(rooms.map(r => r.type))];

  function wallRect(x1s, y1s, x2s, y2s, thick) {
    const horiz = Math.abs(y2s - y1s) < 2;
    return horiz
      ? { x: Math.min(x1s, x2s), y: y1s - thick / 2, w: Math.abs(x2s - x1s), h: thick }
      : { x: x1s - thick / 2, y: Math.min(y1s, y2s), w: thick, h: Math.abs(y2s - y1s) };
  }

  // SVG def IDs
  const H1 = `h1-${uid}`, H2 = `h2-${uid}`, GR = `gr-${uid}`;
  const AR = `ar-${uid}`,  ARR = `arr-${uid}`;

  return (
    <div style={{ fontFamily: "'Inter','Segoe UI',Arial,sans-serif", lineHeight: 1 }}>

      {/* ── Toolbar ───────────────────────────────────────────────────────────── */}
      <div style={{
        height: TOOL_H, background: '#fff', borderBottom: '1px solid #e0dbd0',
        display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10,
        fontSize: 12, color: '#555',
      }}>
        <span style={{ fontWeight: 600, color: '#222', fontSize: 13 }}>Floor Plan — Ground Floor</span>
        <div style={{ flex: 1 }} />
        {[
          { k: 'walls', label: 'Walls' }, { k: 'dims', label: 'Dimensions' },
          { k: 'symbols', label: 'Symbols' }, { k: 'labels', label: 'Labels' },
        ].map(({ k, label }) => (
          <button key={k} onClick={() => toggleLayer(k)} style={{
            padding: '3px 10px', border: '1px solid #ccc', borderRadius: 4,
            background: layers[k] ? '#2a5298' : '#fff',
            color: layers[k] ? '#fff' : '#444',
            fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
          }}>{label}</button>
        ))}
        <div style={{ marginLeft: 6, paddingLeft: 8, borderLeft: '1px solid #ddd', color: '#888', fontSize: 10 }}>
          Scale 1:100
        </div>
      </div>

      {/* ── SVG canvas — viewBox drives all coordinates, CSS sets display size ── */}
      <div ref={wrapRef} style={{ position: 'relative', lineHeight: 0 }}
        onMouseMove={moveTip} onMouseLeave={hideTip}>
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          width="100%"
          height="auto"
          style={{ display: 'block' }}
        >
          <defs>
            <pattern id={H1} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="#777" strokeWidth="0.8"/>
            </pattern>
            <pattern id={H2} patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="4" stroke="#999" strokeWidth="0.55"/>
            </pattern>
            <pattern id={GR} patternUnits="userSpaceOnUse" width="20" height="20">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e8e4da" strokeWidth="0.4"/>
            </pattern>
            <marker id={AR} viewBox="0 0 8 8" refX="4" refY="4" markerWidth="4" markerHeight="4" orient="auto">
              <path d="M0 0L8 4L0 8Z" fill="#444"/>
            </marker>
            <marker id={ARR} viewBox="0 0 8 8" refX="4" refY="4" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
              <path d="M0 0L8 4L0 8Z" fill="#444"/>
            </marker>
          </defs>

          {/* ═══ LAYER 1 — Background ══════════════════════════════════════════ */}
          <rect width={VW} height={VH} fill="#f5f2ea"/>
          <rect x={ox} y={oy} width={plotPW} height={plotPH} fill={`url(#${GR})`}/>

          {/* Plot boundary dashes */}
          <rect x={ox} y={oy} width={plotPW} height={plotPH}
            fill="none" stroke="#b8a87a" strokeWidth="0.8" strokeDasharray="6 4"/>

          {/* Setback zone labels — small, muted */}
          <text x={ox + plotPW / 2} y={oy + 10} textAnchor="middle"
            fontSize="7.5" fill="#b0a070" fontFamily="monospace">
            FRONT SETBACK — {sb.back}ft
          </text>
          <text x={ox + plotPW / 2} y={oy + plotPH - 4} textAnchor="middle"
            fontSize="7.5" fill="#b0a070" fontFamily="monospace">
            REAR SETBACK — {sb.front}ft
          </text>
          <text x={ox + 7} y={oy + plotPH / 2} fontSize="7" fill="#b0a070" fontFamily="monospace"
            transform={`rotate(-90,${ox + 7},${oy + plotPH / 2})`}>SIDE {sb.left}ft</text>
          <text x={ox + plotPW - 5} y={oy + plotPH / 2} fontSize="7" fill="#b0a070" fontFamily="monospace"
            transform={`rotate(90,${ox + plotPW - 5},${oy + plotPH / 2})`}>SIDE {sb.right}ft</text>

          {/* Road banner — above plot top */}
          <rect x={ox} y={oy - 16} width={plotPW} height={14} fill="#E2E8F0" rx="2"/>
          <text x={ox + plotPW / 2} y={oy - 5} textAnchor="middle"
            fontSize="8" fontWeight="600" fontFamily="monospace" fill="#475569">
            ▼  ROAD  ({facing} FACING)  ▼
          </text>

          {/* ═══ LAYER 2 — Parking (behind rooms) ════════════════════════════ */}
          {layout.parking && (() => {
            const p = layout.parking;
            const ppx = px(p.x), ppy = py(p.y);
            const pw  = p.width * scale;
            const ph  = Math.min(p.height * scale, by1 - py(0) + 4); // clip to front setback + tiny overlap
            const cars = p.cars || 1;
            const bayW = pw / cars;
            return (
              <g style={{ cursor: 'pointer' }}
                onMouseEnter={e => showTip(e, { name: 'Parking Bay', type: 'Parking',
                  note: `${cars} car space${cars > 1 ? 's' : ''}, 2.5×5m each.` })}
                onMouseLeave={hideTip}>
                <rect x={ppx} y={ppy} width={pw} height={ph}
                  fill="#d8d0c0" stroke="#999" strokeWidth="0.7" rx="2"/>
                {Array.from({ length: cars }).map((_, ci) => {
                  const bxP = ppx + ci * bayW;
                  const cw = bayW - 4, ch = ph - 4;
                  const cxP = bxP + 2, cyP = ppy + 2;
                  const ww = cw * 0.16, wh = ch * 0.15;
                  return (
                    <g key={ci}>
                      {ci > 0 && <line x1={bxP} y1={ppy} x2={bxP} y2={ppy + ph} stroke="#aaa" strokeWidth="0.6"/>}
                      <rect x={cxP + cw * 0.1} y={cyP + ch * 0.06} width={cw * 0.8} height={ch * 0.88}
                        fill="#f0ece4" stroke="#888" strokeWidth="0.7" rx="2"/>
                      <line x1={cxP + cw * 0.18} y1={cyP + ch * 0.22} x2={cxP + cw * 0.82} y2={cyP + ch * 0.22}
                        stroke="#aaa" strokeWidth="0.7"/>
                      <line x1={cxP + cw * 0.18} y1={cyP + ch * 0.78} x2={cxP + cw * 0.82} y2={cyP + ch * 0.78}
                        stroke="#aaa" strokeWidth="0.7"/>
                      <rect x={cxP + cw*0.04} y={cyP + ch*0.1}  width={ww} height={wh} fill="#666" rx="1"/>
                      <rect x={cxP + cw*0.04} y={cyP + ch*0.75} width={ww} height={wh} fill="#666" rx="1"/>
                      <rect x={cxP + cw*0.80} y={cyP + ch*0.1}  width={ww} height={wh} fill="#666" rx="1"/>
                      <rect x={cxP + cw*0.80} y={cyP + ch*0.75} width={ww} height={wh} fill="#666" rx="1"/>
                      <text x={cxP + cw / 2} y={cyP + ch * 0.55} textAnchor="middle"
                        fontSize={Math.max(7, Math.min(11, cw * 0.28))} fontWeight="bold" fill="#555" fontFamily="sans-serif">P</text>
                    </g>
                  );
                })}
              </g>
            );
          })()}

          {/* ═══ LAYER 3 — Room colour fills (reduced opacity = less visual noise) */}
          {rooms.map((room, i) => {
            const s = rs(room.type);
            return (
              <rect key={`rf${i}`}
                x={px(room.x)} y={py(room.y)}
                width={room.width * scale} height={room.height * scale}
                fill={s.fill} opacity="0.55"
                style={{ cursor: 'pointer' }}
                onMouseEnter={e => showTip(e, {
                  name: s.label,
                  area: sqm(room.width, room.height),
                  dim:  `${fmtFt(room.width)} × ${fmtFt(room.height)}`,
                  note: ROOM_NOTES[room.type] || '',
                })}
              />
            );
          })}

          {/* ═══ LAYER 4 — Walls ══════════════════════════════════════════════ */}
          {layers.walls && (
            <g>
              {/* Outer wall hatch bands */}
              <rect x={bx1 - WO} y={by1 - WO} width={bW + WO*2} height={WO}
                fill={`url(#${H1})`} stroke="#2a2a2a" strokeWidth="0.6"/>
              <rect x={bx1 - WO} y={by2}       width={bW + WO*2} height={WO}
                fill={`url(#${H1})`} stroke="#2a2a2a" strokeWidth="0.6"/>
              <rect x={bx1 - WO} y={by1}        width={WO} height={bH}
                fill={`url(#${H1})`} stroke="#2a2a2a" strokeWidth="0.6"/>
              <rect x={bx2}      y={by1}         width={WO} height={bH}
                fill={`url(#${H1})`} stroke="#2a2a2a" strokeWidth="0.6"/>
              {/* Outer boundary bold line */}
              <rect x={bx1} y={by1} width={bW} height={bH}
                fill="none" stroke="#1a1a1a" strokeWidth="1.6"/>
              {/* Interior walls */}
              {intWalls.map((w, i) => {
                const x1s = px(w.x1), y1s = py(w.y1), x2s = px(w.x2), y2s = py(w.y2);
                const wr = wallRect(x1s, y1s, x2s, y2s, WI);
                return (
                  <rect key={`iw${i}`} x={wr.x} y={wr.y} width={wr.w} height={wr.h}
                    fill={`url(#${H2})`} stroke="#666" strokeWidth="0.5"/>
                );
              })}
            </g>
          )}

          {/* ═══ LAYER 5 — Floor fixtures (kitchen platform, bathroom WC) ════ */}
          {layers.symbols && (
            <g>
              {/* Kitchen platform + sink */}
              {rooms.filter(r => r.type === 'kitchen').map((room, i) => {
                const rx = px(room.x), ry = py(room.y);
                const rw = room.width * scale, rh = room.height * scale;
                if (rw < 22 || rh < 22) return null;
                const cD = Math.min(12, rh * 0.2);
                return (
                  <g key={`kp${i}`} style={{ cursor: 'pointer' }}
                    onMouseEnter={e => showTip(e, { name: 'Kitchen Platform', type: 'Fixture',
                      note: 'Granite top, 600mm deep.' })}
                    onMouseLeave={hideTip}>
                    <rect x={rx + 2} y={ry + rh - cD - 2} width={rw - 4} height={cD}
                      fill="#c8b89a" stroke="#8a7a60" strokeWidth="0.7" rx="1"/>
                    <rect x={rx + rw - cD - 2} y={ry + 2} width={cD} height={rh - cD - 4}
                      fill="#c8b89a" stroke="#8a7a60" strokeWidth="0.7" rx="1"/>
                    <rect x={rx + 4} y={ry + rh - cD} width={cD - 3} height={cD - 3}
                      fill="#e8ddd0" stroke="#777" strokeWidth="0.5" rx="1"/>
                    <circle cx={rx + 4 + (cD-3)/2} cy={ry + rh - cD + (cD-3)/2}
                      r={2} fill="none" stroke="#888" strokeWidth="0.5"/>
                  </g>
                );
              })}

              {/* Bathroom fixtures */}
              {rooms.filter(r => r.type === 'bathroom').map((room, i) => {
                const rx = px(room.x), ry = py(room.y);
                const rw = room.width * scale, rh = room.height * scale;
                if (rw < 18 || rh < 20) return null;
                const P = 2, wcW = Math.min(rw * 0.5, 22), wcH = Math.min(rh * 0.35, 26);
                const bsS = Math.min(rw * 0.42, 16);
                return (
                  <g key={`bf${i}`}>
                    <g style={{ cursor: 'pointer' }}
                      onMouseEnter={e => showTip(e, { name: 'WC', type: 'Sanitary', note: 'Wall-hung WC.' })}
                      onMouseLeave={hideTip}>
                      <rect x={rx+P} y={ry+rh-P-wcH} width={wcW} height={wcH*0.25}
                        fill="#e8f4f8" stroke="#4a7a9a" strokeWidth="0.7" rx="1"/>
                      <rect x={rx+P+wcW*0.05} y={ry+rh-P-wcH+wcH*0.25} width={wcW*0.9} height={wcH*0.75}
                        fill="#d8ecf4" stroke="#4a7a9a" strokeWidth="0.7" rx="4"/>
                    </g>
                    <g style={{ cursor: 'pointer' }}
                      onMouseEnter={e => showTip(e, { name: 'Washbasin', type: 'Sanitary', note: 'Pedestal basin.' })}
                      onMouseLeave={hideTip}>
                      <rect x={rx+P} y={ry+P} width={bsS} height={bsS}
                        fill="#e8f4f8" stroke="#4a7a9a" strokeWidth="0.7" rx="3"/>
                      <ellipse cx={rx+P+bsS/2} cy={ry+P+bsS/2} rx={bsS*0.3} ry={bsS*0.3}
                        fill="#d8ecf4" stroke="#4a7a9a" strokeWidth="0.5"/>
                    </g>
                  </g>
                );
              })}

              {/* Staircase */}
              {layout.staircase && (() => {
                const st = layout.staircase;
                const sx = px(st.x), sy = py(st.y);
                const sw = st.width * scale, sh = st.height * scale;
                const steps = 10, tH = sh / steps, bkY = sy + sh * 0.52;
                return (
                  <g style={{ cursor: 'pointer' }}
                    onMouseEnter={e => showTip(e, { name: 'Staircase', type: 'Circulation',
                      note: '10 risers, 900mm wide.' })}
                    onMouseLeave={hideTip}>
                    <rect x={sx} y={sy} width={sw} height={sh} fill="#f0e8d8" stroke="#666" strokeWidth="0.8"/>
                    {Array.from({ length: steps - 1 }).map((_, si) => {
                      const lineY = sy + (si + 1) * tH;
                      return (
                        <line key={si} x1={sx+2} y1={lineY} x2={sx+sw-2} y2={lineY}
                          stroke={lineY < bkY ? '#bbb' : '#777'}
                          strokeWidth={lineY < bkY ? 0.5 : 0.8}
                          strokeDasharray={lineY < bkY ? '2 1.5' : ''}/>
                      );
                    })}
                    <polyline fill="none" stroke="#94A3B8" strokeWidth="1" strokeLinecap="round"
                      points={[0,.22,.44,.66,.88,1].map((f,i) =>
                        `${sx + f*sw},${bkY + (i%2===0 ? -3 : 3)}`).join(' ')}/>
                    <line x1={sx+sw/2} y1={sy+sh-4} x2={sx+sw/2} y2={sy+10}
                      stroke="#333" strokeWidth="1.2" markerEnd={`url(#${AR})`}/>
                    <text x={sx+sw/2} y={sy+7} textAnchor="middle"
                      fontSize="6.5" fontWeight="bold" fill="#333" fontFamily="monospace">UP</text>
                  </g>
                );
              })()}
            </g>
          )}

          {/* ═══ LAYER 6 — Doors + Windows ═══════════════════════════════════ */}
          {layers.symbols && (
            <g>
              {/* Doors */}
              {doors.map((door, i) => {
                const dx = px(door.x), dy = py(door.y);
                const dw = Math.max(10, door.width * scale);
                const isMain = door.type === 'main';
                const isBath = door.type === 'bathroom';
                const col = isMain ? '#cc0000' : isBath ? '#226688' : '#555';
                const sw2 = isMain ? 1.6 : 1;
                const dir = door.direction || 'right';
                let leafX2 = dx + dw, leafY2 = dy;
                let arcD = `M ${dx+dw} ${dy} A ${dw} ${dw} 0 0 0 ${dx} ${dy+dw}`;
                if (dir === 'left') {
                  leafX2 = dx - dw;
                  arcD = `M ${dx-dw} ${dy} A ${dw} ${dw} 0 0 1 ${dx} ${dy+dw}`;
                } else if (dir === 'up') {
                  leafY2 = dy - dw;
                  arcD = `M ${dx} ${dy-dw} A ${dw} ${dw} 0 0 1 ${dx+dw} ${dy}`;
                } else if (dir === 'down') {
                  leafY2 = dy + dw;
                  arcD = `M ${dx} ${dy+dw} A ${dw} ${dw} 0 0 0 ${dx+dw} ${dy}`;
                }
                return (
                  <g key={`d${i}`}>
                    {/* Wall gap erasure */}
                    <rect x={dx} y={dy - WO / 2} width={dw} height={WO} fill="#f5f2ea"/>
                    {/* Hinge dot */}
                    <circle cx={dx} cy={dy} r={2} fill={col}/>
                    {/* Door leaf */}
                    <line x1={dx} y1={dy} x2={leafX2} y2={leafY2}
                      stroke={col} strokeWidth={sw2}/>
                    {/* Swing arc */}
                    <path d={arcD} fill={isMain ? 'rgba(204,0,0,0.05)' : 'none'}
                      stroke={col} strokeWidth={isMain ? 1 : 0.7}
                      strokeDasharray="3 2"/>
                    {/* ENTRY label — placed just above plot top, outside building */}
                    {isMain && (
                      <text x={dx + dw / 2} y={oy - 19}
                        textAnchor="middle" fontSize="7" fontWeight="600"
                        fill="#cc0000" fontFamily="monospace">
                        ↓ ENTRY
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Main gate fallback */}
              {doors.filter(d => d.type === 'main').length === 0 && (
                <g>
                  <rect x={bx1 + bW/2 - 18} y={by2} width={36} height={WO} fill="#f5f2ea"/>
                  <line x1={bx1+bW/2-18} y1={by2} x2={bx1+bW/2-18} y2={by2+WO}
                    stroke="#cc0000" strokeWidth="1.2"/>
                  <line x1={bx1+bW/2+18} y1={by2} x2={bx1+bW/2+18} y2={by2+WO}
                    stroke="#cc0000" strokeWidth="1.2"/>
                  <text x={bx1+bW/2} y={oy - 19} textAnchor="middle"
                    fontSize="7" fill="#cc0000" fontFamily="monospace">↓ ENTRY</text>
                </g>
              )}

              {/* Windows — gap in wall hatch + single blue line (clean, no clutter) */}
              {wins.map((win, i) => {
                const wall = win.wall || (win.orientation === 'vertical' ? 'left' : 'front');
                const isVert = wall === 'left' || wall === 'right';
                if (isVert) {
                  // Vertical wall — gap spans vertically along the wall
                  const wx = px(win.x), wy = py(win.y);
                  const wh = Math.max(8, win.width * scale); // opening height
                  return (
                    <g key={`w${i}`}>
                      <rect x={wx - WO/2} y={wy} width={WO} height={wh}
                        fill="#f5f2ea"/>
                      <line x1={wx} y1={wy} x2={wx} y2={wy + wh}
                        stroke="#5588aa" strokeWidth="1.5"/>
                    </g>
                  );
                } else {
                  // Horizontal wall — gap spans horizontally along the wall
                  const wx = px(win.x), wy = py(win.y);
                  const ww = Math.max(8, win.width * scale); // opening width
                  return (
                    <g key={`w${i}`}>
                      <rect x={wx} y={wy - WO/2} width={ww} height={WO}
                        fill="#f5f2ea"/>
                      <line x1={wx} y1={wy} x2={wx + ww} y2={wy}
                        stroke="#5588aa" strokeWidth="1.5"/>
                    </g>
                  );
                }
              })}
            </g>
          )}

          {/* ═══ LAYER 7 — Room labels (always on top of fills + walls) ══════ */}
          {layers.labels && (
            <g style={{ pointerEvents: 'none' }}>
              {rooms.map((room, i) => {
                const s  = rs(room.type);
                const rw = room.width * scale, rh = room.height * scale;
                if (rw < 20 || rh < 14) return null;
                const cx = px(room.x) + rw / 2;
                const cy = py(room.y) + rh / 2;
                const fz = rw < 50 ? 8 : 10;
                return (
                  <g key={`lbl${i}`}>
                    {/* White backing pill so text is readable over hatched walls */}
                    <rect x={cx - rw*0.38} y={cy - fz - 3}
                      width={rw * 0.76} height={rh > 28 ? fz * 2 + 10 : fz + 6}
                      fill="rgba(255,255,255,0.72)" rx="3"/>
                    <text x={cx} y={cy - (rh > 28 ? 3 : 0)}
                      textAnchor="middle" fontSize={fz}
                      fontWeight="600" fontFamily="sans-serif" fill={s.text}>
                      {s.label}
                    </text>
                    {rh > 28 && rw > 38 && (
                      <text x={cx} y={cy + fz + 3}
                        textAnchor="middle" fontSize="7" fill={s.text}
                        opacity="0.75" fontFamily="monospace">
                        {fmtFt(room.width)} × {fmtFt(room.height)}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          )}

          {/* ═══ LAYER 8 — Dimension lines (strictly outside outer wall) ═════ */}
          {layers.dims && (
            <g>
              {/* Overall width — top, above chain dims */}
              <line x1={ox} y1={oy - 40} x2={ox + plotPW} y2={oy - 40}
                stroke="#444" strokeWidth="0.8"
                markerStart={`url(#${ARR})`} markerEnd={`url(#${AR})`}/>
              <line x1={ox}          y1={oy - 46} x2={ox}          y2={oy - 34} stroke="#444" strokeWidth="0.5"/>
              <line x1={ox + plotPW} y1={oy - 46} x2={ox + plotPW} y2={oy - 34} stroke="#444" strokeWidth="0.5"/>
              <text x={ox + plotPW/2} y={oy - 43} textAnchor="middle"
                fontSize="8.5" fill="#333" fontFamily="monospace">{fmtDim(plot.width)}</text>

              {/* Chain dims top: left setback | buildable | right setback */}
              {[
                { s: 0,                     e: sb.left,                   lbl: `${fmtFt(sb.left)} SB` },
                { s: sb.left,               e: plot.width - sb.right,     lbl: fmtDim(plot.width - sb.left - sb.right) },
                { s: plot.width - sb.right, e: plot.width,                lbl: `${fmtFt(sb.right)} SB` },
              ].map((d, i) => d.s < d.e && (
                <g key={`cd${i}`}>
                  <line x1={px(d.s)} y1={oy - 26} x2={px(d.e)} y2={oy - 26}
                    stroke="#666" strokeWidth="0.6"
                    markerStart={`url(#${ARR})`} markerEnd={`url(#${AR})`}/>
                  <text x={(px(d.s)+px(d.e))/2} y={oy - 29} textAnchor="middle"
                    fontSize="7" fill="#555" fontFamily="monospace">{d.lbl}</text>
                </g>
              ))}

              {/* Overall height — right margin */}
              <line x1={ox + plotPW + 36} y1={oy} x2={ox + plotPW + 36} y2={oy + plotPH}
                stroke="#444" strokeWidth="0.8"
                markerStart={`url(#${ARR})`} markerEnd={`url(#${AR})`}/>
              <line x1={ox+plotPW+30} y1={oy}         x2={ox+plotPW+42} y2={oy}         stroke="#444" strokeWidth="0.5"/>
              <line x1={ox+plotPW+30} y1={oy+plotPH}  x2={ox+plotPW+42} y2={oy+plotPH}  stroke="#444" strokeWidth="0.5"/>
              <text x={ox + plotPW + 52} y={oy + plotPH/2} textAnchor="middle"
                fontSize="8.5" fill="#333" fontFamily="monospace"
                transform={`rotate(90,${ox+plotPW+52},${oy+plotPH/2})`}>{fmtDim(plot.length)}</text>
            </g>
          )}

          {/* ═══ North arrow — top-right corner, outside plan boundary ═══════ */}
          <g transform={`translate(${ox + plotPW + PAD_R * 0.72},${oy + 26})`}>
            <circle cx={0} cy={0} r={15} fill="white" stroke="#444" strokeWidth="1"/>
            <polygon points="0,-12 3,2.5 0,0 -3,2.5" fill="#1a1a1a"/>
            <polygon points="0,12 3,-2.5 0,0 -3,-2.5" fill="#ccc" stroke="#555" strokeWidth="0.4"/>
            <text x={0} y={-16} textAnchor="middle"
              fontSize="8.5" fontWeight="bold" fill="#1a1a1a" fontFamily="sans-serif">N</text>
          </g>

          {/* ═══ Scale bar ════════════════════════════════════════════════════ */}
          <g transform={`translate(${ox + plotPW - 100},${oy + plotPH + 16})`}>
            <rect x={0}  y={0} width={26} height={5} fill="#555"/>
            <rect x={26} y={0} width={26} height={5} fill="white" stroke="#555" strokeWidth="0.6"/>
            <rect x={52} y={0} width={26} height={5} fill="#555"/>
            <text x={0}  y={13} fontSize="6.5" fill="#444" fontFamily="monospace">0</text>
            <text x={24} y={13} fontSize="6.5" fill="#444" fontFamily="monospace">3m</text>
            <text x={50} y={13} fontSize="6.5" fill="#444" fontFamily="monospace">6m</text>
            <text x={76} y={13} fontSize="6.5" fill="#444" fontFamily="monospace">9m</text>
          </g>

          {/* ═══ Title block ══════════════════════════════════════════════════ */}
          <g>
            <rect x={ox} y={oy + plotPH + 32} width={plotPW} height={26}
              fill="white" stroke="#999" strokeWidth="0.7"/>
            <line x1={ox} y1={oy+plotPH+41} x2={ox+plotPW} y2={oy+plotPH+41}
              stroke="#ddd" strokeWidth="0.4"/>
            <text x={ox+8} y={oy+plotPH+39} fontSize="8.5" fontWeight="600" fill="#111" fontFamily="sans-serif">
              AUTOARCHITECT
            </text>
            <text x={ox+8} y={oy+plotPH+51} fontSize="7" fill="#555" fontFamily="monospace">
              {`${plot.width}ft × ${plot.length}ft  |  ${facing}-facing  |  Scale 1:100  |  GF-01`}
            </text>
            <text x={ox+plotPW-8} y={oy+plotPH+44} textAnchor="end"
              fontSize="7.5" fill="#666" fontFamily="monospace">GROUND FLOOR PLAN</text>
          </g>

        </svg>
        <Tooltip {...tip}/>
      </div>

      {/* ── Legend ────────────────────────────────────────────────────────────── */}
      <div style={{
        height: LEG_H, display: 'flex', flexWrap: 'wrap', alignItems: 'center',
        gap: '4px 12px', padding: '0 14px',
        background: '#fff', borderTop: '1px solid #e0dbd0', fontSize: 11,
      }}>
        {presentTypes.map(type => {
          const s = rs(type);
          return (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 11, height: 11, borderRadius: 2, flexShrink: 0,
                background: s.fill, border: `1.5px solid ${s.stroke}`,
              }}/>
              <span style={{ color: '#555', fontSize: 10.5 }}>{s.label}</span>
            </div>
          );
        })}
        <div style={{ marginLeft: 'auto', color: '#999', fontSize: 9.5, fontStyle: 'italic' }}>
          Hover over rooms for details
        </div>
      </div>
    </div>
  );
}
