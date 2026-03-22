import { useState, useRef, useId } from 'react';

// ─── Room palette (matches demo quality) ──────────────────────────────────────
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
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 5, color: '#a8d8ea' }}>
        {data.name}
      </div>
      {data.area && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: '#ccc' }}>
          <span>Area</span>
          <span style={{ color: '#fff', fontWeight: 500 }}>{data.area}</span>
        </div>
      )}
      {data.dim && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: '#ccc' }}>
          <span>Size</span>
          <span style={{ color: '#fff', fontWeight: 500 }}>{data.dim}</span>
        </div>
      )}
      {data.type && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: '#ccc' }}>
          <span>Type</span>
          <span style={{ color: '#fff', fontWeight: 500 }}>{data.type}</span>
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

// ─── Main SVG floor plan component ────────────────────────────────────────────
export default function SVGFloorPlan({ layout, width, height }) {
  const uid = useId().replace(/:/g, '');
  const [tip, setTip]       = useState({ visible: false, x: 0, y: 0, data: null });
  const [layers, setLayers] = useState({ walls: true, dims: true, symbols: true, labels: true });
  const wrapRef = useRef(null);

  const toggleLayer = (k) => setLayers(l => ({ ...l, [k]: !l[k] }));

  const showTip = (e, data) => {
    if (!wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    let x = e.clientX - r.left + 14;
    let y = e.clientY - r.top  - 12;
    if (x + 240 > r.width) x -= 258;
    if (y < 0) y = 4;
    setTip({ visible: true, x, y, data });
  };

  const moveTip = (e) => {
    if (!tip.visible || !wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    let x = e.clientX - r.left + 14;
    let y = e.clientY - r.top  - 12;
    if (x + 240 > r.width) x -= 258;
    if (y < 0) y = 4;
    setTip(t => ({ ...t, x, y }));
  };

  const hideTip = () => setTip(t => ({ ...t, visible: false }));

  if (!layout?.plot) return null;

  const plot  = layout.plot;
  const sb    = plot.setback || { front: 6, back: 4, left: 4, right: 4 };
  const rooms = layout.rooms   || [];
  const doors = layout.doors   || [];
  const wins  = layout.windows || [];

  // ── Coordinate system ──────────────────────────────────────────────────────
  const TOOL_H   = 38; // toolbar height
  const LEG_H    = 52; // legend height
  const SVG_H    = height - TOOL_H - LEG_H;
  const PAD      = 80;
  const drawW    = width  - PAD * 2;
  const drawH    = SVG_H  - PAD * 2;
  const scale    = Math.min(drawW / plot.width, drawH / plot.length);
  const plotPW   = plot.width  * scale;
  const plotPH   = plot.length * scale;
  const ox       = PAD + (drawW - plotPW) / 2;
  const oy       = PAD + (drawH - plotPH) / 2;
  const px       = v => ox + v * scale;   // plot-space x → screen x
  const py       = v => oy + v * scale;   // plot-space y → screen y

  // Buildable area pixel corners
  const bx1 = px(sb.left);
  const by1 = py(sb.back);
  const bx2 = px(plot.width  - sb.right);
  const by2 = py(plot.length - sb.front);
  const bW  = bx2 - bx1;
  const bH  = by2 - by1;

  // Wall thickness in pixels
  const WO = Math.max(6, scale * 0.32);   // outer wall
  const WI = Math.max(4, scale * 0.20);   // inner wall

  const facing = (plot.facing || 'north').toUpperCase();

  // Interior + exterior walls from layout data
  const intWalls = (layout.walls || []).filter(w => w.type === 'interior');

  // ── Hatch wall rect helper ──────────────────────────────────────────────────
  function wallRect(x1s, y1s, x2s, y2s, thick, patId) {
    const horiz = Math.abs(y2s - y1s) < 2;
    return horiz
      ? { x: Math.min(x1s, x2s), y: y1s - thick / 2, w: Math.abs(x2s - x1s), h: thick }
      : { x: x1s - thick / 2, y: Math.min(y1s, y2s), w: thick, h: Math.abs(y2s - y1s) };
  }

  // Unique IDs for SVG defs
  const H1 = `h1-${uid}`, H2 = `h2-${uid}`, GR = `gr-${uid}`;
  const AR = `ar-${uid}`,  ARR = `arr-${uid}`;

  // Unique types present in rooms for legend
  const presentTypes = [...new Set(rooms.map(r => r.type))];

  return (
    <div style={{ fontFamily: "'Inter','Segoe UI',Arial,sans-serif", lineHeight: 1 }}>

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div style={{
        height: TOOL_H, background: '#fff', borderBottom: '1px solid #e0dbd0',
        display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10,
        fontSize: 12, color: '#555',
      }}>
        <span style={{ fontWeight: 600, color: '#222', fontSize: 13 }}>Floor Plan — Ground Floor</span>
        <div style={{ flex: 1 }} />
        {[
          { k: 'walls',   label: 'Walls' },
          { k: 'dims',    label: 'Dimensions' },
          { k: 'symbols', label: 'Symbols' },
          { k: 'labels',  label: 'Labels' },
        ].map(({ k, label }) => (
          <button key={k} onClick={() => toggleLayer(k)} style={{
            padding: '3px 10px', border: '1px solid #ccc', borderRadius: 4,
            background: layers[k] ? '#2a5298' : '#fff',
            color: layers[k] ? '#fff' : '#444',
            fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {label}
          </button>
        ))}
        <div style={{ marginLeft: 6, paddingLeft: 8, borderLeft: '1px solid #ddd', color: '#888', fontSize: 10 }}>
          Scale 1:100
        </div>
      </div>

      {/* ── SVG canvas ──────────────────────────────────────────────────────── */}
      <div ref={wrapRef} style={{ position: 'relative', lineHeight: 0 }} onMouseMove={moveTip} onMouseLeave={hideTip}>
        <svg width={width} height={SVG_H} viewBox={`0 0 ${width} ${SVG_H}`} style={{ display: 'block' }}>
          <defs>
            {/* 45° hatch — outer walls */}
            <pattern id={H1} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="#777" strokeWidth="0.8"/>
            </pattern>
            {/* Finer hatch — inner walls */}
            <pattern id={H2} patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="4" stroke="#999" strokeWidth="0.55"/>
            </pattern>
            {/* Background grid */}
            <pattern id={GR} patternUnits="userSpaceOnUse" width="20" height="20">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e8e4da" strokeWidth="0.4"/>
            </pattern>
            {/* Dimension arrowheads */}
            <marker id={AR} viewBox="0 0 8 8" refX="4" refY="4" markerWidth="4" markerHeight="4" orient="auto">
              <path d="M0 0L8 4L0 8Z" fill="#444"/>
            </marker>
            <marker id={ARR} viewBox="0 0 8 8" refX="4" refY="4" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
              <path d="M0 0L8 4L0 8Z" fill="#444"/>
            </marker>
          </defs>

          {/* ── Drafting-paper background ─────────────────────────────────── */}
          <rect width={width} height={SVG_H} fill="#f5f2ea"/>
          <rect x={ox} y={oy} width={plotPW} height={plotPH} fill={`url(#${GR})`}/>

          {/* ── Plot boundary + setback labels ────────────────────────────── */}
          <rect x={ox} y={oy} width={plotPW} height={plotPH}
            fill="none" stroke="#b8a87a" strokeWidth="1" strokeDasharray="6 4"/>
          <text x={ox + plotPW / 2} y={oy + 11} textAnchor="middle" fontSize="8.5" fill="#9a8a60" fontFamily="monospace">
            FRONT SETBACK — {sb.back}ft
          </text>
          <text x={ox + plotPW / 2} y={oy + plotPH - 4} textAnchor="middle" fontSize="8.5" fill="#9a8a60" fontFamily="monospace">
            REAR SETBACK — {sb.front}ft
          </text>
          <text x={ox + 8} y={oy + plotPH / 2} fontSize="8" fill="#9a8a60" fontFamily="monospace"
            transform={`rotate(-90,${ox + 8},${oy + plotPH / 2})`}>
            SIDE {sb.left}ft
          </text>
          <text x={ox + plotPW - 6} y={oy + plotPH / 2} fontSize="8" fill="#9a8a60" fontFamily="monospace"
            transform={`rotate(90,${ox + plotPW - 6},${oy + plotPH / 2})`}>
            SIDE {sb.right}ft
          </text>

          {/* ── Road banner ───────────────────────────────────────────────── */}
          <rect x={ox} y={oy - 14} width={plotPW} height={12} fill="#E2E8F0" rx="2"/>
          <text x={ox + plotPW / 2} y={oy - 5} textAnchor="middle" fontSize="8" fontWeight="600" fontFamily="monospace" fill="#475569">
            ▼  ROAD  ({facing} FACING)  ▼
          </text>

          {/* ── Room fills ────────────────────────────────────────────────── */}
          {rooms.map((room, i) => {
            const s  = rs(room.type);
            const rx = px(room.x), ry = py(room.y);
            const rw = room.width * scale, rh = room.height * scale;
            return (
              <rect key={`rf${i}`} x={rx} y={ry} width={rw} height={rh}
                fill={s.fill} opacity="0.88"
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

          {/* ── WALLS ─────────────────────────────────────────────────────── */}
          {layers.walls && (
            <g>
              {/* Outer wall hatch bands */}
              {/* Top */}
              <rect x={bx1 - WO} y={by1 - WO} width={bW + WO * 2} height={WO}
                fill={`url(#${H1})`} stroke="#2a2a2a" strokeWidth="0.7"/>
              {/* Bottom */}
              <rect x={bx1 - WO} y={by2} width={bW + WO * 2} height={WO}
                fill={`url(#${H1})`} stroke="#2a2a2a" strokeWidth="0.7"/>
              {/* Left */}
              <rect x={bx1 - WO} y={by1} width={WO} height={bH}
                fill={`url(#${H1})`} stroke="#2a2a2a" strokeWidth="0.7"/>
              {/* Right */}
              <rect x={bx2} y={by1} width={WO} height={bH}
                fill={`url(#${H1})`} stroke="#2a2a2a" strokeWidth="0.7"/>

              {/* Outer boundary stroke */}
              <rect x={bx1} y={by1} width={bW} height={bH}
                fill="none" stroke="#1a1a1a" strokeWidth="1.8"/>

              {/* Interior walls */}
              {intWalls.map((w, i) => {
                const x1s = px(w.x1), y1s = py(w.y1);
                const x2s = px(w.x2), y2s = py(w.y2);
                const wr  = wallRect(x1s, y1s, x2s, y2s, WI);
                return (
                  <rect key={`iw${i}`}
                    x={wr.x} y={wr.y} width={wr.w} height={wr.h}
                    fill={`url(#${H2})`} stroke="#555" strokeWidth="0.6"/>
                );
              })}
            </g>
          )}

          {/* ── SYMBOLS ───────────────────────────────────────────────────── */}
          {layers.symbols && (
            <g>

              {/* Doors */}
              {doors.map((door, i) => {
                const dx     = px(door.x), dy = py(door.y);
                const dw     = Math.max(12, door.width * scale);
                const isMain = door.type === 'main';
                const isBath = door.type === 'bathroom';
                const col    = isMain ? '#cc0000' : isBath ? '#226688' : '#444';
                const sw2    = isMain ? 2 : 1.2;
                // Determine swing direction from door.direction or default to right+down
                const dir    = door.direction || 'right';
                let leafX2 = dx + dw, leafY2 = dy;
                let arcD = `M ${dx + dw} ${dy} A ${dw} ${dw} 0 0 0 ${dx} ${dy + dw}`;
                if (dir === 'left') {
                  leafX2 = dx - dw; leafY2 = dy;
                  arcD = `M ${dx - dw} ${dy} A ${dw} ${dw} 0 0 1 ${dx} ${dy + dw}`;
                } else if (dir === 'up') {
                  leafX2 = dx; leafY2 = dy - dw;
                  arcD = `M ${dx} ${dy - dw} A ${dw} ${dw} 0 0 1 ${dx + dw} ${dy}`;
                } else if (dir === 'down') {
                  leafX2 = dx; leafY2 = dy + dw;
                  arcD = `M ${dx} ${dy + dw} A ${dw} ${dw} 0 0 0 ${dx + dw} ${dy}`;
                }
                return (
                  <g key={`d${i}`}>
                    {/* Wall gap (white erasure) */}
                    <rect x={dx} y={dy - WO / 2} width={dw} height={WO} fill="#f5f2ea"/>
                    {/* Hinge dot */}
                    <circle cx={dx} cy={dy} r={2.5} fill={col}/>
                    {/* Door leaf */}
                    <line x1={dx} y1={dy} x2={leafX2} y2={leafY2}
                      stroke={col} strokeWidth={sw2}/>
                    {/* Swing arc (dashed quarter-circle) */}
                    <path d={arcD}
                      fill={isMain ? 'rgba(204,0,0,0.06)' : 'none'}
                      stroke={col} strokeWidth={isMain ? 1.2 : 0.75}
                      strokeDasharray="3 2"/>
                    {/* Entry label */}
                    {isMain && (
                      <text x={dx + dw / 2} y={dy - 10} textAnchor="middle"
                        fontSize="8" fontWeight="bold" fill="#cc0000" fontFamily="monospace">
                        ▼ ENTRY / MAIN GATE
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Windows — architectural triple-line symbol */}
              {wins.map((win, i) => {
                const wx = px(win.x), wy = py(win.y);
                const ww = Math.max(6, win.width  * scale);
                const wh = Math.max(6, win.height * scale);
                const h  = ww >= wh; // horizontal opening?
                return (
                  <g key={`w${i}`}>
                    <rect x={wx} y={wy} width={ww} height={wh} fill="#fff" stroke="none"/>
                    {h ? (<>
                      <line x1={wx}    y1={wy}       x2={wx+ww} y2={wy}       stroke="#222" strokeWidth="1.6"/>
                      <line x1={wx}    y1={wy+wh*.35} x2={wx+ww} y2={wy+wh*.35} stroke="#5588aa" strokeWidth="1"/>
                      <line x1={wx}    y1={wy+wh*.65} x2={wx+ww} y2={wy+wh*.65} stroke="#5588aa" strokeWidth="1"/>
                      <line x1={wx}    y1={wy+wh}    x2={wx+ww} y2={wy+wh}    stroke="#222" strokeWidth="1.6"/>
                      <line x1={wx}    y1={wy}       x2={wx}    y2={wy+wh}    stroke="#222" strokeWidth="1.2"/>
                      <line x1={wx+ww} y1={wy}       x2={wx+ww} y2={wy+wh}    stroke="#222" strokeWidth="1.2"/>
                    </>) : (<>
                      <line x1={wx}       y1={wy} x2={wx}       y2={wy+wh} stroke="#222" strokeWidth="1.6"/>
                      <line x1={wx+ww*.35} y1={wy} x2={wx+ww*.35} y2={wy+wh} stroke="#5588aa" strokeWidth="1"/>
                      <line x1={wx+ww*.65} y1={wy} x2={wx+ww*.65} y2={wy+wh} stroke="#5588aa" strokeWidth="1"/>
                      <line x1={wx+ww}    y1={wy} x2={wx+ww}    y2={wy+wh} stroke="#222" strokeWidth="1.6"/>
                      <line x1={wx} y1={wy}    x2={wx+ww} y2={wy}    stroke="#222" strokeWidth="1.2"/>
                      <line x1={wx} y1={wy+wh} x2={wx+ww} y2={wy+wh} stroke="#222" strokeWidth="1.2"/>
                    </>)}
                  </g>
                );
              })}

              {/* Kitchen platform + double sink */}
              {rooms.filter(r => r.type === 'kitchen').map((room, i) => {
                const rx = px(room.x), ry = py(room.y);
                const rw = room.width * scale, rh = room.height * scale;
                if (rw < 20 || rh < 20) return null;
                const cD = Math.min(14, rh * 0.22); // counter depth px
                return (
                  <g key={`kp${i}`} style={{ cursor: 'pointer' }}
                    onMouseEnter={e => showTip(e, { name: 'Kitchen Platform', type: 'Fixture', note: 'Granite top, 600mm deep. L-shape with double sink.' })}
                    onMouseLeave={hideTip}>
                    {/* Back counter */}
                    <rect x={rx + 2} y={ry + rh - cD - 2} width={rw - 4} height={cD}
                      fill="#c8b89a" stroke="#8a7a60" strokeWidth="0.8" rx="1"/>
                    {/* Side counter */}
                    <rect x={rx + rw - cD - 2} y={ry + 2} width={cD} height={rh - cD - 4}
                      fill="#c8b89a" stroke="#8a7a60" strokeWidth="0.8" rx="1"/>
                    {/* Sink 1 */}
                    <rect x={rx + 4} y={ry + rh - cD} width={cD - 3} height={cD - 3}
                      fill="#e8ddd0" stroke="#666" strokeWidth="0.6" rx="1"/>
                    <circle cx={rx + 4 + (cD - 3) / 2} cy={ry + rh - cD + (cD - 3) / 2}
                      r={2.2} fill="none" stroke="#888" strokeWidth="0.6"/>
                    {/* Sink 2 */}
                    {rw > 40 && (
                      <>
                        <rect x={rx + 4 + cD} y={ry + rh - cD} width={cD - 3} height={cD - 3}
                          fill="#e8ddd0" stroke="#666" strokeWidth="0.6" rx="1"/>
                        <circle cx={rx + 4 + cD + (cD - 3) / 2} cy={ry + rh - cD + (cD - 3) / 2}
                          r={2.2} fill="none" stroke="#888" strokeWidth="0.6"/>
                      </>
                    )}
                    <text x={rx + rw / 2} y={ry + rh - cD / 2 + 3} textAnchor="middle"
                      fontSize="7" fill="#6a4a20" fontFamily="monospace">Platform</text>
                  </g>
                );
              })}

              {/* Staircase */}
              {layout.staircase && (() => {
                const st = layout.staircase;
                const sx = px(st.x), sy = py(st.y);
                const sw2 = st.width * scale, sh2 = st.height * scale;
                const steps = 10;
                const tH    = sh2 / steps;
                const bkY   = sy + sh2 * 0.52; // break line y
                return (
                  <g style={{ cursor: 'pointer' }}
                    onMouseEnter={e => showTip(e, { name: 'Staircase', type: 'Circulation', note: '10 risers, 900mm wide. Leads to upper floor.' })}
                    onMouseLeave={hideTip}>
                    <rect x={sx} y={sy} width={sw2} height={sh2}
                      fill="#f0e8d8" stroke="#555" strokeWidth="1"/>
                    {/* Treads */}
                    {Array.from({ length: steps - 1 }).map((_, si) => {
                      const lineY = sy + (si + 1) * tH;
                      const above = lineY < bkY;
                      return (
                        <line key={si} x1={sx + 2} y1={lineY} x2={sx + sw2 - 2} y2={lineY}
                          stroke={above ? '#aaa' : '#666'}
                          strokeWidth={above ? 0.55 : 0.85}
                          strokeDasharray={above ? '2 1.5' : ''}/>
                      );
                    })}
                    {/* Zigzag break line */}
                    <polyline fill="none" stroke="#94A3B8" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
                      points={[
                        `${sx},${bkY - 3}`,
                        `${sx + sw2 * 0.22},${bkY + 3}`,
                        `${sx + sw2 * 0.44},${bkY - 3}`,
                        `${sx + sw2 * 0.66},${bkY + 3}`,
                        `${sx + sw2 * 0.88},${bkY - 3}`,
                        `${sx + sw2},${bkY + 3}`,
                      ].join(' ')}/>
                    {/* UP arrow */}
                    <line x1={sx + sw2 / 2} y1={sy + sh2 - 6} x2={sx + sw2 / 2} y2={sy + 12}
                      stroke="#333" strokeWidth="1.3" markerEnd={`url(#${AR})`}/>
                    <text x={sx + sw2 / 2} y={sy + 8} textAnchor="middle"
                      fontSize="7" fontWeight="bold" fill="#333" fontFamily="monospace">UP</text>
                  </g>
                );
              })()}

              {/* Bathroom fixtures — WC + washbasin */}
              {rooms.filter(r => r.type === 'bathroom').map((room, i) => {
                const rx = px(room.x), ry = py(room.y);
                const rw = room.width * scale, rh = room.height * scale;
                if (rw < 20 || rh < 22) return null;
                const P    = 3;
                const wcW  = Math.min(rw * 0.52, 24);
                const wcH  = Math.min(rh * 0.38, 30);
                const bsS  = Math.min(rw * 0.46, 18);
                return (
                  <g key={`bf${i}`}>
                    {/* WC cistern + bowl */}
                    <g style={{ cursor: 'pointer' }}
                      onMouseEnter={e => showTip(e, { name: 'Water Closet (WC)', type: 'Sanitary', note: 'Wall-hung WC, 600mm from floor. Cistern above.' })}
                      onMouseLeave={hideTip}>
                      {/* Cistern */}
                      <rect x={rx + P} y={ry + rh - P - wcH}
                        width={wcW} height={wcH * 0.26}
                        fill="#e8f4f8" stroke="#4a7a9a" strokeWidth="0.8" rx="1"/>
                      {/* Bowl */}
                      <rect x={rx + P + wcW * 0.05} y={ry + rh - P - wcH + wcH * 0.26}
                        width={wcW * 0.9} height={wcH * 0.74}
                        fill="#d8ecf4" stroke="#4a7a9a" strokeWidth="0.8" rx="5"/>
                      {/* Inner oval */}
                      <ellipse
                        cx={rx + P + wcW * 0.5}
                        cy={ry + rh - P - wcH + wcH * 0.26 + wcH * 0.74 * 0.62}
                        rx={wcW * 0.33} ry={wcH * 0.22}
                        fill="#c8e4f0" stroke="#4a7a9a" strokeWidth="0.5"/>
                    </g>
                    {/* Washbasin */}
                    <g style={{ cursor: 'pointer' }}
                      onMouseEnter={e => showTip(e, { name: 'Washbasin', type: 'Sanitary', note: 'Pedestal basin, 450×350mm.' })}
                      onMouseLeave={hideTip}>
                      <rect x={rx + P} y={ry + P} width={bsS} height={bsS}
                        fill="#e8f4f8" stroke="#4a7a9a" strokeWidth="0.8" rx="3"/>
                      <ellipse cx={rx + P + bsS / 2} cy={ry + P + bsS / 2}
                        rx={bsS * 0.32} ry={bsS * 0.32}
                        fill="#d8ecf4" stroke="#4a7a9a" strokeWidth="0.5"/>
                    </g>
                  </g>
                );
              })}

              {/* Main gate symbol */}
              {doors.filter(d => d.type === 'main').length === 0 && (
                <g>
                  <rect x={bx1 + bW / 2 - 20} y={by2} width={40} height={WO}
                    fill="#f5f2ea"/>
                  <line x1={bx1 + bW / 2 - 20} y1={by2} x2={bx1 + bW / 2 - 20} y2={by2 + WO}
                    stroke="#cc0000" strokeWidth="1.5"/>
                  <line x1={bx1 + bW / 2 + 20} y1={by2} x2={bx1 + bW / 2 + 20} y2={by2 + WO}
                    stroke="#cc0000" strokeWidth="1.5"/>
                  <line x1={bx1 + bW / 2 - 20} y1={by2 + WO / 2} x2={bx1 + bW / 2 + 20} y2={by2 + WO / 2}
                    stroke="#cc0000" strokeWidth="1.2" strokeDasharray="4 2"/>
                  <text x={bx1 + bW / 2} y={by2 + WO + 10} textAnchor="middle"
                    fontSize="8" fill="#cc0000" fontFamily="monospace">MAIN GATE</text>
                </g>
              )}

              {/* Parking — top-down car silhouette */}
              {layout.parking && (() => {
                const p   = layout.parking;
                const ppx2 = px(p.x), ppy2 = py(p.y);
                const pw2 = p.width * scale, ph2 = Math.max(20, p.height * scale);
                const cars = p.cars || 1;
                const bayW = pw2 / cars;
                return (
                  <g style={{ cursor: 'pointer' }}
                    onMouseEnter={e => showTip(e, {
                      name: 'Parking Bay', type: 'Parking',
                      note: `${cars} car space${cars > 1 ? 's' : ''}, 2.5×5m each.`,
                    })}
                    onMouseLeave={hideTip}>
                    <rect x={ppx2} y={ppy2} width={pw2} height={ph2}
                      fill="#d8d0c0" stroke="#888" strokeWidth="0.8" rx="2"/>
                    {Array.from({ length: cars }).map((_, ci) => {
                      const bx2 = ppx2 + ci * bayW;
                      const cw  = bayW - 4, ch = ph2 - 4;
                      const cx2 = bx2 + 2, cy2 = ppy2 + 2;
                      const ww2 = cw * 0.16, wh2 = ch * 0.15;
                      return (
                        <g key={ci}>
                          {ci > 0 && <line x1={bx2} y1={ppy2} x2={bx2} y2={ppy2 + ph2} stroke="#999" strokeWidth="0.7"/>}
                          {/* Diagonal cross */}
                          <line x1={cx2} y1={cy2} x2={cx2 + cw} y2={cy2 + ch} stroke="#bbb" strokeWidth="0.6"/>
                          {/* Car body */}
                          <rect x={cx2 + cw * 0.1} y={cy2 + ch * 0.06}
                            width={cw * 0.8} height={ch * 0.88}
                            fill="#f0ece4" stroke="#666" strokeWidth="0.8" rx="2"/>
                          {/* Windscreen */}
                          <line x1={cx2 + cw * 0.18} y1={cy2 + ch * 0.22} x2={cx2 + cw * 0.82} y2={cy2 + ch * 0.22}
                            stroke="#999" strokeWidth="0.8"/>
                          {/* Rear window */}
                          <line x1={cx2 + cw * 0.18} y1={cy2 + ch * 0.78} x2={cx2 + cw * 0.82} y2={cy2 + ch * 0.78}
                            stroke="#999" strokeWidth="0.8"/>
                          {/* 4 wheels */}
                          <rect x={cx2 + cw * 0.04}  y={cy2 + ch * 0.1}  width={ww2} height={wh2} fill="#555" rx="1"/>
                          <rect x={cx2 + cw * 0.04}  y={cy2 + ch * 0.75} width={ww2} height={wh2} fill="#555" rx="1"/>
                          <rect x={cx2 + cw * 0.80}  y={cy2 + ch * 0.1}  width={ww2} height={wh2} fill="#555" rx="1"/>
                          <rect x={cx2 + cw * 0.80}  y={cy2 + ch * 0.75} width={ww2} height={wh2} fill="#555" rx="1"/>
                          {/* P badge */}
                          <text x={cx2 + cw / 2} y={cy2 + ch * 0.55} textAnchor="middle"
                            fontSize={Math.max(8, Math.min(13, cw * 0.32))}
                            fontWeight="bold" fill="#444" fontFamily="sans-serif">P</text>
                        </g>
                      );
                    })}
                  </g>
                );
              })()}

            </g>
          )}

          {/* ── LABELS ────────────────────────────────────────────────────── */}
          {layers.labels && (
            <g>
              {rooms.map((room, i) => {
                const s   = rs(room.type);
                const rx  = px(room.x), ry = py(room.y);
                const rw  = room.width * scale, rh = room.height * scale;
                if (rw < 22 || rh < 16) return null;
                const cx  = rx + rw / 2, cy = ry + rh / 2;
                const fz  = rw < 55 ? 8 : 10;
                return (
                  <g key={`lbl${i}`} style={{ pointerEvents: 'none' }}>
                    <text x={cx} y={cy - (rh > 32 ? 4 : 0)} textAnchor="middle"
                      fontSize={fz} fontWeight="600" fontFamily="sans-serif" fill={s.text}>
                      {s.label}
                    </text>
                    {rh > 30 && rw > 40 && (
                      <text x={cx} y={cy + fz + 2} textAnchor="middle"
                        fontSize="7.5" fill={s.text} opacity="0.72" fontFamily="monospace">
                        {fmtFt(room.width)} × {fmtFt(room.height)}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          )}

          {/* ── DIMENSIONS ────────────────────────────────────────────────── */}
          {layers.dims && (
            <g>
              {/* Overall width (top) */}
              <line x1={ox} y1={oy - 28} x2={ox + plotPW} y2={oy - 28}
                stroke="#444" strokeWidth="0.8"
                markerStart={`url(#${ARR})`} markerEnd={`url(#${AR})`}/>
              <line x1={ox}          y1={oy - 34} x2={ox}          y2={oy - 22} stroke="#444" strokeWidth="0.6"/>
              <line x1={ox + plotPW} y1={oy - 34} x2={ox + plotPW} y2={oy - 22} stroke="#444" strokeWidth="0.6"/>
              <text x={ox + plotPW / 2} y={oy - 32} textAnchor="middle"
                fontSize="9" fill="#333" fontFamily="monospace">{fmtDim(plot.width)}</text>

              {/* Overall height (right) */}
              <line x1={ox + plotPW + 28} y1={oy} x2={ox + plotPW + 28} y2={oy + plotPH}
                stroke="#444" strokeWidth="0.8"
                markerStart={`url(#${ARR})`} markerEnd={`url(#${AR})`}/>
              <line x1={ox + plotPW + 22} y1={oy}          x2={ox + plotPW + 34} y2={oy}          stroke="#444" strokeWidth="0.6"/>
              <line x1={ox + plotPW + 22} y1={oy + plotPH} x2={ox + plotPW + 34} y2={oy + plotPH} stroke="#444" strokeWidth="0.6"/>
              <text x={ox + plotPW + 46} y={oy + plotPH / 2} textAnchor="middle"
                fontSize="9" fill="#333" fontFamily="monospace"
                transform={`rotate(90,${ox + plotPW + 46},${oy + plotPH / 2})`}>
                {fmtDim(plot.length)}
              </text>

              {/* Chain dims top: left setback | buildable | right setback */}
              {[
                { s: 0,                        e: sb.left,                       lbl: `${fmtFt(sb.left)} setback` },
                { s: sb.left,                  e: plot.width - sb.right,         lbl: fmtDim(plot.width - sb.left - sb.right) },
                { s: plot.width - sb.right,    e: plot.width,                    lbl: `${fmtFt(sb.right)} setback` },
              ].map((d, i) => d.s < d.e && (
                <g key={`cd${i}`}>
                  <line x1={px(d.s)} y1={oy - 16} x2={px(d.e)} y2={oy - 16}
                    stroke="#666" strokeWidth="0.6"
                    markerStart={`url(#${ARR})`} markerEnd={`url(#${AR})`}/>
                  <text x={(px(d.s) + px(d.e)) / 2} y={oy - 19} textAnchor="middle"
                    fontSize="7.5" fill="#555" fontFamily="monospace">{d.lbl}</text>
                </g>
              ))}
            </g>
          )}

          {/* ── North arrow ───────────────────────────────────────────────── */}
          <g transform={`translate(${ox + plotPW - 30},${oy + 22})`}>
            <circle cx={0} cy={0} r={16} fill="white" stroke="#444" strokeWidth="1.2"/>
            <polygon points="0,-13 3.5,3 0,0.5 -3.5,3" fill="#1a1a1a"/>
            <polygon points="0,13 3.5,-3 0,-0.5 -3.5,-3" fill="#ccc" stroke="#555" strokeWidth="0.5"/>
            <text x={0} y={-17} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#1a1a1a" fontFamily="sans-serif">N</text>
          </g>

          {/* ── Scale bar ─────────────────────────────────────────────────── */}
          <g transform={`translate(${ox + plotPW - 105},${oy + plotPH + 14})`}>
            <rect x={0}  y={0} width={28} height={5} fill="#444"/>
            <rect x={28} y={0} width={28} height={5} fill="white" stroke="#444" strokeWidth="0.7"/>
            <rect x={56} y={0} width={28} height={5} fill="#444"/>
            <text x={0}  y={13} fontSize="7" fill="#444" fontFamily="monospace">0</text>
            <text x={26} y={13} fontSize="7" fill="#444" fontFamily="monospace">3m</text>
            <text x={54} y={13} fontSize="7" fill="#444" fontFamily="monospace">6m</text>
            <text x={82} y={13} fontSize="7" fill="#444" fontFamily="monospace">9m</text>
          </g>

          {/* ── Title block ───────────────────────────────────────────────── */}
          <g>
            <rect x={ox} y={oy + plotPH + 30} width={plotPW} height={28}
              fill="white" stroke="#888" strokeWidth="0.8"/>
            <line x1={ox} y1={oy + plotPH + 40} x2={ox + plotPW} y2={oy + plotPH + 40}
              stroke="#ccc" strokeWidth="0.5"/>
            <text x={ox + 8} y={oy + plotPH + 39} fontSize="9" fontWeight="600" fill="#111" fontFamily="sans-serif">
              AUTOARCHITECT
            </text>
            <text x={ox + 8} y={oy + plotPH + 51} fontSize="7.5" fill="#555" fontFamily="monospace">
              {`${plot.width}ft × ${plot.length}ft, ${facing}-facing  |  Scale 1:100  |  Sheet GF-01`}
            </text>
            <text x={ox + plotPW - 8} y={oy + plotPH + 45} textAnchor="end"
              fontSize="8" fill="#666" fontFamily="monospace">GROUND FLOOR PLAN</text>
          </g>

        </svg>

        {/* HTML tooltip */}
        <Tooltip {...tip}/>
      </div>

      {/* ── Legend ──────────────────────────────────────────────────────────── */}
      <div style={{
        height: LEG_H, display: 'flex', flexWrap: 'wrap', alignItems: 'center',
        gap: '6px 14px', padding: '0 14px',
        background: '#fff', borderTop: '1px solid #e0dbd0', fontSize: 11,
      }}>
        {presentTypes.map(type => {
          const s = rs(type);
          return (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 12, height: 12, borderRadius: 2,
                background: s.fill, border: `1.5px solid ${s.stroke}`, flexShrink: 0,
              }}/>
              <span style={{ color: '#555' }}>{s.label}</span>
            </div>
          );
        })}
        <div style={{ marginLeft: 'auto', color: '#888', fontSize: 10, fontStyle: 'italic' }}>
          Hover over rooms & elements for details
        </div>
      </div>
    </div>
  );
}
