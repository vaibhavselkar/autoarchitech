/**
 * WallModel.js — Wall objects with thickness, openings, hatch rendering
 * All dimensions in real-world mm. Use mmToPx() from units.js for screen coordinates.
 */

export const WALL_THICKNESS_MM = 230; // ~9 inches (standard load-bearing)
export const PARTITION_THICKNESS_MM = 115; // ~4.5 inches (non-structural)

/**
 * Build a wall segment list from a room definition (feet-based).
 * Returns an array of wall objects for the 4 sides of a room.
 *
 * @param {object} room - { x, y, width, height } in feet (plan coordinates)
 * @param {string} side - 'exterior' | 'interior'
 * @param {object} openings - { top: [...], bottom: [...], left: [...], right: [...] }
 *   Each opening: { position: mm from start of wall, width: mm, type: 'door'|'window' }
 * @param {function} ftToMm - converter from plan feet to mm (use feetToMm from units.js)
 */
export function buildRoomWalls(room, side = 'interior', openings = {}, ftToMm) {
  const toMm = ftToMm || (f => f * 304.8);
  const thickness = side === 'exterior' ? WALL_THICKNESS_MM : PARTITION_THICKNESS_MM;

  const x0 = toMm(room.x);
  const y0 = toMm(room.y);
  const rw = toMm(room.width);
  const rh = toMm(room.height);

  return [
    { id: `${room.type}-top`,    x1: x0,      y1: y0,      x2: x0 + rw, y2: y0,      axis: 'h', thickness, openings: openings.top    || [] },
    { id: `${room.type}-bottom`, x1: x0,      y1: y0 + rh, x2: x0 + rw, y2: y0 + rh, axis: 'h', thickness, openings: openings.bottom || [] },
    { id: `${room.type}-left`,   x1: x0,      y1: y0,      x2: x0,      y2: y0 + rh, axis: 'v', thickness, openings: openings.left   || [] },
    { id: `${room.type}-right`,  x1: x0 + rw, y1: y0,      x2: x0 + rw, y2: y0 + rh, axis: 'v', thickness, openings: openings.right  || [] },
  ];
}

/**
 * Render a single wall segment as SVG path elements.
 * Returns JSX-compatible SVG path data strings.
 *
 * @param {object} wall - wall segment from buildRoomWalls()
 * @param {function} mmToPxFn - mmToPx(mm) bound to current scale
 * @param {string} fillColor - hatch fill color (default '#444')
 */
export function renderWallSVG(wall, mmToPxFn, fillColor = '#444') {
  const t2 = mmToPxFn(wall.thickness / 2);
  const isH = wall.axis === 'h';

  // Outer and inner line coordinates
  const x1 = mmToPxFn(wall.x1);
  const y1 = mmToPxFn(wall.y1);
  const x2 = mmToPxFn(wall.x2);
  const y2 = mmToPxFn(wall.y2);

  let outerPath, innerPath, hatchPaths;

  if (isH) {
    // Horizontal wall: outer line above, inner below (or vice versa)
    outerPath = `M ${x1} ${y1 - t2} L ${x2} ${y2 - t2}`;
    innerPath = `M ${x1} ${y1 + t2} L ${x2} ${y2 + t2}`;
    hatchPaths = buildHatch45(x1, y1 - t2, x2 - x1, t2 * 2, mmToPxFn(80));
  } else {
    // Vertical wall
    outerPath = `M ${x1 - t2} ${y1} L ${x2 - t2} ${y2}`;
    innerPath = `M ${x1 + t2} ${y1} L ${x2 + t2} ${y2}`;
    hatchPaths = buildHatch45(x1 - t2, y1, t2 * 2, y2 - y1, mmToPxFn(80));
  }

  return { outerPath, innerPath, hatchPaths, fillColor };
}

/**
 * Generate 45° diagonal hatch lines within a rectangle (in px).
 * Returns array of path strings.
 */
export function buildHatch45(x, y, w, h, spacing = 6) {
  if (spacing < 1) spacing = 6;
  const paths = [];
  const total = w + h;
  for (let d = -h; d < w; d += spacing) {
    const x1 = x + Math.max(0, d);
    const y1 = y + Math.max(0, -d);
    const x2 = x + Math.min(w, d + h);
    const y2 = y + Math.min(h, h - d);
    if (Math.abs(x2 - x1) < 0.1 && Math.abs(y2 - y1) < 0.1) continue;
    paths.push(`M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`);
  }
  return paths;
}

/**
 * Generate the filled wall rect + hatch pattern for a room boundary.
 * Returns: { rectProps, hatchPaths }
 * Used by the SVG renderer to draw double-line hatched walls around rooms.
 *
 * @param {object} room - { x, y, width, height } in feet
 * @param {function} feetToPxFn - converts feet to px at current scale
 * @param {number} wallThicknessPx - wall thickness in px
 */
export function roomWallRects(room, feetToPxFn, wallThicknessPx) {
  const rx = feetToPxFn(room.x);
  const ry = feetToPxFn(room.y);
  const rw = feetToPxFn(room.width);
  const rh = feetToPxFn(room.height);
  const t = wallThicknessPx;

  // 4 wall rectangles: top, bottom, left, right
  const walls = [
    { x: rx - t, y: ry - t, w: rw + 2 * t, h: t },         // top
    { x: rx - t, y: ry + rh, w: rw + 2 * t, h: t },         // bottom
    { x: rx - t, y: ry,      w: t,          h: rh },         // left
    { x: rx + rw, y: ry,     w: t,          h: rh },         // right
  ];

  const hatchPaths = [];
  for (const w of walls) {
    hatchPaths.push(...buildHatch45(w.x, w.y, w.w, w.h, Math.max(3, t * 0.6)));
  }

  return { walls, hatchPaths };
}
