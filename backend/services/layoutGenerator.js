'use strict';

/**
 * AutoArchitect — Natural-Size Floor Plan Generator  v4.0
 *
 * Core principle:
 *   Rooms are placed at their AI-designed (natural) sizes.
 *   Rows are then scaled uniformly to fill the buildable area.
 *   No room is ever arbitrarily stretched to fill a zone fraction.
 *
 * Coordinate system:
 *   x grows RIGHT,  y grows DOWN (road is at the top / y=0 side).
 *   "front" = road side = small y,  "back" = garden side = large y.
 */

const { validatePlan } = require('../../shared/plan-schema');
const geminiService    = require('./geminiService');

// ─── Hard limits ─────────────────────────────────────────────────────────────

const ROOM_MIN = {
  living_room:    { w: 13, h: 12 },
  dining:         { w: 11, h: 10 },
  kitchen:        { w: 10, h: 10 },
  master_bedroom: { w: 13, h: 12 },
  bedroom:        { w: 11, h: 10 },
  bathroom:       { w:  6, h:  8 },   // absolute minimum — never smaller
  study:          { w: 10, h: 10 },
  balcony:        { w:  8, h:  5 },
  terrace:        { w:  8, h:  8 },
  prayer_room:    { w:  8, h:  8 },
  guest_room:     { w: 11, h: 10 },
  utility_room:   { w:  6, h:  8 },
};

const ROOM_MAX = {
  living_room:    { w: 22, h: 18 },
  dining:         { w: 16, h: 13 },
  kitchen:        { w: 14, h: 12 },
  master_bedroom: { w: 16, h: 15 },
  bedroom:        { w: 14, h: 13 },
  bathroom:       { w:  9, h: 10 },  // bathroom NEVER taller than 10 ft
  study:          { w: 13, h: 12 },
  balcony:        { w: 30, h:  6 },
  terrace:        { w: 20, h: 12 },
  prayer_room:    { w: 12, h: 10 },
  guest_room:     { w: 14, h: 12 },
  utility_room:   { w: 10, h: 10 },
};

const DOOR_W  = 3;
const PARK_W  = 9;
const PARK_L  = 18;
const CORR_W  = 3.5;   // compact layout corridor width

// ─── Public API ───────────────────────────────────────────────────────────────

async function generateLayout(plot, requirements, preferences = {}) {
  const [layout] = await generateLayoutVariations(plot, requirements, preferences, 1);
  return layout;
}

async function generateLayoutVariations(plot, requirements, preferences = {}, variations = 5) {
  const plotData  = parsePlot(plot);
  const req       = parseRequirements(requirements);
  const prefs     = parsePreferences(preferences);
  const buildable = getBuildable(plotData);

  // ── AI generates ALL plans — no static fallback ───────────────────────────
  let aiLayouts = null;
  try {
    aiLayouts = await geminiService.generateRoomPlacements(plot, requirements, preferences, variations);
  } catch (err) {
    throw new Error(`AI plan generation failed: ${err.message}`);
  }

  if (!aiLayouts || aiLayouts.length === 0) {
    throw new Error('AI returned no plans. Please check your GEMINI_API_KEY and try again.');
  }

  const results = [];
  for (let i = 0; i < Math.min(aiLayouts.length, variations); i++) {
    const ai = aiLayouts[i];
    if (ai.rooms && ai.rooms.length > 0) {
      resolveOverlaps(ai.rooms, buildable);
      if (validateAIRooms(ai.rooms, buildable)) {
        const fixedRooms = enforceRoomCounts(ai.rooms, req, buildable);
        resolveOverlaps(fixedRooms, buildable);
        results.push(buildVariationFromAIRooms(plotData, prefs, buildable, { ...ai, rooms: fixedRooms }, i));
      } else {
        console.warn(`AI variation ${i + 1} failed validation — skipping`);
      }
    }
  }

  if (results.length === 0) {
    throw new Error('AI plans did not pass validation. Please try again.');
  }

  return results;
}

