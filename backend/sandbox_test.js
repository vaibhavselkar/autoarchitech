'use strict';
/**
 * Sandbox test — generates a fallback plan and validates it.
 * Run: node backend/sandbox_test.js
 */

const { validatePlan } = require('./services/planValidator');
const { autoFix }      = require('./services/planAutoFixer');

const r2 = v => Math.round(v * 100) / 100;

// ── Mimic the real parsers ────────────────────────────────────────────────────
const plot = { width: 40, length: 60, facing: 'north',
  setback: { front: 6, back: 4, left: 4, right: 4 } };

const buildable = {
  x:      plot.setback.left,
  y:      plot.setback.back,
  width:  r2(plot.width  - plot.setback.left - plot.setback.right),
  length: r2(plot.length - plot.setback.back  - plot.setback.front),
};
const W = buildable.width;   // 32
const H = buildable.length;  // 50

// ── Fallback: linear layout ───────────────────────────────────────────────────
function buildLinearRooms() {
  const rooms = [];
  let y = 0;
  const balH = 5;
  rooms.push({ type: 'balcony',     x: 0, y, width: W, height: balH });
  y += balH;

  const livH = r2(Math.min(14, H * 0.22));
  rooms.push({ type: 'living_room', x: 0, y, width: W, height: livH });
  y += livH;

  const midH = r2(Math.min(11, H * 0.18));
  const dW   = r2(W * 0.5);
  rooms.push({ type: 'dining',  x: 0,  y, width: dW,       height: midH });
  rooms.push({ type: 'kitchen', x: dW, y, width: r2(W-dW), height: midH });
  y += midH;

  // private zone
  const remH = r2(H - y);
  const privRooms = [
    { type: 'master_bedroom' }, { type: 'bedroom' },
    { type: 'bathroom' },       { type: 'bathroom' },
  ];
  const COLS = Math.min(privRooms.length, 3);
  const ROWS = Math.ceil(privRooms.length / COLS);
  const colW = r2(W / COLS);
  const rowH = r2(remH / ROWS);
  privRooms.forEach((rm, idx) => {
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    rooms.push({ type: rm.type, x: r2(col*colW), y: r2(y + row*rowH), width: colW, height: rowH });
  });

  return rooms;
}

// ── Translate to PLOT coordinates ─────────────────────────────────────────────
function toPlotCoords(rooms) {
  return rooms.map(r => ({
    ...r,
    x:      r2(buildable.x + r.x),
    y:      r2(buildable.y + r.y),
    label:  r.type,
    floor:  1,
  }));
}

// ── Build layout object ────────────────────────────────────────────────────────
function buildLayout(rooms) {
  // Main door on front wall
  const doors = [
    { type: 'main', x: buildable.x + buildable.width * 0.5,
      y: buildable.y,  width: 6, height: 7 },
  ];
  return { plot, rooms, doors };
}

// ── Run test ───────────────────────────────────────────────────────────────────
console.log('='.repeat(60));
console.log('SANDBOX TEST — buildLinearRooms (3BHK, 40×60)');
console.log('='.repeat(60));
console.log(`Plot: ${plot.width}×${plot.length}ft  |  Buildable: ${W}×${H}ft`);
console.log(`Buildable origin: (${buildable.x}, ${buildable.y})`);
console.log('');

const rawRooms  = buildLinearRooms();
const plotRooms = toPlotCoords(rawRooms);
const layout    = buildLayout(plotRooms);

// Show rooms table
console.log('ROOMS (PLOT coords):');
console.log('  type'.padEnd(22) + 'x'.padEnd(8) + 'y'.padEnd(8) + 'w'.padEnd(8) + 'h'.padEnd(8) + 'area');
plotRooms.forEach(r => {
  console.log(
    ('  ' + r.type).padEnd(22) +
    String(r.x).padEnd(8) + String(r.y).padEnd(8) +
    String(r.width).padEnd(8) + String(r.height).padEnd(8) +
    Math.round(r.width * r.height) + ' sq.ft'
  );
});

console.log('');
const totalArea    = plotRooms.filter(r=>r.type!=='staircase'&&r.type!=='terrace').reduce((s,r)=>s+r.width*r.height,0);
const buildableArea = W * H;
console.log(`Total habitable area: ${Math.round(totalArea)} sq.ft`);
console.log(`Buildable area:       ${buildableArea} sq.ft`);
console.log(`Coverage:             ${Math.round(totalArea/buildableArea*100)}%`);

// Validate BEFORE autoFix
console.log('');
console.log('─'.repeat(60));
const v1 = validatePlan(layout);
console.log(`INITIAL SCORE: ${v1.score}/100  (isValid: ${v1.isValid})`);
if (v1.errors.length)   { console.log('\nERRORS:');   v1.errors.forEach(e=>console.log('  ✗', e.message)); }
if (v1.warnings.length) { console.log('\nWARNINGS:'); v1.warnings.forEach(w=>console.log('  ⚠', w.message)); }

// Try autoFix
if (!v1.isValid) {
  console.log('');
  console.log('─'.repeat(60));
  console.log('Attempting autoFix...');
  const fixed = autoFix(layout, v1.errors);
  if (fixed) {
    const v2 = validatePlan(fixed.plan);
    console.log(`POST-FIX SCORE: ${v2.score}/100  (isValid: ${v2.isValid})`);
    if (v2.errors.length)   { console.log('\nERRORS:');   v2.errors.forEach(e=>console.log('  ✗', e.message)); }
    if (v2.warnings.length) { console.log('\nWARNINGS:'); v2.warnings.forEach(w=>console.log('  ⚠', w.message)); }

    // Show fixed rooms
    console.log('');
    console.log('FIXED ROOMS:');
    console.log('  type'.padEnd(22) + 'x'.padEnd(8) + 'y'.padEnd(8) + 'w'.padEnd(8) + 'h'.padEnd(8) + 'area');
    fixed.plan.rooms.forEach(r => {
      console.log(
        ('  ' + r.type).padEnd(22) +
        String(r.x).padEnd(8) + String(r.y).padEnd(8) +
        String(r.width).padEnd(8) + String(r.height).padEnd(8) +
        Math.round(r.width * r.height) + ' sq.ft'
      );
    });
    const ta2 = fixed.plan.rooms.filter(r=>r.type!=='staircase'&&r.type!=='terrace').reduce((s,r)=>s+r.width*r.height,0);
    console.log(`Coverage after fix: ${Math.round(ta2/buildableArea*100)}%`);
  } else {
    console.log('autoFix returned null — plan is too broken to fix');
  }
}

console.log('');
console.log('='.repeat(60));
