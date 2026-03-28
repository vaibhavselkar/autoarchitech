/**
 * ProfessionalFloorPlan.jsx — AutoCAD-quality architectural floor plan renderer
 * Uses pure SVG, no canvas dependency.
 *
 * Features:
 * - Double-line walls with 45° diagonal hatching
 * - Door swing arcs (quarter-circle)
 * - Window triple-line markers
 * - Dimension chains (horizontal + vertical)
 * - Title block + north arrow
 * - Scale bar
 * - Layer visibility toggle
 * - Scale selector (1:50 / 1:100 / 1:200)
 */

import { useState, useRef, useMemo, useCallback } from 'react';
import { feetToMm, mmToPx, mmToFeetInches, ScaleBar } from '../utils/units';
import { buildHatch45 } from '../models/WallModel';
import { NorthArrow, DoorSymbol, WindowSymbol, ArrowheadDef } from '../symbols/ArchSymbols';
import { ChainDimension, OverallDimension } from '../utils/DimensionLines';
import TitleBlock from './TitleBlock';

// ── Room fill palette (lighter than coloured version — more architectural) ──
const ROOM_FILL = {
  living_room:    '#F0F4FF',
  master_bedroom: '#FFF0F8',
  bedroom:        '#F5F0FF',
  kitchen:        '#F0FFF4',
  dining:         '#FFFBF0',
  bathroom:       '#F0FBFF',
  study:          '#F8F8F8',
  balcony:        '#F0FFF8',
  terrace:        '#F0FFF8',
  guest_room:     '#FFF8F0',
  default:        '#FAFAFA',
};

const ROOM_STROKE = {
  living_room:    '#4B6CB7',
  master_bedroom: '#B7456C',
  bedroom:        '#7C4DB7',
  kitchen:        '#2E8B57',
  dining:         '#B78A2E',
  bathroom:       '#2E8BB7',
  study:          '#6B7280',
  balcony:        '#2E9E7A',
  terrace:        '#2E9E50',
  guest_room:     '#B76A2E',
  default:        '#888',
};

const ROOM_LABEL = {
  living_room:    'LIVING ROOM',
  master_bedroom: 'MASTER BEDROOM',
  bedroom:        'BEDROOM',
  kitchen:        'KITCHEN',
  dining:         'DINING',
  bathroom:       'BATHROOM',
  study:          'STUDY',
  balcony:        'BALCONY',
  terrace:        'TERRACE',
  guest_room:     'GUEST ROOM',
};

function roomFill(type)   { return ROOM_FILL[type]   || ROOM_FILL.default; }
function roomStroke(type) { return ROOM_STROKE[type] || ROOM_STROKE.default; }
function roomLabel(type)  { return ROOM_LABEL[type]  || (type || '').toUpperCase().replace('_', ' '); }

// ── Default layers ──────────────────────────────────────────────────────────
const DEFAULT_LAYERS = {
  walls:      true,
  rooms:      true,
  labels:     true,
  doors:      true,
  windows:    true,
  dimensions: true,
  hatch:      true,
  setbacks:   true,
  grid:       false,
  titleblock: true,
};

