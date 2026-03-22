import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Stage, Layer, Rect, Text, Group, Line, Arc, Circle } from 'react-konva';
import toast from 'react-hot-toast';
import api from '../services/api';
import ThreeDViewer from '../components/ThreeDViewer';
import ProfessionalFloorPlan from '../components/ProfessionalFloorPlan';

// ─── Room palette ─────────────────────────────────────────────────────────────
const ROOM_STYLE = {
  living_room:    { fill: '#DBEAFE', stroke: '#2563EB', text: '#1D4ED8' },
  master_bedroom: { fill: '#FCE7F3', stroke: '#DB2777', text: '#9D174D' },
  bedroom:        { fill: '#EDE9FE', stroke: '#7C3AED', text: '#5B21B6' },
  kitchen:        { fill: '#D1FAE5', stroke: '#059669', text: '#064E3B' },
  dining:         { fill: '#FEF3C7', stroke: '#D97706', text: '#78350F' },
  bathroom:       { fill: '#CFFAFE', stroke: '#0891B2', text: '#155E75' },
  study:          { fill: '#F3F4F6', stroke: '#6B7280', text: '#1F2937' },
  balcony:        { fill: '#ECFDF5', stroke: '#10B981', text: '#064E3B' },
  terrace:        { fill: '#F0FDF4', stroke: '#16A34A', text: '#14532D' },
  guest_room:     { fill: '#FFF7ED', stroke: '#EA580C', text: '#7C2D12' },
  default:        { fill: '#F9FAFB', stroke: '#9CA3AF', text: '#374151' },
};

// Short label that fits in small rooms
const SHORT_LABEL = {
  living_room:    'Living Room',
  master_bedroom: 'Master Bed',
  bedroom:        'Bedroom',
  kitchen:        'Kitchen',
  dining:         'Dining',
  bathroom:       'Bathroom',
  study:          'Study',
  balcony:        'Balcony',
  terrace:        'Terrace',
  guest_room:     'Guest Room',
};

const TINY_LABEL = {
  living_room:    'LIV',
  master_bedroom: 'M.BED',
  bedroom:        'BED',
  kitchen:        'KIT',
  dining:         'DIN',
  bathroom:       'BATH',
  study:          'STD',
  balcony:        'BAL',
  terrace:        'TER',
  guest_room:     'GUEST',
};

function roomStyle(type) { return ROOM_STYLE[type] || ROOM_STYLE.default; }
function shortLabel(type) { return SHORT_LABEL[type] || type; }
function tinyLabel(type)  { return TINY_LABEL[type]  || type.slice(0,4).toUpperCase(); }

