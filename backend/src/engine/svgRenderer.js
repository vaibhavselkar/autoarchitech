'use strict';
/**
 * svgRenderer.js
 * Pure SVG renderer — takes rooms[] (with physics annotations) and returns SVG string.
 * All coordinates are in pixels. SCALE = 10px/ft.
 */

const SCALE = 10;

// ─── Color palette ─────────────────────────────────────────────────────────────
const COLORS = {
  living_room:    '#FFF9F0',
  living:         '#FFF9F0',
  dining:         '#F0FFF4',
  kitchen:        '#FFFDE7',
  master_bedroom: '#F3F0FF',
  bedroom:        '#F0F8FF',
  bathroom:       '#E0F7FA',
  balcony:        '#E8F5E9',
  parking:        '#F5F5F5',
  corridor:       '#FAFAFA',
  entry:          '#FFF3E0',
  default:        '#FFFFFF',
};

const STROKE = {
  outer:    '#1A1A1A',
  inner:    '#555555',
  door:     '#8B4513',
  window:   '#4FC3F7',
  platform: '#A1887F',
  fixture:  '#78909C',
  dim:      '#888888',
  north:    '#E53935',
};

const LABEL_COLORS = {
  living_room:    '#7B3F00',
  living:         '#7B3F00',
  dining:         '#1B5E20',
  kitchen:        '#F57F17',
  master_bedroom: '#4A148C',
  bedroom:        '#0D47A1',
  bathroom:       '#006064',
  balcony:        '#2E7D32',
  parking:        '#424242',
  entry:          '#E65100',
  default:        '#333333',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function ft(px) { return Math.round(px / SCALE * 10) / 10; }

function fill(type) { return COLORS[type] || COLORS.default; }
function labelColor(type) { return LABEL_COLORS[type] || LABEL_COLORS.default; }

// ─── Element renderers ─────────────────────────────────────────────────────────

function renderRoom(room) {
  const { x, y, w, h, type, label, id } = room;
  const f = fill(type);
  const lc = labelColor(type);

  const rects = [
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" `
    + `fill="${f}" stroke="${STROKE.inner}" stroke-width="1.5" />`
  ];

  // Label — centered, two lines: name + dimensions
  const cx = x + w / 2;
  const cy = y + h / 2;
  const dimLabel = `${ft(w)}' × ${ft(h)}'`;

  rects.push(
    `<text x="${cx}" y="${cy - 6}" text-anchor="middle" `
    + `font-family="Arial,sans-serif" font-size="10" font-weight="600" fill="${lc}">`
    + esc(label || id) + `</text>`,
    `<text x="${cx}" y="${cy + 9}" text-anchor="middle" `
    + `font-family="Arial,sans-serif" font-size="8" fill="${lc}" opacity="0.75">`
    + esc(dimLabel) + `</text>`
  );

  return rects.join('\n');
}

function renderDoor(door) {
  if (!door) return '';
  const { x1, y1, hingeX, hingeY, swingX, swingY, radius } = door;

  // Door line
  const line = `<line x1="${x1}" y1="${y1}" x2="${door.x2}" y2="${door.y2}" `
    + `stroke="${STROKE.door}" stroke-width="3" stroke-linecap="round"/>`;

  // Swing arc — quarter circle from hinge to swing point
  // Large-arc=0, sweep=1
  const arc = `<path d="M${hingeX},${hingeY} A${radius},${radius} 0 0,1 ${swingX},${swingY}" `
    + `fill="none" stroke="${STROKE.door}" stroke-width="1" stroke-dasharray="4,2" />`;

  return line + '\n' + arc;
}

function renderWindow(win, isRailing = false) {
  if (!win) return '';
  const { x1, y1, x2, y2 } = win;

  const isHorizontal = (y1 === y2);
  const dx = isHorizontal ? 0 : 3;
  const dy = isHorizontal ? 3 : 0;

  if (isRailing) {
    // Balcony railing — dashed line
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" `
      + `stroke="${STROKE.window}" stroke-width="3" stroke-dasharray="6,3"/>`;
  }

  // Three parallel lines for window symbol
  const lines = [-1, 0, 1].map(i =>
    `<line x1="${x1 + dx * i}" y1="${y1 + dy * i}" `
    + `x2="${x2 + dx * i}" y2="${y2 + dy * i}" `
    + `stroke="${STROKE.window}" stroke-width="${i === 0 ? 2.5 : 1}" />`
  );
  return lines.join('\n');
}

function renderPlatform(plat) {
  if (!plat) return '';
  return `<rect x="${plat.x}" y="${plat.y}" width="${plat.w}" height="${plat.h}" `
    + `fill="${STROKE.platform}" fill-opacity="0.25" stroke="${STROKE.platform}" stroke-width="1" />`;
}

function renderSink(sink) {
  if (!sink) return '';
  const r = 6;
  return `<circle cx="${sink.cx}" cy="${sink.cy}" r="${r}" `
    + `fill="none" stroke="${STROKE.fixture}" stroke-width="1.5" />`
    + `<line x1="${sink.cx - r}" y1="${sink.cy}" x2="${sink.cx + r}" y2="${sink.cy}" `
    + `stroke="${STROKE.fixture}" stroke-width="1" />`
    + `<line x1="${sink.cx}" y1="${sink.cy - r}" x2="${sink.cx}" y2="${sink.cy + r}" `
    + `stroke="${STROKE.fixture}" stroke-width="1" />`;
}

function renderWC(wc) {
  if (!wc) return '';
  const { x, y, w, h } = wc;
  // Toilet shape: rectangle with oval
  const cx = x + w / 2, cy = y + h / 2;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" `
    + `fill="white" stroke="${STROKE.fixture}" stroke-width="1.5" />`
    + `<ellipse cx="${cx}" cy="${cy}" rx="${w * 0.38}" ry="${h * 0.42}" `
    + `fill="none" stroke="${STROKE.fixture}" stroke-width="1" />`;
}

function renderBasin(basin) {
  if (!basin) return '';
  const { x, y, w, h } = basin;
  const cx = x + w / 2, cy = y + h / 2;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" `
    + `fill="white" stroke="${STROKE.fixture}" stroke-width="1.5" />`
    + `<circle cx="${cx}" cy="${cy}" r="4" fill="${STROKE.fixture}" />`;
}

function renderGate(gate) {
  if (!gate) return '';
  const { x1, y1, x2, y2 } = gate;
  // Gate = thick colored line + "GATE" label
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" `
    + `stroke="#E53935" stroke-width="5" stroke-linecap="round" />`
    + `<text x="${cx}" y="${cy - 6}" text-anchor="middle" `
    + `font-family="Arial,sans-serif" font-size="8" fill="#E53935" font-weight="700">GATE</text>`;
}

// ─── Outer walls ───────────────────────────────────────────────────────────────

function renderOuterWalls(totalW, totalH) {
  return `<rect x="0" y="0" width="${totalW}" height="${totalH}" `
    + `fill="none" stroke="${STROKE.outer}" stroke-width="4" />`;
}

// ─── Dimension chains ─────────────────────────────────────────────────────────

function renderDimensions(rooms, totalW, totalH) {
  const lines = [];
  const off = 18; // offset outside the drawing

  // Bottom dimension: full width
  lines.push(
    `<line x1="0" y1="${totalH + off}" x2="${totalW}" y2="${totalH + off}" `
    + `stroke="${STROKE.dim}" stroke-width="1" />`,
    `<text x="${totalW / 2}" y="${totalH + off + 12}" text-anchor="middle" `
    + `font-family="Arial,sans-serif" font-size="10" fill="${STROKE.dim}">`
    + `${ft(totalW)}'</text>`
  );

  // Right dimension: full height
  lines.push(
    `<line x1="${totalW + off}" y1="0" x2="${totalW + off}" y2="${totalH}" `
    + `stroke="${STROKE.dim}" stroke-width="1" />`,
    `<text x="${totalW + off + 12}" y="${totalH / 2}" text-anchor="middle" `
    + `font-family="Arial,sans-serif" font-size="10" fill="${STROKE.dim}" `
    + `transform="rotate(90,${totalW + off + 12},${totalH / 2})">`
    + `${ft(totalH)}'</text>`
  );

  return lines.join('\n');
}

// ─── North arrow ───────────────────────────────────────────────────────────────

function renderNorthArrow(x, y) {
  // Simple N arrow at position (x, y)
  return `<g transform="translate(${x},${y})">
    <circle r="18" fill="white" stroke="${STROKE.north}" stroke-width="1.5"/>
    <polygon points="0,-14 5,4 0,0 -5,4" fill="${STROKE.north}" />
    <text x="0" y="-16" text-anchor="middle" font-family="Arial,sans-serif"
      font-size="11" font-weight="700" fill="${STROKE.north}">N</text>
  </g>`;
}

// ─── Scale bar ────────────────────────────────────────────────────────────────

function renderScaleBar(x, y) {
  // 10ft scale bar
  const barW = 10 * SCALE; // 100px = 10ft
  return `<g transform="translate(${x},${y})">
    <rect x="0" y="0" width="${barW / 2}" height="6" fill="${STROKE.dim}" />
    <rect x="${barW / 2}" y="0" width="${barW / 2}" height="6" fill="white" stroke="${STROKE.dim}" stroke-width="1"/>
    <text x="0" y="16" font-family="Arial,sans-serif" font-size="8" fill="${STROKE.dim}">0</text>
    <text x="${barW / 2}" y="16" text-anchor="middle" font-family="Arial,sans-serif" font-size="8" fill="${STROKE.dim}">5'</text>
    <text x="${barW}" y="16" text-anchor="end" font-family="Arial,sans-serif" font-size="8" fill="${STROKE.dim}">10'</text>
  </g>`;
}

// ─── Title block ──────────────────────────────────────────────────────────────

function renderTitleBlock(x, y, planName, layoutType, engineerThinking) {
  const maxLen = 70;
  const thinking = engineerThinking
    ? engineerThinking.substring(0, maxLen) + (engineerThinking.length > maxLen ? '…' : '')
    : '';

  return `<g transform="translate(${x},${y})">
    <text x="0" y="0" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="#1A1A1A">${esc(planName || 'Floor Plan')}</text>
    <text x="0" y="16" font-family="Arial,sans-serif" font-size="9" fill="#555">${esc(layoutType || '')}</text>
    <text x="0" y="30" font-family="Arial,sans-serif" font-size="8" fill="#777" font-style="italic">${esc(thinking)}</text>
  </g>`;
}

// ─── Main render function ─────────────────────────────────────────────────────

/**
 * renderSVG(rooms, config) → SVG string
 *
 * rooms: array from physicsEnforcer (with x, y, w, h, _door, _window, etc.)
 * config: { buildableW, buildableH, planName, layoutType, engineerThinking, facing }
 */
function renderSVG(rooms, config = {}) {
  const {
    buildableW = 30,
    buildableH = 50,
    planName = 'Floor Plan',
    layoutType = '',
    engineerThinking = '',
  } = config;

  const totalW = buildableW * SCALE;
  const totalH = buildableH * SCALE;

  // SVG canvas with padding for dimensions + annotations
  const padTop    = 30;
  const padBottom = 60;
  const padLeft   = 20;
  const padRight  = 80;

  const svgW = totalW + padLeft + padRight;
  const svgH = totalH + padTop  + padBottom;

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" `
    + `width="${svgW}" height="${svgH}" `
    + `viewBox="0 0 ${svgW} ${svgH}" `
    + `style="background:#FAFAFA;font-family:Arial,sans-serif">`,

    // Main group shifted by padding
    `<g transform="translate(${padLeft},${padTop})">`,

    // Road label at top
    `<text x="${totalW / 2}" y="-8" text-anchor="middle" `
    + `font-family="Arial,sans-serif" font-size="10" fill="#888" letter-spacing="3">ROAD / FRONT</text>`,

    // 1. Room fills first
    ...rooms.map(r => renderRoom(r)),

    // 2. Outer walls on top of fills
    renderOuterWalls(totalW, totalH),

    // 3. Platforms (kitchen counters)
    ...rooms.filter(r => r._platform).map(r => renderPlatform(r._platform)),

    // 4. Fixtures (bathroom)
    ...rooms.filter(r => r._wc).map(r => renderWC(r._wc)),
    ...rooms.filter(r => r._basin).map(r => renderBasin(r._basin)),
    ...rooms.filter(r => r._sink).map(r => renderSink(r._sink)),

    // 5. Windows (before doors so doors overlay)
    ...rooms.filter(r => r._window).map(r =>
      renderWindow(r._window, r.type === 'balcony')
    ),

    // 6. Doors
    ...rooms.filter(r => r._door).map(r => renderDoor(r._door)),

    // 7. Gate (parking)
    ...rooms.filter(r => r._gate).map(r => renderGate(r._gate)),

    // Dimension chains
    renderDimensions(rooms, totalW, totalH),

    `</g>`,  // end main group

    // North arrow — top-right corner
    renderNorthArrow(svgW - 30, 28),

    // Scale bar — bottom-left
    renderScaleBar(padLeft, svgH - 30),

    // Title block — bottom center
    renderTitleBlock(padLeft + 120, svgH - 48, planName, layoutType, engineerThinking),

    `</svg>`,
  ];

  return parts.join('\n');
}

module.exports = { renderSVG };