// ── Layer toggle panel ──────────────────────────────────────────────────────
function LayerPanel({ layers, onChange }) {
  const layerNames = {
    walls:      'Walls',
    rooms:      'Room Fill',
    labels:     'Room Labels',
    doors:      'Doors',
    windows:    'Windows',
    dimensions: 'Dimensions',
    hatch:      'Wall Hatch',
    setbacks:   'Setbacks',
    grid:       'Grid',
    titleblock: 'Title Block',
  };

  return (
    <div className="absolute top-2 left-2 z-10 bg-white/95 backdrop-blur rounded-lg shadow-lg border border-gray-200 p-2 text-xs">
      <p className="font-semibold text-gray-600 mb-1.5 px-0.5">Layers</p>
      {Object.entries(layerNames).map(([key, label]) => (
        <label key={key} className="flex items-center gap-1.5 py-0.5 cursor-pointer hover:bg-gray-50 px-0.5 rounded">
          <input
            type="checkbox"
            checked={!!layers[key]}
            onChange={e => onChange({ ...layers, [key]: e.target.checked })}
            className="w-3 h-3 rounded"
          />
          <span className="text-gray-700">{label}</span>
        </label>
      ))}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function ProfessionalFloorPlan({
  layout,
  scaleName: initialScale = '1:100',
  showLayerPanel = true,
  projectName,
  drawingNumber = 'A-101',
  floorLabel = 'GROUND FLOOR PLAN',
  onScaleChange,
}) {
  const [scaleName, setScaleName]   = useState(initialScale);
  const [layers, setLayers]         = useState(DEFAULT_LAYERS);
  const [showLayers, setShowLayers] = useState(false);
  const svgRef = useRef(null);

  const handleScaleChange = useCallback((s) => {
    setScaleName(s);
    onScaleChange?.(s);
  }, [onScaleChange]);

  // Convert feet → px at current scale
  const ftPx = useCallback((ft) => {
    return mmToPx(feetToMm(ft), scaleName);
  }, [scaleName]);

  const derived = useMemo(() => {
    if (!layout?.plot) return null;

    const plot    = layout.plot;
    const rooms   = layout.rooms  || [];
    const doors   = layout.doors  || [];
    const windows = layout.windows || [];

    const MARGIN  = 80;   // px margin around drawing
    const DIM_OFF = 30;   // dimension chain offset from building edge

    const plotW  = ftPx(plot.width);
    const plotH  = ftPx(plot.length);
    const sb     = plot.setback || { front: 6, back: 4, left: 4, right: 4 };

    const bldLeft   = ftPx(sb.left);
    const bldTop    = ftPx(sb.front);
    const bldRight  = ftPx(plot.width - sb.right);
    const bldBottom = ftPx(plot.length - sb.back);
    const bldW      = bldRight - bldLeft;
    const bldH      = bldBottom - bldTop;

    // Wall thickness px
    const WALL_T = Math.max(2, ftPx(0.75));  // ~9 inches

    // Title block dimensions
    const TB_W = 180, TB_H = 90;

    // SVG total size
    const svgW = MARGIN * 2 + plotW + DIM_OFF * 2;
    const svgH = MARGIN * 2 + plotH + DIM_OFF * 2 + TB_H + 10;

    // Origin of plot within SVG
    const ox = MARGIN + DIM_OFF;
    const oy = MARGIN + DIM_OFF;

    return {
      plot, rooms, doors, windows,
      plotW, plotH, sb,
      bldLeft, bldTop, bldRight, bldBottom, bldW, bldH,
      WALL_T, DIM_OFF, MARGIN,
      svgW, svgH, ox, oy,
      TB_W, TB_H,
    };
  }, [layout, ftPx]);

  if (!derived) return (
    <div className="flex items-center justify-center h-full text-gray-400 text-sm">No plan data</div>
  );

  const { plot, rooms, doors, windows, plotW, plotH, sb,
          WALL_T, svgW, svgH, ox, oy, TB_W, TB_H } = derived;

  const px = (ft) => ox + ftPx(ft);   // x in plot coords → SVG x
  const py = (ft) => oy + ftPx(ft);   // y in plot coords → SVG y

  // ── Grid ──────────────────────────────────────────────────────────────────
  const gridLines = [];
  if (layers.grid) {
    const step = ftPx(5);
    for (let gx = 0; gx <= plotW; gx += step) {
      gridLines.push(<line key={`gx${gx}`} x1={ox + gx} y1={oy} x2={ox + gx} y2={oy + plotH} stroke="#E5E7EB" strokeWidth={0.4} />);
    }
    for (let gy = 0; gy <= plotH; gy += step) {
      gridLines.push(<line key={`gy${gy}`} x1={ox} y1={oy + gy} x2={ox + plotW} y2={oy + gy} stroke="#E5E7EB" strokeWidth={0.4} />);
    }
  }

  // ── Setback zones ─────────────────────────────────────────────────────────
  const setbackElems = [];
  if (layers.setbacks) {
    const sbFront  = ftPx(sb.front);
    const sbBack   = ftPx(sb.back);
    const sbLeft   = ftPx(sb.left);
    const sbRight  = ftPx(sb.right);

    // Front setback (entry side — bottom of plan typically)
    const frontRect = { x: ox, y: oy + plotH - sbFront, w: plotW, h: sbFront };
    // Back setback
    const backRect  = { x: ox, y: oy, w: plotW, h: sbBack };
    // Left/right
    const leftRect  = { x: ox, y: oy + sbBack, w: sbLeft,  h: plotH - sbBack - sbFront };
    const rightRect = { x: ox + plotW - sbRight, y: oy + sbBack, w: sbRight, h: plotH - sbBack - sbFront };

    const drawSetback = (r, fill, stroke, label, key) => {
      if (r.w < 1 || r.h < 1) return;
      const hatch = buildHatch45(r.x, r.y, r.w, r.h, 8);
      setbackElems.push(
        <g key={key}>
          <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={fill} opacity={0.4} />
          {hatch.map((d, i) => <path key={i} d={d} stroke={stroke} strokeWidth={0.4} opacity={0.5} fill="none" />)}
          <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="none" stroke={stroke} strokeWidth={0.5} strokeDasharray="3,2" />
          <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 3} fontSize={6} fontFamily="Arial" fill={stroke} textAnchor="middle" opacity={0.7}>{label}</text>
        </g>
      );
    };

    drawSetback(backRect,  '#DCF5D9', '#4CAF50', 'REAR SETBACK',  'back');
    drawSetback(frontRect, '#FFF9C4', '#FFC107', 'FRONT SETBACK', 'front');
    drawSetback(leftRect,  '#E3F2FD', '#2196F3', 'SIDE SETBACK',  'left');
    drawSetback(rightRect, '#E3F2FD', '#2196F3', 'SIDE SETBACK',  'right');
  }

  // ── Room fills ────────────────────────────────────────────────────────────
  const roomFillElems = rooms.map((room, i) => {
    if (!layers.rooms && !layers.walls && !layers.labels) return null;
    const rx = px(room.x), ry = py(room.y);
    const rw = ftPx(room.width), rh = ftPx(room.height);
    const fill   = layers.rooms  ? roomFill(room.type)   : 'none';
    const stroke = layers.walls  ? roomStroke(room.type) : 'none';

    // Dimension label inside room
    const wLabel = mmToFeetInches(feetToMm(room.width));
    const hLabel = mmToFeetInches(feetToMm(room.height));
    const areaFt = (room.width * room.height).toFixed(0);
    const minDim = Math.min(rw, rh);

    return (
      <g key={i}>
        {/* Room fill */}
        <rect x={rx} y={ry} width={rw} height={rh}
          fill={fill} stroke={stroke} strokeWidth={layers.walls ? 1 : 0} />

        {/* Wall hatch on edges */}
        {layers.hatch && layers.walls && (
          <g opacity={0.15}>
            {[
              { x: rx,          y: ry - WALL_T, w: rw,     h: WALL_T }, // top
              { x: rx,          y: ry + rh,     w: rw,     h: WALL_T }, // bottom
              { x: rx - WALL_T, y: ry,          w: WALL_T, h: rh     }, // left
              { x: rx + rw,     y: ry,          w: WALL_T, h: rh     }, // right
            ].map((band, wi) => (
              <rect key={wi} x={band.x} y={band.y} width={band.w} height={band.h} fill={stroke} />
            ))}
          </g>
        )}

        {/* Room label */}
        {layers.labels && minDim > 16 && (
          <g>
            <text x={rx + rw / 2} y={ry + rh / 2 - (minDim > 24 ? 7 : 0)}
              fontSize={Math.min(8, minDim * 0.25)}
              fontFamily="Arial" fontWeight="bold"
              fill={roomStroke(room.type)} textAnchor="middle"
            >{roomLabel(room.type)}</text>
            {minDim > 24 && (
              <text x={rx + rw / 2} y={ry + rh / 2 + 5}
                fontSize={Math.min(6.5, minDim * 0.2)}
                fontFamily="Arial" fill="#888" textAnchor="middle"
              >{wLabel} × {hLabel}</text>
            )}
            {minDim > 32 && (
              <text x={rx + rw / 2} y={ry + rh / 2 + 13}
                fontSize={Math.min(6, minDim * 0.18)}
                fontFamily="Arial" fill="#AAA" textAnchor="middle"
              >{areaFt} sq ft</text>
            )}
          </g>
        )}
      </g>
    );
  });

  // ── Wall outlines (thicker outer boundary lines) ──────────────────────────
  const wallOutlines = rooms.map((room, i) => {
    if (!layers.walls) return null;
    const rx = px(room.x), ry = py(room.y);
    const rw = ftPx(room.width), rh = ftPx(room.height);
    const stroke = roomStroke(room.type);

    // Double-line wall effect: outer frame
    const t = WALL_T;
    return (
      <g key={`w${i}`}>
        {/* Outer wall line */}
        <rect x={rx - t} y={ry - t} width={rw + t * 2} height={rh + t * 2}
          fill="none" stroke={stroke} strokeWidth={1.2} opacity={0.5} />
        {/* Inner wall line */}
        <rect x={rx} y={ry} width={rw} height={rh}
          fill="none" stroke={stroke} strokeWidth={0.8} />

        {/* 45° hatch in wall band */}
        {layers.hatch && (() => {
          const hatchPaths = [
            ...buildHatch45(rx - t, ry - t, rw + t * 2, t, Math.max(3, t * 0.7)),  // top band
            ...buildHatch45(rx - t, ry + rh, rw + t * 2, t, Math.max(3, t * 0.7)), // bottom band
            ...buildHatch45(rx - t, ry, t, rh, Math.max(3, t * 0.7)),               // left band
            ...buildHatch45(rx + rw, ry, t, rh, Math.max(3, t * 0.7)),              // right band
          ];
          return hatchPaths.map((d, hi) => (
            <path key={hi} d={d} stroke={stroke} strokeWidth={0.4} fill="none" opacity={0.4} />
          ));
        })()}
      </g>
    );
  });

  // ── Door symbols ──────────────────────────────────────────────────────────
  const doorElems = (layers.doors ? doors : []).map((door, i) => {
    const dx = px(door.x), dy = py(door.y);
    const ds = ftPx(door.width || 3);
    return (
      <DoorSymbol key={i} x={dx} y={dy} size={ds} swing={door.swing || 'right'} color="#C0392B" />
    );
  });

  // ── Window symbols ────────────────────────────────────────────────────────
  const windowElems = (layers.windows ? windows : []).map((win, i) => {
    const wx = px(win.x), wy = py(win.y);
    const ws = ftPx(win.width || 4);
    return (
      <WindowSymbol key={i} x={wx} y={wy} size={ws} axis={win.axis || 'h'} wallThickness={WALL_T} color="#1565C0" />
    );
  });

  // ── Dimension chains ──────────────────────────────────────────────────────
  const dimElems = [];
  if (layers.dimensions) {
    // Collect unique X boundaries from rooms (for horizontal chain)
    const xPts = [...new Set([
      ftPx(sb.left),
      ...rooms.map(r => ftPx(r.x)),
      ...rooms.map(r => ftPx(r.x + r.width)),
      ftPx(plot.width - sb.right),
    ])].map(v => ox + v).sort((a, b) => a - b);

    const yPts = [...new Set([
      ftPx(sb.front),
      ...rooms.map(r => ftPx(r.y)),
      ...rooms.map(r => ftPx(r.y + r.height)),
      ftPx(plot.length - sb.back),
    ])].map(v => oy + v).sort((a, b) => a - b);

    // Real mm between consecutive points
    const toRealMm = (pxA, pxB) => feetToMm(Math.abs(pxB - pxA) / ftPx(1));

    const xMms = xPts.slice(0, -1).map((v, i) => toRealMm(v, xPts[i + 1]));
    const yMms = yPts.slice(0, -1).map((v, i) => toRealMm(v, yPts[i + 1]));

    const dimBaseY = oy - 20;
    const dimBaseX = ox - 20;

    dimElems.push(
      <ChainDimension key="h-chain" points={xPts} realMms={xMms} baseY={dimBaseY} offset={18} axis="h" color="#555" />,
      <ChainDimension key="v-chain" points={yPts} realMms={yMms} baseX={dimBaseX} offset={18} axis="v" color="#555" />,
    );

    // Overall dimensions
    const bW = plot.width - sb.left - sb.right;
    const bL = plot.length - sb.back - sb.front;
    dimElems.push(
      <OverallDimension key="h-overall"
        x1={ox + ftPx(sb.left)} y1={oy}
        x2={ox + ftPx(plot.width - sb.right)} y2={oy}
        realMm={feetToMm(bW)} offset={38} axis="h" color="#222" />,
      <OverallDimension key="v-overall"
        x1={ox} y1={oy + ftPx(sb.front)}
        x2={ox} y2={oy + ftPx(plot.length - sb.back)}
        realMm={feetToMm(bL)} offset={38} axis="v" color="#222" />,
    );

    // Plot overall
    dimElems.push(
      <OverallDimension key="plot-w"
        x1={ox} y1={oy} x2={ox + plotW} y2={oy}
        realMm={feetToMm(plot.width)} offset={56} axis="h" color="#888" />,
      <OverallDimension key="plot-h"
        x1={ox} y1={oy} x2={ox} y2={oy + plotH}
        realMm={feetToMm(plot.length)} offset={56} axis="v" color="#888" />,
    );
  }

  // ── Plot boundary ─────────────────────────────────────────────────────────
  const plotBorder = (
    <rect x={ox} y={oy} width={plotW} height={plotH}
      fill={layers.rooms ? '#FAFAFA' : 'none'}
      stroke="#333" strokeWidth={1.5} />
  );

  // ── Building boundary (buildable area outline) ────────────────────────────
  const bldBorder = (
    <rect
      x={ox + ftPx(sb.left)} y={oy + ftPx(sb.front)}
      width={ftPx(plot.width - sb.left - sb.right)}
      height={ftPx(plot.length - sb.front - sb.back)}
      fill="none" stroke="#2563EB" strokeWidth={1} strokeDasharray="4,2"
    />
  );

  // ── North arrow ───────────────────────────────────────────────────────────
  const northX = ox + plotW + 20;
  const northY = oy + 28;

  // ── Scale bar ─────────────────────────────────────────────────────────────
  const scaleBarX = ox;
  const scaleBarY = oy + plotH + 6;

  // ── Title block ───────────────────────────────────────────────────────────
  const tbX = ox + plotW + (svgW - ox - plotW - TB_W) / 2;
  const tbY = oy + plotH - TB_H;

  // ── Drawing frame ─────────────────────────────────────────────────────────
  const frameX = 4, frameY = 4;
  const frameW = svgW - 8, frameH = svgH - 8;

  return (
    <div className="relative w-full">
      {/* Controls bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 text-xs text-gray-300 rounded-t-lg">
        <span className="font-semibold text-white mr-1">Professional View</span>
        {/* Scale buttons */}
        {['1:50', '1:100', '1:200'].map(s => (
          <button key={s} onClick={() => handleScaleChange(s)}
            className={`px-2 py-0.5 rounded transition-colors ${s === scaleName ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
          >{s}</button>
        ))}
        <div className="flex-1" />
        {/* Layer toggle */}
        {showLayerPanel && (
          <button onClick={() => setShowLayers(v => !v)}
            className="px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600"
          >Layers {showLayers ? '▲' : '▼'}</button>
        )}
      </div>

      {/* Main drawing area */}
      <div className="relative bg-white overflow-auto border border-gray-200 rounded-b-lg">
        {showLayers && showLayerPanel && (
          <LayerPanel layers={layers} onChange={setLayers} />
        )}

        <svg
          ref={svgRef}
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          xmlns="http://www.w3.org/2000/svg"
          style={{ display: 'block', maxWidth: '100%' }}
        >
          <ArrowheadDef color="#555" />

          {/* White background */}
          <rect x={0} y={0} width={svgW} height={svgH} fill="#FFFFFF" />

          {/* Drawing frame (border lines) */}
          <rect x={frameX} y={frameY} width={frameW} height={frameH}
            fill="none" stroke="#333" strokeWidth={1} />
          <rect x={frameX + 3} y={frameY + 3} width={frameW - 6} height={frameH - 6}
            fill="none" stroke="#333" strokeWidth={0.4} />

          {/* Drawing title at top */}
          <text x={ox + plotW / 2} y={frameY + 12} fontSize={10} fontFamily="Arial"
            fontWeight="bold" fill="#111" textAnchor="middle">
            {floorLabel}
          </text>

          {/* Grid */}
          {gridLines}

          {/* Plot */}
          {plotBorder}

          {/* Setbacks */}
          {setbackElems}

          {/* Building boundary */}
          {bldBorder}

          {/* Room fills */}
          {roomFillElems}

          {/* Wall outlines + hatch */}
          {wallOutlines}

          {/* Doors */}
          {doorElems}

          {/* Windows */}
          {windowElems}

          {/* Dimension chains */}
          {dimElems}

          {/* North arrow */}
          <NorthArrow cx={northX} cy={northY} size={28} color="#222" />

          {/* Scale bar */}
          <g transform={`translate(${scaleBarX}, ${scaleBarY})`}>
            <ScaleBar scaleName={scaleName} segments={4} segmentMm={feetToMm(10)} color="#444" />
          </g>

          {/* Title block */}
          {layers.titleblock && (
            <TitleBlock
              x={tbX} y={tbY}
              projectName={projectName || plot.address || 'AutoArchitect Project'}
              drawingTitle={floorLabel}
              drawingNumber={drawingNumber}
              scale={scaleName}
              notes={[
                'All dimensions in feet-inches unless noted.',
                'Verify all dimensions on site before construction.',
                'Drawing not to be scaled.',
              ]}
            />
          )}
        </svg>
      </div>
    </div>
  );
}

/**
 * Export the SVG as a file
 */
export function exportProfessionalSVG(svgRef, filename = 'floor-plan.svg') {
  if (!svgRef?.current) return;
  const data = new XMLSerializer().serializeToString(svgRef.current);
  const blob = new Blob([data], { type: 'image/svg+xml' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