// ── Ensure AI rooms exactly match user requirements ───────────────────────────
function enforceRoomCounts(rooms, req, buildable) {
  const result = [...rooms];
  const count  = (type) => result.filter(r => r.type === type).length;

  const bW = buildable.width, bH = buildable.length;

  // Helper: add a room if missing (place at a rough position, AI will have placed better ones)
  const addRoom = (type, w, h) => {
    // Find a y position near the rear that is not occupied
    const usedY = result.map(r => r.y + r.height);
    const maxY  = Math.max(0, ...usedY);
    const x = Math.min(result.length % 2 === 0 ? 0 : Math.floor(bW / 2), bW - w);
    const y = Math.min(maxY, bH - h);
    result.push({ type, x: Math.max(0, x), y: Math.max(0, y), width: w, height: h });
  };

  // Bathrooms
  const wantedBaths = parseInt(req.bathrooms || 2);
  const hasBaths    = count('bathroom');
  if (hasBaths < wantedBaths) {
    for (let i = hasBaths; i < wantedBaths; i++) addRoom('bathroom', 7, 9);
  } else if (hasBaths > wantedBaths) {
    let removed = 0;
    for (let i = result.length - 1; i >= 0 && removed < hasBaths - wantedBaths; i--) {
      if (result[i].type === 'bathroom') { result.splice(i, 1); removed++; }
    }
  }

  // Bedrooms (total = master + regular)
  const wantedBeds = parseInt(req.bedrooms || 2);
  const hasMaster  = count('master_bedroom');
  const hasRegular = count('bedroom');
  const hasTotalBeds = hasMaster + hasRegular;

  if (hasMaster === 0 && wantedBeds >= 1) addRoom('master_bedroom', 14, 13);
  const wantedRegular = Math.max(0, wantedBeds - 1);
  const diffRegular   = wantedRegular - count('bedroom');
  if (diffRegular > 0) {
    for (let i = 0; i < diffRegular; i++) addRoom('bedroom', 12, 11);
  } else if (diffRegular < 0) {
    let removed = 0;
    for (let i = result.length - 1; i >= 0 && removed < -diffRegular; i--) {
      if (result[i].type === 'bedroom') { result.splice(i, 1); removed++; }
    }
  }

  return result;
}

// ─── Auto-resolve room overlaps by pushing rooms apart ────────────────────────

function resolveOverlaps(rooms, buildable) {
  const W = buildable.width, H = buildable.length;
  const MAX_ITER = 30;

  for (let iter = 0; iter < MAX_ITER; iter++) {
    let anyOverlap = false;

    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const a = rooms[i], b = rooms[j];

        const ox = Math.min(a.x + a.width,  b.x + b.width)  - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);

        if (ox <= 0.3 || oy <= 0.3) continue;   // touching walls are fine
        anyOverlap = true;

        // Resolve along the axis with smaller penetration
        if (ox <= oy) {
          const push = ox / 2 + 0.3;
          if (a.x + a.width / 2 <= b.x + b.width / 2) {
            a.x = Math.max(0, a.x - push);
            b.x = Math.min(W - b.width, b.x + push);
          } else {
            a.x = Math.min(W - a.width, a.x + push);
            b.x = Math.max(0, b.x - push);
          }
        } else {
          const push = oy / 2 + 0.3;
          if (a.y + a.height / 2 <= b.y + b.height / 2) {
            a.y = Math.max(0, a.y - push);
            b.y = Math.min(H - b.height, b.y + push);
          } else {
            a.y = Math.min(H - a.height, a.y + push);
            b.y = Math.max(0, b.y - push);
          }
        }
      }
    }

    if (!anyOverlap) break;
  }

  // Final bounds clamp
  for (const r of rooms) {
    r.x = Math.max(0, Math.min(W - r.width,  r2(r.x)));
    r.y = Math.max(0, Math.min(H - r.height, r2(r.y)));
  }

  return rooms;
}

// ─── Validate AI-provided rooms ───────────────────────────────────────────────

function validateAIRooms(rooms, buildable) {
  if (!Array.isArray(rooms) || rooms.length < 2) return false;
  const W = buildable.width, H = buildable.length;

  for (const r of rooms) {
    if (!ROOM_LABELS[r.type])          return false;   // unknown type
    if (r.width < 3 || r.height < 3)  return false;   // too small
    if (r.x < -1 || r.y < -1)         return false;   // out of bounds left/top
    if (r.x + r.width  > W + 1)       return false;   // out of bounds right
    if (r.y + r.height > H + 1)       return false;   // out of bounds bottom
  }

  // Check for significant overlaps (2ft tolerance — allows shared walls + rounding)
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i], b = rooms[j];
      const ox = Math.min(a.x + a.width,  b.x + b.width)  - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      if (ox > 2 && oy > 2) {
        console.log(`AI overlap remaining after fix: ${a.type} and ${b.type} (${ox.toFixed(1)}×${oy.toFixed(1)}ft)`);
        return false;
      }
    }
  }
  return true;
}

// ─── Build layout from AI-provided room coordinates ───────────────────────────