// ─── Floor-plan canvas ────────────────────────────────────────────────────────
function FloorPlanCanvas({ layout, width, height }) {
  const stageRef                  = useRef(null);
  const [zoom,     setZoom]       = useState(1);
  const [stagePos, setStagePos]   = useState({ x: 0, y: 0 });

  const SCALE_BY = 1.12;
  const MIN_ZOOM = 0.4;
  const MAX_ZOOM = 6;

  const handleWheel = useCallback((e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    const direction = e.evt.deltaY < 0 ? 1 : -1;
    setZoom(prev => {
      setStagePos(pos => {
        const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, direction > 0 ? prev * SCALE_BY : prev / SCALE_BY));
        return {
          x: pointer.x - ((pointer.x - pos.x) / prev) * next,
          y: pointer.y - ((pointer.y - pos.y) / prev) * next,
        };
      });
      return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, direction > 0 ? prev * SCALE_BY : prev / SCALE_BY));
    });
  }, []);

  const zoomIn  = useCallback(() => {
    setZoom(prev => {
      const next = Math.min(MAX_ZOOM, prev * SCALE_BY);
      setStagePos(pos => ({ x: pos.x - (width / 2) * (next - prev), y: pos.y - (height / 2) * (next - prev) }));
      return next;
    });
  }, [width, height]);

  const zoomOut = useCallback(() => {
    setZoom(prev => {
      const next = Math.max(MIN_ZOOM, prev / SCALE_BY);
      setStagePos(pos => ({ x: pos.x - (width / 2) * (next - prev), y: pos.y - (height / 2) * (next - prev) }));
      return next;
    });
  }, [width, height]);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setStagePos({ x: 0, y: 0 });
  }, []);

  if (!layout?.plot) return null;

  const PAD   = 56;
  const drawW = width  - PAD * 2;
  const drawH = height - PAD * 2;

  const scale  = Math.min(drawW / layout.plot.width, drawH / layout.plot.length);
  const plotPW = layout.plot.width  * scale;
  const plotPH = layout.plot.length * scale;

  const ox = PAD + (drawW - plotPW) / 2;
  const oy = PAD + (drawH - plotPH) / 2;

  const px = v => ox + v * scale;
  const py = v => oy + v * scale;

  const facingLabel = (layout.plot.facing || 'north').toUpperCase();
  const sb = layout.plot.setback || { front: 6, back: 4, left: 4, right: 4 };

  // Setback zone pixel boundaries
  const frontH  = sb.back  * scale;   // top strip  (main gate side)
  const rearH   = sb.front * scale;   // bottom strip (garden)
  const leftW   = sb.left  * scale;
  const rightW  = sb.right * scale;
  const midY    = py(sb.back);                                // top of buildable area
  const midBotY = py(layout.plot.length - sb.front);         // bottom of buildable area
  const midX    = px(sb.left);
  const midRX   = px(layout.plot.width - sb.right);

  return (
    <div style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>

      {/* ── Zoom controls ── */}
      <div style={{
        position: 'absolute', top: 8, right: 8, zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {[
          { label: '+', title: 'Zoom in',  action: zoomIn  },
          { label: '−', title: 'Zoom out', action: zoomOut },
          { label: '⊡', title: 'Reset zoom', action: resetZoom },
        ].map(({ label, title, action }) => (
          <button key={label} title={title} onClick={action}
            style={{
              width: 28, height: 28, borderRadius: 6,
              background: 'rgba(255,255,255,0.92)',
              border: '1px solid #CBD5E1',
              fontSize: label === '⊡' ? 13 : 16,
              fontWeight: 'bold', color: '#334155',
              cursor: 'pointer', lineHeight: 1,
              boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            {label}
          </button>
        ))}
        {zoom !== 1 && (
          <div style={{
            background: 'rgba(255,255,255,0.85)', borderRadius: 4,
            fontSize: 9, color: '#64748B', textAlign: 'center',
            padding: '1px 2px', border: '1px solid #E2E8F0',
          }}>
            {Math.round(zoom * 100)}%
          </div>
        )}
      </div>

      <Stage
        ref={stageRef}
        width={width} height={height}
        scaleX={zoom} scaleY={zoom}
        x={stagePos.x} y={stagePos.y}
        draggable={zoom > 1}
        onWheel={handleWheel}
        onDragEnd={e => setStagePos({ x: e.target.x(), y: e.target.y() })}
        style={{ borderRadius: 8, cursor: zoom > 1 ? 'grab' : 'default' }}
      >
      <Layer>

        {/* ── Canvas background ── */}
        <Rect x={0} y={0} width={width} height={height} fill="#F8FAFC" />

        {/* ── Plot fill ── */}
        <Rect x={ox} y={oy} width={plotPW} height={plotPH} fill="#FAFAFA" />

        {/* ═══════════════════════════════════════════════════
            SETBACK ZONES  —  labeled empty areas around the building
            ═══════════════════════════════════════════════════ */}

        {/* FRONT SETBACK (top) — main gate / road side */}
        {frontH > 4 && (
          <Group>
            <Rect x={ox} y={oy} width={plotPW} height={frontH}
              fill="#DCFCE7" stroke="#86EFAC" strokeWidth={0.5} />
            {Array.from({ length: Math.ceil(plotPW / 8) + 2 }).map((_, i) => (
              <Line key={`fh${i}`}
                points={[ox + i * 8 - frontH, oy,  ox + i * 8, oy + frontH]}
                stroke="#BBF7D0" strokeWidth={0.8} lineCap="round"
              />
            ))}
            {/* Only show second line if there's room */}
            <Text x={ox + 4} y={oy + Math.max(2, frontH / 2 - (frontH > 16 ? 8 : 4))}
              width={plotPW - 8} align="center"
              text={frontH > 16 ? 'FRONT SETBACK' : `SETBACK (${sb.back}ft)`}
              fontSize={8} fontStyle="bold" fontFamily="Arial" fill="#166534"
            />
            {frontH > 16 && (
              <Text x={ox + 4} y={oy + frontH / 2 + 2}
                width={plotPW - 8} align="center"
                text={`Main Gate / Entry  (${sb.back} ft)`} fontSize={7}
                fontFamily="Arial" fill="#16A34A"
              />
            )}
          </Group>
        )}

        {/* REAR SETBACK (bottom) — garden / open area */}
        {rearH > 4 && (
          <Group>
            <Rect x={ox} y={midBotY} width={plotPW} height={rearH}
              fill="#FEF9C3" stroke="#FDE047" strokeWidth={0.5} />
            {Array.from({ length: Math.ceil(plotPW / 8) + 2 }).map((_, i) => (
              <Line key={`rh${i}`}
                points={[ox + i * 8 - rearH, midBotY,  ox + i * 8, midBotY + rearH]}
                stroke="#FEF08A" strokeWidth={0.8}
              />
            ))}
            <Text x={ox + 4} y={midBotY + Math.max(2, rearH / 2 - 8)}
              width={plotPW - 8} align="center"
              text="REAR SETBACK" fontSize={8} fontStyle="bold"
              fontFamily="Arial" fill="#854D0E"
            />
            <Text x={ox + 4} y={midBotY + Math.max(10, rearH / 2 + 1)}
              width={plotPW - 8} align="center"
              text={`Garden / Open Area  (${sb.front} ft)`} fontSize={7}
              fontFamily="Arial" fill="#CA8A04"
            />
          </Group>
        )}

        {/* LEFT SETBACK */}
        {leftW > 3 && (
          <Group>
            <Rect x={ox} y={midY} width={leftW} height={midBotY - midY}
              fill="#EFF6FF" stroke="#BFDBFE" strokeWidth={0.5} />
            <Text x={ox + 2} y={midY + (midBotY - midY) / 2 - 6}
              width={leftW - 4} align="center"
              text="SIDE" fontSize={7} fontStyle="bold"
              fontFamily="Arial" fill="#1D4ED8"
            />
            <Text x={ox + 2} y={midY + (midBotY - midY) / 2 + 1}
              width={leftW - 4} align="center"
              text={`${sb.left}ft`} fontSize={7}
              fontFamily="Arial" fill="#3B82F6"
            />
          </Group>
        )}

        {/* RIGHT SETBACK */}
        {rightW > 3 && (
          <Group>
            <Rect x={midRX} y={midY} width={rightW} height={midBotY - midY}
              fill="#EFF6FF" stroke="#BFDBFE" strokeWidth={0.5} />
            <Text x={midRX + 2} y={midY + (midBotY - midY) / 2 - 6}
              width={rightW - 4} align="center"
              text="SIDE" fontSize={7} fontStyle="bold"
              fontFamily="Arial" fill="#1D4ED8"
            />
            <Text x={midRX + 2} y={midY + (midBotY - midY) / 2 + 1}
              width={rightW - 4} align="center"
              text={`${sb.right}ft`} fontSize={7}
              fontFamily="Arial" fill="#3B82F6"
            />
          </Group>
        )}

        {/* Buildable area dashed outline */}
        <Rect
          x={midX} y={midY}
          width={midRX - midX} height={midBotY - midY}
          fill="transparent" stroke="#94A3B8"
          strokeWidth={0.8} dash={[5, 3]}
        />

        {/* ── Plot boundary ── */}
        <Rect x={ox} y={oy} width={plotPW} height={plotPH}
          fill="transparent" stroke="#1E293B" strokeWidth={3}
        />

        {/* Road indicator above plot */}
        <Group>
          <Rect x={ox} y={oy - 14} width={plotPW} height={12}
            fill="#E2E8F0" cornerRadius={2} />
          <Text x={ox} y={oy - 12} width={plotPW} align="center"
            text={`▼  ROAD  (${facingLabel} FACING)  ▼`}
            fontSize={8} fontStyle="bold" fontFamily="Arial" fill="#475569"
          />
        </Group>

        {/* ── Rooms ── */}
        {(layout.rooms || []).map((room, i) => {
          const s   = roomStyle(room.type);
          const rx  = px(room.x);
          const ry  = py(room.y);
          const rw  = room.width  * scale;
          const rh  = room.height * scale;
          const cy  = ry + rh / 2;

          const tiny   = rw < 38 || rh < 26;
          const small  = rw < 60 || rh < 40;
          const label  = tiny ? tinyLabel(room.type) : shortLabel(room.type);
          const dimTxt = `${Math.round(room.width)}' × ${Math.round(room.height)}'`;

          // ── Furniture symbols ─────────────────────────────────────────
          const furniture = []; // { key, type:'rect'|'circle'|'line', ... }
          const fw = rw, fh = rh;
          const P = 4;

          if (!tiny && room.type === 'kitchen' && fw > 30 && fh > 30) {
            // L-counter: back wall
            furniture.push({ key:'kc1', x: rx+P, y: ry+fh-P-9, w: fw-P*2, h: 9, fill:'#BBFDE8', stroke:'#059669', round:1 });
            // L-counter: right wall
            furniture.push({ key:'kc2', x: rx+fw-P-9, y: ry+P, w: 9, h: fh-P*2-9, fill:'#BBFDE8', stroke:'#059669', round:1 });
            // Double sink on back counter
            furniture.push({ key:'ks1', x: rx+P+3,  y: ry+fh-P-7.5, w: 7, h: 5.5, fill:'#6EE7B7', stroke:'#059669', round:1.5 });
            furniture.push({ key:'ks2', x: rx+P+12, y: ry+fh-P-7.5, w: 7, h: 5.5, fill:'#6EE7B7', stroke:'#059669', round:1.5 });
            // Sink drain dots
            furniture.push({ type:'circle', key:'kd1', cx: rx+P+6.5,  cy: ry+fh-P-4.5, r:1.2, fill:'#34D399', stroke:'#059669' });
            furniture.push({ type:'circle', key:'kd2', cx: rx+P+15.5, cy: ry+fh-P-4.5, r:1.2, fill:'#34D399', stroke:'#059669' });
            // Hob (4 burners) on right counter
            if (fh > 45) {
              const hx = rx+fw-P-7, hy = ry+P+10;
              [[0,0],[5,0],[0,6],[5,6]].forEach(([bx,by],bi) => {
                furniture.push({ type:'circle', key:`hb${bi}`, cx: hx+bx, cy: hy+by, r:2, fill:'#64748B', stroke:'#334155' });
              });
            }
          }

          if (!tiny && room.type === 'living_room' && fw > 40 && fh > 35) {
            // TV unit on front wall
            furniture.push({ key:'ltv', x: rx+fw*0.15, y: ry+P,   w: fw*0.5,  h: 4,       fill:'#0F172A', stroke:'#1E293B', round:1 });
            // TV stand
            furniture.push({ key:'lts', x: rx+fw*0.2,  y: ry+P+4, w: fw*0.4,  h: 3,       fill:'#334155', stroke:'#1E293B', round:0 });
            // Sofa (3-seater)
            furniture.push({ key:'ls',  x: rx+P,        y: ry+fh*0.52, w: fw*0.62, h: fh*0.22, fill:'#BFDBFE', stroke:'#2563EB', round:4 });
            // Sofa back cushion dividers
            furniture.push({ key:'ls1', x: rx+P+fw*0.2,  y: ry+fh*0.52+2, w:1.5, h: fh*0.19, fill:'#93C5FD', stroke:'#2563EB', round:0 });
            furniture.push({ key:'ls2', x: rx+P+fw*0.41, y: ry+fh*0.52+2, w:1.5, h: fh*0.19, fill:'#93C5FD', stroke:'#2563EB', round:0 });
            // Coffee table
            furniture.push({ key:'lct', x: rx+P+6, y: ry+fh*0.4, w: fw*0.32, h: fh*0.1, fill:'#FEF3C7', stroke:'#D97706', round:2 });
          }

          if (!tiny && room.type === 'dining' && fw > 32 && fh > 28) {
            // Table
            furniture.push({ key:'dt', x: rx+fw*0.18, y: ry+fh*0.2, w: fw*0.64, h: fh*0.55, fill:'#FDE68A', stroke:'#D97706', round:3 });
            // Chairs (small rects) around table
            furniture.push({ key:'dc1', x: rx+fw*0.27, y: ry+fh*0.12, w: fw*0.16, h: fh*0.08, fill:'#FEF3C7', stroke:'#D97706', round:2 });
            furniture.push({ key:'dc2', x: rx+fw*0.55, y: ry+fh*0.12, w: fw*0.16, h: fh*0.08, fill:'#FEF3C7', stroke:'#D97706', round:2 });
            furniture.push({ key:'dc3', x: rx+fw*0.27, y: ry+fh*0.78, w: fw*0.16, h: fh*0.08, fill:'#FEF3C7', stroke:'#D97706', round:2 });
            furniture.push({ key:'dc4', x: rx+fw*0.55, y: ry+fh*0.78, w: fw*0.16, h: fh*0.08, fill:'#FEF3C7', stroke:'#D97706', round:2 });
          }

          if (!tiny && (room.type === 'master_bedroom' || room.type === 'bedroom' || room.type === 'guest_room') && fw > 35 && fh > 30) {
            const bw = Math.min(fw * 0.72, 58), bh2 = Math.min(fh * 0.52, 44);
            const bx2 = rx + (fw - bw) / 2, by2 = ry + fh * 0.3;
            // Bed frame
            furniture.push({ key:'bed', x: bx2, y: by2, w: bw, h: bh2, fill:'#EDE9FE', stroke:'#7C3AED', round:4 });
            // Headboard
            furniture.push({ key:'hb', x: bx2+3, y: by2+2, w: bw-6, h: bh2*0.2, fill:'#C4B5FD', stroke:'#7C3AED', round:3 });
            // Left pillow
            furniture.push({ key:'p1', x: bx2+5, y: by2+bh2*0.22+1, w: bw*0.35-3, h: bh2*0.22, fill:'#F5F3FF', stroke:'#A78BFA', round:3 });
            // Right pillow
            furniture.push({ key:'p2', x: bx2+bw*0.53, y: by2+bh2*0.22+1, w: bw*0.35-3, h: bh2*0.22, fill:'#F5F3FF', stroke:'#A78BFA', round:3 });
            // Side table (if wide enough)
            if (fw > 50) {
              furniture.push({ key:'ns', x: bx2-8, y: by2+3, w: 7, h: 8, fill:'#DDD6FE', stroke:'#7C3AED', round:2 });
            }
          }

          if (!tiny && room.type === 'bathroom' && fw > 22 && fh > 22) {
            // Toilet cistern (tank - thin rect at back)
            furniture.push({ key:'btc', x: rx+P,   y: ry+fh-P-17, w: 12, h: 4,  fill:'#BAE6FD', stroke:'#0891B2', round:1 });
            // Toilet bowl (oval-ish)
            furniture.push({ key:'btb', x: rx+P+1, y: ry+fh-P-13, w: 10, h: 13, fill:'#E0F9FF', stroke:'#0891B2', round:5 });
            // Washbasin (front corner)
            furniture.push({ key:'bwb', x: rx+P, y: ry+P, w: 11, h: 11, fill:'#E0F2FE', stroke:'#0891B2', round:4 });
            // Basin drain
            furniture.push({ type:'circle', key:'bdr', cx: rx+P+5.5, cy: ry+P+5.5, r:2, fill:'#BAE6FD', stroke:'#0891B2' });
            // Tap (small rect)
            furniture.push({ key:'btp', x: rx+P+4, y: ry+P-1.5, w:3, h:2.5, fill:'#94A3B8', stroke:'#64748B', round:1 });
          }

          return (
            <Group key={i}>
              <Rect x={rx} y={ry} width={rw} height={rh}
                fill={s.fill} stroke={s.stroke} strokeWidth={1.5} cornerRadius={2}
              />
              {/* Furniture */}
              {furniture.map(f => f.type === 'circle'
                ? <Circle key={f.key} x={f.cx} y={f.cy} radius={f.r} fill={f.fill} stroke={f.stroke} strokeWidth={0.8} />
                : <Rect key={f.key} x={f.x} y={f.y} width={f.w} height={f.h} fill={f.fill} stroke={f.stroke} strokeWidth={0.8} cornerRadius={f.round || 0} />
              )}
              {/* Room label */}
              <Text
                x={rx + 3} y={cy - (small ? 6 : 8)}
                width={rw - 6}
                text={label}
                fontSize={tiny ? 7 : small ? 8 : 10}
                fontFamily="Inter, Arial, sans-serif"
                fontStyle="bold"
                fill={s.text}
                align="center"
                wrap="none"
                ellipsis
              />
              {!tiny && (
                <Text
                  x={rx + 3} y={cy + (small ? 2 : 3)}
                  width={rw - 6}
                  text={dimTxt}
                  fontSize={7}
                  fontFamily="Arial"
                  fill="#6B7280"
                  align="center"
                  wrap="none"
                  ellipsis
                />
              )}
            </Group>
          );
        })}

        {/* ── Parking area ── */}
        {layout.parking && (() => {
          const p    = layout.parking;
          const ppx  = v => ox + v * scale;
          const ppy  = v => oy + v * scale;
          const pw   = p.width  * scale;
          const ph   = Math.max(18, p.height * scale);
          const cars = p.cars || 1;
          const bayW = pw / cars;
          return (
            <Group key="parking">
              {/* Background */}
              <Rect x={ppx(p.x)} y={ppy(p.y)} width={pw} height={ph}
                fill="#E2E8F0" stroke="#334155" strokeWidth={1.5} cornerRadius={2}
              />
              {/* Per-bay: bay divider + top-down car silhouette */}
              {Array.from({ length: cars }).map((_, ci) => {
                const bx = ppx(p.x) + ci * bayW;
                const by = ppy(p.y);
                const cw = bayW - 4, ch = ph - 4;
                const cx2 = bx + 2, cy2 = by + 2;
                // Car body proportions
                const ww2 = cw * 0.18, wh2 = ch * 0.18;  // wheel size
                return (
                  <Group key={ci}>
                    {/* Bay outline */}
                    <Rect x={cx2} y={cy2} width={cw} height={ch}
                      fill="#F8FAFC" stroke="#64748B" strokeWidth={1} cornerRadius={2}
                    />
                    {/* Bay divider line */}
                    {ci > 0 && <Line points={[bx, by, bx, by+ph]} stroke="#475569" strokeWidth={1} />}
                    {/* ── Car body ── */}
                    <Rect
                      x={cx2 + cw*0.12} y={cy2 + ch*0.08}
                      width={cw*0.76} height={ch*0.84}
                      fill="#CBD5E1" stroke="#475569" strokeWidth={1} cornerRadius={3}
                    />
                    {/* Windscreen (front) */}
                    <Line
                      points={[cx2+cw*0.18, cy2+ch*0.22, cx2+cw*0.82, cy2+ch*0.22]}
                      stroke="#94A3B8" strokeWidth={1}
                    />
                    {/* Rear window */}
                    <Line
                      points={[cx2+cw*0.18, cy2+ch*0.78, cx2+cw*0.82, cy2+ch*0.78]}
                      stroke="#94A3B8" strokeWidth={1}
                    />
                    {/* 4 wheels */}
                    <Rect x={cx2+cw*0.05}  y={cy2+ch*0.1}  width={ww2} height={wh2} fill="#334155" stroke="#1E293B" strokeWidth={0.5} cornerRadius={1} />
                    <Rect x={cx2+cw*0.05}  y={cy2+ch*0.72} width={ww2} height={wh2} fill="#334155" stroke="#1E293B" strokeWidth={0.5} cornerRadius={1} />
                    <Rect x={cx2+cw*0.77}  y={cy2+ch*0.1}  width={ww2} height={wh2} fill="#334155" stroke="#1E293B" strokeWidth={0.5} cornerRadius={1} />
                    <Rect x={cx2+cw*0.77}  y={cy2+ch*0.72} width={ww2} height={wh2} fill="#334155" stroke="#1E293B" strokeWidth={0.5} cornerRadius={1} />
                    {/* P badge */}
                    <Text x={cx2} y={cy2 + ch/2 - 5} width={cw}
                      text="P" fontSize={Math.max(7, Math.min(12, cw*0.35))}
                      fontStyle="bold" fontFamily="Arial" fill="#1E40AF" align="center"
                    />
                  </Group>
                );
              })}
              {/* PARKING label above */}
              <Text x={ppx(p.x)} y={ppy(p.y) - 13}
                width={pw} align="center"
                text={`PARKING  (${cars} car${cars > 1 ? 's' : ''})`}
                fontSize={8} fontStyle="bold" fontFamily="Arial" fill="#1E293B"
              />
            </Group>
          );
        })()}

        {/* ── Interior walls ── */}
        {(layout.walls || []).filter(w => w.type === 'interior').map((w, i) => (
          <Line key={`iw${i}`}
            points={[px(w.x1), py(w.y1), px(w.x2), py(w.y2)]}
            stroke="#64748B" strokeWidth={1} lineCap="round"
          />
        ))}

        {/* ── Exterior walls ── */}
        {(layout.walls || []).filter(w => w.type === 'exterior').map((w, i) => (
          <Line key={`ew${i}`}
            points={[px(w.x1), py(w.y1), px(w.x2), py(w.y2)]}
            stroke="#0F172A" strokeWidth={3.5} lineCap="square"
          />
        ))}

        {/* ── Doors ── */}
        {(layout.doors || []).map((door, i) => {
          const dx  = px(door.x);
          const dy  = py(door.y);
          const dw  = Math.max(10, door.width * scale);
          const isMain = door.type === 'main';
          const isBath = door.type === 'bathroom';
          const colour = isMain ? '#EF4444' : isBath ? '#06B6D4' : '#64748B';

          return (
            <Group key={`d${i}`}>
              {/* Door leaf */}
              <Line
                points={[dx, dy, dx + dw, dy]}
                stroke={colour} strokeWidth={isMain ? 3 : 1.5} lineCap="round"
              />
              {/* Swing arc */}
              <Arc
                x={dx} y={dy}
                innerRadius={0} outerRadius={dw}
                angle={90} rotation={0}
                stroke={colour} strokeWidth={isMain ? 1.5 : 0.8}
                fill={isMain ? 'rgba(239,68,68,0.07)' : 'transparent'}
              />
              {/* ENTRY label on main door */}
              {isMain && (
                <>
                  <Text
                    x={dx - 14} y={dy - 18}
                    text="▼ ENTRY / MAIN GATE"
                    fontSize={8} fontFamily="Arial" fontStyle="bold"
                    fill="#EF4444"
                  />
                </>
              )}
            </Group>
          );
        })}

        {/* ── Windows (architectural symbol: 3 parallel lines in wall opening) ── */}
        {(layout.windows || []).map((win, i) => {
          const wx  = px(win.x);
          const wy  = py(win.y);
          const ww  = Math.max(4, win.width  * scale);
          const wh  = Math.max(4, win.height * scale);
          const horiz = ww >= wh; // horizontal window opening?
          return (
            <Group key={`w${i}`}>
              {/* White opening in wall */}
              <Rect x={wx} y={wy} width={ww} height={wh} fill="#FFFFFF" stroke="none" />
              {/* Three parallel lines (glass panes) */}
              {horiz ? (<>
                <Line points={[wx,      wy+wh/2-1.5, wx+ww, wy+wh/2-1.5]} stroke="#38BDF8" strokeWidth={1.2} />
                <Line points={[wx,      wy+wh/2+0,   wx+ww, wy+wh/2+0  ]} stroke="#0EA5E9" strokeWidth={1.2} />
                <Line points={[wx,      wy+wh/2+1.5, wx+ww, wy+wh/2+1.5]} stroke="#38BDF8" strokeWidth={1.2} />
                {/* End caps */}
                <Line points={[wx,    wy, wx,    wy+wh]} stroke="#0F172A" strokeWidth={1.5} />
                <Line points={[wx+ww, wy, wx+ww, wy+wh]} stroke="#0F172A" strokeWidth={1.5} />
              </>) : (<>
                <Line points={[wx+ww/2-1.5, wy, wx+ww/2-1.5, wy+wh]} stroke="#38BDF8" strokeWidth={1.2} />
                <Line points={[wx+ww/2+0,   wy, wx+ww/2+0,   wy+wh]} stroke="#0EA5E9" strokeWidth={1.2} />
                <Line points={[wx+ww/2+1.5, wy, wx+ww/2+1.5, wy+wh]} stroke="#38BDF8" strokeWidth={1.2} />
                <Line points={[wx, wy,    wx+ww, wy   ]} stroke="#0F172A" strokeWidth={1.5} />
                <Line points={[wx, wy+wh, wx+ww, wy+wh]} stroke="#0F172A" strokeWidth={1.5} />
              </>)}
            </Group>
          );
        })}

        {/* ── Staircase ── */}
        {layout.staircase && (() => {
          const st   = layout.staircase;
          const sx2  = px(st.x), sy2 = py(st.y);
          const sw   = st.width  * scale;
          const sh   = st.height * scale;
          const steps = 9;
          const treadH = (sh - 4) / steps;
          // break line sits at 55% from bottom
          const breakY = sy2 + sh - 2 - Math.round(steps * 0.55) * treadH;
          return (
            <Group key="stair">
              {/* Boundary */}
              <Rect x={sx2} y={sy2} width={sw} height={sh}
                fill="#F1F5F9" stroke="#475569" strokeWidth={1.5}
              />
              {/* Step treads (solid below break line) */}
              {Array.from({ length: steps }).map((_, si) => {
                const lineY = sy2 + sh - 2 - (si + 1) * treadH;
                const above = lineY < breakY;
                return (
                  <Line key={si}
                    points={[sx2 + 2, lineY, sx2 + sw - 2, lineY]}
                    stroke={above ? '#94A3B8' : '#64748B'}
                    strokeWidth={above ? 0.6 : 0.9}
                    dash={above ? [2, 1.5] : []}
                  />
                );
              })}
              {/* Architectural break line (zigzag) */}
              <Line
                points={[
                  sx2,          breakY - 3,
                  sx2+sw*0.22,  breakY + 3,
                  sx2+sw*0.44,  breakY - 3,
                  sx2+sw*0.66,  breakY + 3,
                  sx2+sw*0.88,  breakY - 3,
                  sx2+sw,       breakY + 3,
                ]}
                stroke="#94A3B8" strokeWidth={1.2} lineCap="round" lineJoin="round"
              />
              {/* Direction arrow shaft */}
              <Line
                points={[sx2+sw/2, sy2+sh-6, sx2+sw/2, sy2+10]}
                stroke="#334155" strokeWidth={1.5} lineCap="round"
              />
              {/* Arrow head */}
              <Line
                points={[sx2+sw/2-5, sy2+18, sx2+sw/2, sy2+10, sx2+sw/2+5, sy2+18]}
                stroke="#334155" strokeWidth={1.5} lineCap="round" lineJoin="round"
              />
              {/* UP label */}
              <Text x={sx2+1} y={sy2+2} width={sw-2}
                text="UP" fontSize={7} fontStyle="bold"
                fontFamily="Arial" fill="#334155" align="center"
              />
            </Group>
          );
        })()}

        {/* ── Dimension lines ── */}

        {/* Width (top) */}
        <Group>
          <Line points={[ox, oy - 18, ox + plotPW, oy - 18]} stroke="#64748B" strokeWidth={1} dash={[4, 2]} />
          <Line points={[ox, oy - 22, ox, oy - 14]}             stroke="#64748B" strokeWidth={1} />
          <Line points={[ox + plotPW, oy - 22, ox + plotPW, oy - 14]} stroke="#64748B" strokeWidth={1} />
          <Text x={ox} y={oy - 32} width={plotPW}
            text={`${layout.plot.width} ft`}
            fontSize={9} fontFamily="Arial" fill="#374151" align="center" fontStyle="bold"
          />
        </Group>

        {/* Length (right) */}
        <Group>
          <Line points={[ox + plotPW + 18, oy, ox + plotPW + 18, oy + plotPH]} stroke="#64748B" strokeWidth={1} dash={[4, 2]} />
          <Line points={[ox + plotPW + 14, oy,         ox + plotPW + 22, oy]}         stroke="#64748B" strokeWidth={1} />
          <Line points={[ox + plotPW + 14, oy + plotPH, ox + plotPW + 22, oy + plotPH]} stroke="#64748B" strokeWidth={1} />
          <Text x={ox + plotPW + 24} y={oy + plotPH / 2 - 6}
            text={`${layout.plot.length} ft`}
            fontSize={9} fontFamily="Arial" fill="#374151" fontStyle="bold"
          />
        </Group>

        {/* ── Facing / compass badge ── */}
        <Group>
          <Rect
            x={ox + plotPW - 42} y={oy + plotPH - 20}
            width={40} height={16}
            fill="#1E40AF" cornerRadius={3}
          />
          <Text
            x={ox + plotPW - 40} y={oy + plotPH - 16}
            width={36}
            text={`⬆ ${facingLabel}`}
            fontSize={8} fontFamily="Arial" fontStyle="bold"
            fill="#FFFFFF" align="center"
          />
        </Group>

        {/* ── Theme strip ── */}
        {layout.metadata?.theme && (
          <Text
            x={ox} y={oy + plotPH + 8}
            width={plotPW}
            text={`${layout.metadata.theme}  ·  ${(layout.metadata.layoutStyle || '').replace('-', ' ')} layout`}
            fontSize={8} fontFamily="Arial" fill="#94A3B8" align="center"
          />
        )}

      </Layer>
      </Stage>
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────
function Legend({ rooms, hasParking }) {
  const types = [...new Set((rooms || []).map(r => r.type))];
  return (
    <div className="mt-3 space-y-2">
      {/* Room colours */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {types.map(type => {
          const s = roomStyle(type);
          return (
            <div key={type} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm border flex-shrink-0"
                style={{ background: s.fill, borderColor: s.stroke }} />
              <span className="text-xs text-gray-500">{shortLabel(type)}</span>
            </div>
          );
        })}
      </div>
      {/* Zone & symbol legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-green-100 border border-green-400 flex-shrink-0" />
          <span className="text-xs text-gray-500">Front Setback (Entry Zone)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-yellow-100 border border-yellow-400 flex-shrink-0" />
          <span className="text-xs text-gray-500">Rear Setback (Garden)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-blue-100 border border-blue-300 flex-shrink-0" />
          <span className="text-xs text-gray-500">Side Setbacks</span>
        </div>
        {hasParking && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-slate-300 border border-slate-500 flex-shrink-0" />
            <span className="text-xs text-gray-500">Parking Bay</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-red-100 border border-red-400 flex-shrink-0" />
          <span className="text-xs text-gray-500">Main Entry Door</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-slate-100 border border-slate-400 flex-shrink-0" />
          <span className="text-xs text-gray-500">Room Doors</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-gray-200 border border-gray-400 flex-shrink-0" />
          <span className="text-xs text-gray-500">Staircase</span>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PlanResults() {
  const navigate      = useNavigate();
  const location      = useLocation();
  const containerRef  = useRef(null);
  const [plans,        setPlans]        = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [canvasSize,   setCanvasSize]   = useState({ width: 560, height: 440 });
  const [show3D,       setShow3D]       = useState(false);
  const [showPro,      setShowPro]      = useState(false);

  // Responsive canvas
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const w = Math.floor(entries[0].contentRect.width);
      if (w > 0) setCanvasSize({ width: w, height: Math.floor(w * 0.78) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

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
            <span>📐</span> Professional View
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
        <div className="lg:col-span-1 space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Plans</p>
          {plans.length === 0
            ? <p className="text-sm text-gray-400">No plans yet. Generate some first.</p>
            : plans.map(plan => {
                const meta     = plan.layoutJson?.metadata || {};
                const isAI     = meta.generator === 'ai-enhanced';
                const selected = selectedPlan?._id === plan._id;
                return (
                  <div key={plan._id} onClick={() => setSelectedPlan(plan)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all select-none ${
                      selected ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50'
                    }`}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{plan.title}</p>
                        {meta.theme && <p className="text-xs text-gray-500 mt-0.5 truncate">{meta.theme}</p>}
                        {meta.description && <p className="text-xs text-gray-400 mt-0.5 truncate italic">{meta.description}</p>}
                        <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
                          <span className="text-xs text-gray-500">{plan.layoutJson?.rooms?.length || 0} rooms</span>
                          {meta.layoutStyle && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded capitalize">
                              {meta.layoutStyle.replace('-', ' ')}
                            </span>
                          )}
                          {isAI && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">AI</span>}
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
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

              {/* Canvas */}
              <div ref={containerRef} className="p-4 bg-slate-50">
                <FloorPlanCanvas layout={layout} width={canvasSize.width} height={canvasSize.height} />
                <Legend rooms={layout.rooms} hasParking={!!layout.parking} />
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

      {/* ── Professional View Modal ── */}
      {showPro && selectedPlan?.layoutJson && (
        <div className="fixed inset-0 z-50 flex flex-col bg-gray-100">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 bg-gray-900 border-b border-gray-700 flex-shrink-0">
            <div>
              <h2 className="text-white font-semibold text-base">{selectedPlan.title} — Professional Drawing</h2>
              <p className="text-gray-400 text-xs mt-0.5">
                AutoCAD-quality architectural floor plan
              </p>
            </div>
            <button
              onClick={() => setShowPro(false)}
              className="text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
            >
              ✕ Close
            </button>
          </div>
          {/* Drawing canvas */}
          <div className="flex-1 min-h-0 overflow-auto p-4">
            <ProfessionalFloorPlan
              layout={selectedPlan.layoutJson}
              projectName={selectedPlan.title}
              floorLabel="GROUND FLOOR PLAN"
              drawingNumber="A-101"
            />
          </div>
        </div>
      )}

      {/* ── 3D Viewer Modal ── */}
      {show3D && selectedPlan?.layoutJson && (
        <div className="fixed inset-0 z-50 flex flex-col bg-gray-950">
          {/* Header */}
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
              <button
                onClick={() => setShow3D(false)}
                className="text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
              >
                ✕ Close
              </button>
            </div>
          </div>
          {/* 3D canvas — fills remaining height */}
          <div className="flex-1 min-h-0">
            <ThreeDViewer layout={selectedPlan.layoutJson} />
          </div>
        </div>
      )}

    </div>
  );
}
