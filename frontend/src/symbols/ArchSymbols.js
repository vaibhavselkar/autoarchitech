/**
 * ArchSymbols.js — Architectural SVG symbol generators
 * All size parameters in pixels (already converted from mm/ft via mmToPx).
 */

import React from 'react';

/**
 * Door symbol: straight wall gap + quarter-circle swing arc
 * @param {number} x - hinge x (px)
 * @param {number} y - hinge y (px)
 * @param {number} size - door width (px)
 * @param {'right'|'left'|'up'|'down'} swing - which direction the door swings
 * @param {string} color
 */
export function DoorSymbol({ x, y, size, swing = 'right', color = '#222' }) {
  // Door leaf line + arc
  // Hinge at (x,y), door swings out
  let leafX2, leafY2, arcPath;

  switch (swing) {
    case 'right':
      leafX2 = x + size; leafY2 = y;
      arcPath = `M ${x + size} ${y} A ${size} ${size} 0 0 0 ${x} ${y + size}`;
      break;
    case 'left':
      leafX2 = x - size; leafY2 = y;
      arcPath = `M ${x - size} ${y} A ${size} ${size} 0 0 1 ${x} ${y + size}`;
      break;
    case 'up':
      leafX2 = x; leafY2 = y - size;
      arcPath = `M ${x} ${y - size} A ${size} ${size} 0 0 1 ${x + size} ${y}`;
      break;
    case 'down':
    default:
      leafX2 = x; leafY2 = y + size;
      arcPath = `M ${x} ${y + size} A ${size} ${size} 0 0 0 ${x + size} ${y}`;
      break;
  }

  return (
    <g>
      <line x1={x} y1={y} x2={leafX2} y2={leafY2} stroke={color} strokeWidth={1} />
      <path d={arcPath} stroke={color} strokeWidth={0.8} fill="none" strokeDasharray="2,1" />
    </g>
  );
}

/**
 * Window symbol: triple-line marker across wall gap
 * @param {number} x - start x of window gap
 * @param {number} y - wall y position
 * @param {number} size - window width
 * @param {'h'|'v'} axis - horizontal or vertical wall
 * @param {number} wallThickness - px
 * @param {string} color
 */
export function WindowSymbol({ x, y, size, axis = 'h', wallThickness = 6, color = '#222' }) {
  const t = wallThickness;
  const mid = t / 2;

  if (axis === 'h') {
    return (
      <g>
        {/* outer line */}
        <line x1={x} y1={y - t} x2={x + size} y2={y - t} stroke={color} strokeWidth={1} />
        {/* glass pane (thicker center line) */}
        <line x1={x} y1={y - mid} x2={x + size} y2={y - mid} stroke={color} strokeWidth={1.5} />
        {/* inner line */}
        <line x1={x} y1={y} x2={x + size} y2={y} stroke={color} strokeWidth={1} />
      </g>
    );
  }

  return (
    <g>
      <line x1={x - t} y1={y} x2={x - t} y2={y + size} stroke={color} strokeWidth={1} />
      <line x1={x - mid} y1={y} x2={x - mid} y2={y + size} stroke={color} strokeWidth={1.5} />
      <line x1={x} y1={y} x2={x} y2={y + size} stroke={color} strokeWidth={1} />
    </g>
  );
}

/**
 * Stair symbol: parallel lines with arrow indicating ascent direction
 */
export function SingleStairSymbol({ x, y, width, height, steps = 8, color = '#444' }) {
  const lines = [];
  for (let i = 0; i <= steps; i++) {
    const yy = y + (i / steps) * height;
    lines.push(<line key={i} x1={x} y1={yy} x2={x + width} y2={yy} stroke={color} strokeWidth={0.6} />);
  }
  // Arrow pointing up (ascent)
  const ax = x + width / 2;
  lines.push(
    <line key="arrow" x1={ax} y1={y + height * 0.8} x2={ax} y2={y + height * 0.1} stroke={color} strokeWidth={1} markerEnd="url(#arrowhead)" />,
    <text key="up" x={ax + 3} y={y + height * 0.5} fontSize={6} fontFamily="Arial" fill={color}>UP</text>
  );
  return <g>{lines}</g>;
}

/**
 * North Arrow symbol
 */
export function NorthArrow({ cx, cy, size = 24, color = '#222' }) {
  const r = size / 2;
  return (
    <g transform={`translate(${cx},${cy})`}>
      {/* circle */}
      <circle r={r} fill="none" stroke={color} strokeWidth={1} />
      {/* N arrow — filled half */}
      <polygon points={`0,${-r} ${-r * 0.35},${r * 0.5} 0,${r * 0.2}`} fill={color} />
      <polygon points={`0,${-r} ${r * 0.35},${r * 0.5} 0,${r * 0.2}`} fill="none" stroke={color} strokeWidth={0.8} />
      {/* N label */}
      <text y={-r - 3} fontSize={8} fontFamily="Arial" fontWeight="bold" fill={color} textAnchor="middle">N</text>
    </g>
  );
}

/**
 * Toilet symbol (top-view)
 */
export function ToiletSymbol({ x, y, width, height, color = '#444' }) {
  const cx = x + width / 2;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height * 0.35} rx={2} fill="none" stroke={color} strokeWidth={0.8} />
      <ellipse cx={cx} cy={y + height * 0.7} rx={width * 0.45} ry={height * 0.28} fill="none" stroke={color} strokeWidth={0.8} />
      <ellipse cx={cx} cy={y + height * 0.72} rx={width * 0.3} ry={height * 0.18} fill="none" stroke={color} strokeWidth={0.5} />
    </g>
  );
}

/**
 * Washbasin symbol (top-view)
 */
export function WashbasinSymbol({ x, y, size, color = '#444' }) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  return (
    <g>
      <rect x={x} y={y} width={size} height={size} rx={size * 0.2} fill="none" stroke={color} strokeWidth={0.8} />
      <circle cx={cx} cy={cy} r={size * 0.2} fill="none" stroke={color} strokeWidth={0.6} />
    </g>
  );
}

/**
 * Parking Space symbol
 */
export function ParkingSpaceSymbol({ x, y, width, height, color = '#444' }) {
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill="none" stroke={color} strokeWidth={0.8} />
      <text
        x={x + width / 2}
        y={y + height / 2 + 4}
        fontSize={Math.min(width, height) * 0.4}
        fontFamily="Arial"
        fontWeight="bold"
        fill={color}
        textAnchor="middle"
      >P</text>
    </g>
  );
}

/**
 * Column symbol (filled square or circle)
 */
export function ColumnSymbol({ cx, cy, size = 8, shape = 'square', color = '#222' }) {
  if (shape === 'circle') {
    return <circle cx={cx} cy={cy} r={size / 2} fill={color} />;
  }
  return <rect x={cx - size / 2} y={cy - size / 2} width={size} height={size} fill={color} />;
}

/**
 * Arrowhead marker definition — include once in SVG <defs>
 */
export function ArrowheadDef({ color = '#222' }) {
  return (
    <defs>
      <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="3" refY="2" orient="auto">
        <polygon points="0 0, 6 2, 0 4" fill={color} />
      </marker>
      <marker id="dim-tick" markerWidth="4" markerHeight="6" refX="2" refY="3" orient="auto">
        <line x1="2" y1="0" x2="2" y2="6" stroke={color} strokeWidth="0.8" />
      </marker>
    </defs>
  );
}