function buildVariationFromAIRooms(plotData, prefs, buildable, aiData, index) {
  // Translate rooms from buildable-relative to absolute plot coordinates
  const rooms = aiData.rooms.map(r => ({
    type:   r.type,
    x:      r2(Math.max(0, buildable.x + r.x)),
    y:      r2(Math.max(0, buildable.y + r.y)),
    width:  r2(Math.max(1, r.width)),
    height: r2(Math.max(1, r.height)),
    label:  ROOM_LABELS[r.type] || r.type,
    floor:  1,
  }));

  const doors      = generateDoors(rooms, plotData, buildable, prefs);
  const windows    = generateWindows(rooms, buildable);
  const walls      = generateWalls(rooms, plotData);
  const staircase  = placeStaircase(buildable, 'corner');
  const parking    = placeParking(plotData, buildable, prefs.parking);
  const setbackZones = buildSetbackZones(plotData);

  const layout = {
    plot: plotData, rooms, walls, doors, windows,
    staircase, parking, setbackZones,
    dimensions: buildDimensions(plotData),
    metadata: {
      version: 4,
      generatedAt: new Date().toISOString(),
      generator: 'ai-placement',   // Gemini produced the coordinates
      theme:       aiData.designTheme || `AI Plan ${index + 1}`,
      description: aiData.description || '',
      layoutStyle: aiData.layoutStyle || 'ai-generated',
      constraints: { minRoomSize: ROOM_MIN, setbacks: plotData.setback }
    }
  };

  const { isValid, errors } = validatePlan(layout);
  if (!isValid) console.warn('AI layout validation warnings:', errors);
  return layout;
}
const ROOM_LABELS = {
  living_room: 'Living Room', dining: 'Dining', kitchen: 'Kitchen',
  master_bedroom: 'Master Bed', bedroom: 'Bedroom', bathroom: 'Bathroom',
  study: 'Study', balcony: 'Balcony', terrace: 'Terrace',
  prayer_room: 'Prayer Room', guest_room: 'Guest Room', utility_room: 'Utility',
};

// ─── Shared helpers ───────────────────────────────────────────────────────────

const r2 = v => Math.round(v * 100) / 100;

function parsePlot(plot) {
  const width  = parseFloat(plot.width  || plot.plotWidth  || 30);
  const length = parseFloat(plot.length || plot.plotLength || 40);
  const facing = (plot.facing || 'north').toLowerCase();
  const setback = {
    front: parseFloat(plot.setback?.front ?? plot.frontSetback ?? 6),
    back:  parseFloat(plot.setback?.back  ?? plot.backSetback  ?? 4),
    left:  parseFloat(plot.setback?.left  ?? plot.leftSetback  ?? 4),
    right: parseFloat(plot.setback?.right ?? plot.rightSetback ?? 4),
  };
  return { width, length, facing, setback };
}

function parseRequirements(req) {
  return {
    bedrooms:     parseInt(req.bedrooms     ?? req.numBedrooms  ?? 2),
    bathrooms:    parseInt(req.bathrooms    ?? req.numBathrooms ?? 2),
    living_room:  req.living_room  !== false ? 1 : 0,
    dining:       req.dining       !== false ? 1 : 0,
    kitchen:      req.kitchen      !== false ? 1 : 0,
    balcony:      req.balcony      !== false ? 1 : 0,
    study:        parseInt(req.study        ?? 0),
    prayer_room:  req.prayer_room  ? 1 : 0,
    guest_room:   parseInt(req.guest_room   ?? 0),
    utility_room: parseInt(req.utility_room ?? 0),
  };
}

function parsePreferences(prefs = {}) {
  return {
    vastu:   prefs.vastu   || false,
    parking: prefs.parking || { cars: 1, gate_direction: 'left' },
    style:   prefs.style   || 'modern',
  };
}

function getBuildable(plotData) {
  const sb = plotData.setback;
  return {
    x:      sb.left,
    y:      sb.back,
    width:  r2(plotData.width  - sb.left - sb.right),
    length: r2(plotData.length - sb.back - sb.front),
  };
}

// ─── Door generation ──────────────────────────────────────────────────────────

function generateDoors(rooms, plotData, buildable, prefs) {
  const doors = [];
  const byType = {};
  rooms.forEach(r => { (byType[r.type] = byType[r.type] || []).push(r); });

  // shared-wall helpers
  const sharedH = (r1, r2) => {
    const sy = Math.abs((r1.y + r1.height) - r2.y) < 1 ? r1.y + r1.height : null;
    if (!sy) return null;
    const l = Math.max(r1.x, r2.x), ri = Math.min(r1.x + r1.width, r2.x + r2.width);
    if (ri - l < DOOR_W + 0.5) return null;
    return { x: l + (ri - l) / 2 - DOOR_W / 2, y: sy };
  };
  const sharedV = (r1, r2) => {
    const sx = Math.abs((r1.x + r1.width) - r2.x) < 1 ? r1.x + r1.width : null;
    if (!sx) return null;
    const t = Math.max(r1.y, r2.y), b = Math.min(r1.y + r1.height, r2.y + r2.height);
    if (b - t < DOOR_W + 0.5) return null;
    return { x: sx, y: t + (b - t) / 2 - DOOR_W / 2 };
  };
  const findShared = (a, b) => sharedH(a,b)||sharedH(b,a)||sharedV(a,b)||sharedV(b,a);

  // 1. Main entry door on front wall
  const parkSide = prefs.parking?.gate_direction || 'left';
  const mainDoorX = parkSide === 'right'   ? buildable.x + buildable.width * 0.25
                  : parkSide === 'center'  ? buildable.x + buildable.width * 0.5 - 2
                  :                          buildable.x + buildable.width * 0.65;
  doors.push({ x: mainDoorX, y: buildable.y, width: 4, height: 7, orientation: 'horizontal', type: 'main', label: 'ENTRY' });

  // 2. Balcony ↔ Living sliding door
  (byType['balcony']||[]).forEach(bal => (byType['living_room']||[]).forEach(liv => {
    const pt = sharedH(bal, liv);
    if (pt) doors.push({ x: pt.x, y: pt.y, width: DOOR_W, height: 7, orientation: 'horizontal', type: 'sliding' });
  }));

  // 3. Living ↔ Dining
  (byType['living_room']||[]).forEach(liv => (byType['dining']||[]).forEach(din => {
    const pt = findShared(liv, din);
    if (pt) {
      const isV = !!(sharedV(liv,din)||sharedV(din,liv));
      doors.push({ x: pt.x, y: pt.y, width: DOOR_W, height: 7, orientation: isV?'vertical':'horizontal', type: 'room' });
    }
  }));

  // 4. Dining ↔ Kitchen
  (byType['dining']||[]).forEach(din => (byType['kitchen']||[]).forEach(kit => {
    const pt = findShared(din, kit);
    if (pt) {
      const isV = !!(sharedV(din,kit)||sharedV(kit,din));
      doors.push({ x: pt.x, y: pt.y, width: DOOR_W, height: 7, orientation: isV?'vertical':'horizontal', type: 'room' });
    }
  }));

  // 5. Bedroom ↔ Bathroom (en-suite)
  ['master_bedroom','bedroom','guest_room'].forEach(bt =>
    (byType['bathroom']||[]).forEach(bath => (byType[bt]||[]).forEach(bed => {
      const pt = findShared(bed, bath);
      if (pt) {
        const isV = !!(sharedV(bed,bath)||sharedV(bath,bed));
        doors.push({ x: pt.x, y: pt.y, width: 2.5, height: 7, orientation: isV?'vertical':'horizontal', type: 'bathroom' });
      }
    }))
  );

  // 6. Passage door on every private room
  ['master_bedroom','bedroom','study','guest_room','prayer_room','utility_room'].forEach(bt =>
    (byType[bt]||[]).forEach(r =>
      doors.push({ x: r.x + r.width * 0.3, y: r.y, width: DOOR_W, height: 7, orientation: 'horizontal', type: 'room' })
    )
  );

  // 7. Guarantee every room has at least one door
  rooms.forEach(r => {
    const TOL = 1.5;
    const hasDoor = doors.some(d => {
      const onFront = Math.abs(d.y - r.y) < TOL              && d.x >= r.x - TOL && d.x < r.x + r.width;
      const onBack  = Math.abs(d.y - (r.y + r.height)) < TOL && d.x >= r.x - TOL && d.x < r.x + r.width;
      const onLeft  = Math.abs(d.x - r.x) < TOL              && d.y >= r.y - TOL && d.y < r.y + r.height;
      const onRight = Math.abs(d.x - (r.x + r.width)) < TOL  && d.y >= r.y - TOL && d.y < r.y + r.height;
      return onFront || onBack || onLeft || onRight;
    });
    if (!hasDoor) {
      doors.push({ x: r.x + r.width * 0.3, y: r.y, width: r.type === 'bathroom' ? 2.5 : DOOR_W, height: 7, orientation: 'horizontal', type: 'room' });
    }
  });

  return doors;
}

// ─── Window generation ────────────────────────────────────────────────────────

function generateWindows(rooms, buildable) {
  const windows = [];
  rooms.forEach(r => {
    const onFront = Math.abs(r.y - buildable.y) < 1;
    const onBack  = Math.abs(r.y + r.height - (buildable.y + buildable.length)) < 1;
    const onLeft  = Math.abs(r.x - buildable.x) < 1;
    const onRight = Math.abs(r.x + r.width - (buildable.x + buildable.width)) < 1;
    if (onFront && r.type !== 'bathroom')
      windows.push({ x: r.x + r.width * 0.3, y: r.y, width: 3, height: 4, orientation: 'horizontal', wall: 'front' });
    if (onBack && !['bathroom','utility_room'].includes(r.type))
      windows.push({ x: r.x + r.width * 0.5, y: r.y + r.height, width: 3, height: 4, orientation: 'horizontal', wall: 'back' });
    if (onLeft)
      windows.push({ x: r.x, y: r.y + r.height * 0.4, width: 2.5, height: 4, orientation: 'vertical', wall: 'left' });
    if (onRight)
      windows.push({ x: r.x + r.width, y: r.y + r.height * 0.4, width: 2.5, height: 4, orientation: 'vertical', wall: 'right' });
  });
  return windows;
}

// ─── Wall generation ──────────────────────────────────────────────────────────

function generateWalls(rooms, plotData) {
  const sb = plotData.setback;
  const walls = [
    { x1: sb.left, y1: sb.back, x2: plotData.width - sb.right, y2: sb.back, type: 'exterior' },
    { x1: plotData.width - sb.right, y1: sb.back, x2: plotData.width - sb.right, y2: plotData.length - sb.front, type: 'exterior' },
    { x1: sb.left, y1: plotData.length - sb.front, x2: plotData.width - sb.right, y2: plotData.length - sb.front, type: 'exterior' },
    { x1: sb.left, y1: sb.back, x2: sb.left, y2: plotData.length - sb.front, type: 'exterior' },
  ];
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i], b = rooms[j];
      if (Math.abs((a.y + a.height) - b.y) < 0.5) {
        const x1 = Math.max(a.x, b.x), x2 = Math.min(a.x + a.width, b.x + b.width);
        if (x2 > x1 + 0.5) walls.push({ x1, y1: b.y, x2, y2: b.y, type: 'interior' });
      }
      if (Math.abs((a.x + a.width) - b.x) < 0.5) {
        const y1 = Math.max(a.y, b.y), y2 = Math.min(a.y + a.height, b.y + b.height);
        if (y2 > y1 + 0.5) walls.push({ x1: b.x, y1, x2: b.x, y2, type: 'interior' });
      }
    }
  }
  return walls;
}

// ─── Staircase, Parking, Setback zones, Dimensions ───────────────────────────

function placeStaircase(buildable) {
  return { x: buildable.x + buildable.width - 8, y: buildable.y + buildable.length - 10, width: 8, height: 10, type: 'staircase' };
}

function placeParking(plotData, buildable, parkPrefs = {}) {
  const cars = parseInt(parkPrefs.cars || 1);
  const dir  = parkPrefs.gate_direction || 'left';
  const w    = r2(PARK_W * cars);
  const x    = dir === 'right' ? plotData.width - w - plotData.setback.right : plotData.setback.left;
  return { x: r2(x), y: 0, width: w, height: PARK_L, cars, gate_direction: dir };
}

function buildSetbackZones(plotData) {
  const sb = plotData.setback;
  return [
    { x: 0, y: 0, width: plotData.width, height: sb.back, label: 'Front Setback', zone: 'front' },
    { x: 0, y: plotData.length - sb.front, width: plotData.width, height: sb.front, label: 'Rear Setback', zone: 'rear' },
    { x: 0, y: sb.back, width: sb.left, height: plotData.length - sb.back - sb.front, label: 'Left Setback', zone: 'left' },
    { x: plotData.width - sb.right, y: sb.back, width: sb.right, height: plotData.length - sb.back - sb.front, label: 'Right Setback', zone: 'right' },
  ];
}

function buildDimensions(plotData) {
  const sb = plotData.setback;
  return {
    overall:   { width: plotData.width, length: plotData.length },
    buildable: { width: r2(plotData.width - sb.left - sb.right), length: r2(plotData.length - sb.back - sb.front) },
    setbacks:  sb,
  };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  generateLayout,
  generateLayoutVariations,
  MIN_ROOM_SIZES: ROOM_MIN,
  ROOM_ADJACENCY_RULES: {},
  STANDARDS: { corridor_width: CORR_W, wall_thickness: 0.3, door_width: DOOR_W, parking_width: PARK_W, parking_length: PARK_L }
};
