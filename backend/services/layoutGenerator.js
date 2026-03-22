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

// ── Set to false to re-enable rule-based fallback plans ──────────────────────
const AI_ONLY = process.env.AI_ONLY !== 'false';

async function generateLayoutVariations(plot, requirements, preferences = {}, variations = 5) {
  const plotData  = parsePlot(plot);
  const req       = parseRequirements(requirements);
  const prefs     = parsePreferences(preferences);
  const buildable = getBuildable(plotData);

  // ── AI-FIRST: Gemini provides full room coordinates ───────────────────────
  let aiLayouts = null;
  try {
    aiLayouts = await geminiService.generateRoomPlacements(plot, requirements, preferences, variations);
  } catch (_) { /* fall through */ }

  if (aiLayouts && aiLayouts.length > 0) {
    const results = [];
    for (let i = 0; i < Math.min(aiLayouts.length, variations); i++) {
      const ai = aiLayouts[i];
      if (ai.rooms && ai.rooms.length > 0 && validateAIRooms(ai.rooms, buildable)) {
        // Patch room counts to exactly match requirements
        const fixedRooms = enforceRoomCounts(ai.rooms, req, buildable);
        results.push(buildVariationFromAIRooms(plotData, prefs, buildable, { ...ai, rooms: fixedRooms }, i));
      } else if (!AI_ONLY) {
        console.log(`AI variation ${i + 1} failed validation — using rule-based fallback`);
        results.push(buildVariationRuleBased(plotData, req, prefs, buildable, defaultParams(1, i)[0], i));
      }
      // In AI_ONLY mode: skip invalid variations (don't pad with identical rule-based plans)
    }

    if (results.length > 0) return results;
  }

  // ── Fallback: rule-based ───────────────────────────────────────────────────
  // Used when: AI_ONLY=false  OR  Gemini is unavailable (bad key, quota, timeout)
  let aiParams = null;
  try {
    aiParams = await geminiService.generateDesignParameters(plot, requirements, preferences, variations);
  } catch (_) {}
  if (!aiParams || aiParams.length === 0) aiParams = defaultParams(variations);
  while (aiParams.length < variations) aiParams.push(defaultParams(1, aiParams.length)[0]);
  return aiParams.slice(0, variations).map((params, i) =>
    buildVariationRuleBased(plotData, req, prefs, buildable, params, i)
  );
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

// ─── Validate AI-provided rooms ───────────────────────────────────────────────

function validateAIRooms(rooms, buildable) {
  if (!Array.isArray(rooms) || rooms.length < 2) return false;
  const W = buildable.width, H = buildable.length;

  for (const r of rooms) {
    if (!ROOM_LABELS[r.type])           return false;   // unknown type
    if (r.width < 3 || r.height < 3)   return false;   // too small
    if (r.x < -0.5 || r.y < -0.5)      return false;   // out of bounds left/top
    if (r.x + r.width  > W + 0.5)      return false;   // out of bounds right
    if (r.y + r.height > H + 0.5)      return false;   // out of bounds bottom
  }

  // Check for overlaps (1ft tolerance for shared walls)
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i], b = rooms[j];
      const overlapX = a.x + a.width  - 1 > b.x && b.x + b.width  - 1 > a.x;
      const overlapY = a.y + a.height - 1 > b.y && b.y + b.height - 1 > a.y;
      if (overlapX && overlapY) {
        console.log(`AI overlap: ${a.type} and ${b.type}`);
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

// ─── Build one variation using rule-based engine (fallback) ───────────────────

function buildVariationRuleBased(plotData, req, prefs, buildable, aiParams, index) {
  const sizes = mergeSizes(aiParams.roomSizes || {});
  const style = aiParams.layoutStyle || 'linear';
  const feats = aiParams.features    || {};

  const rooms      = placeRooms(req, prefs, buildable, sizes, style, feats);
  const doors      = generateDoors(rooms, plotData, buildable, prefs);
  const windows    = generateWindows(rooms, buildable);
  const walls      = generateWalls(rooms, plotData);
  const staircase  = placeStaircase(buildable, feats.staircasePosition);
  const parking    = placeParking(plotData, buildable, prefs.parking);
  const setbackZones = buildSetbackZones(plotData);

  const layout = {
    plot: plotData, rooms, walls, doors, windows,
    staircase, parking, setbackZones,
    dimensions: buildDimensions(plotData),
    metadata: {
      version: 4,
      generatedAt: new Date().toISOString(),
      generator: 'rule-based',
      theme:       aiParams.designTheme || `Variation ${index + 1}`,
      description: aiParams.description || '',
      layoutStyle: style,
      constraints: { minRoomSize: ROOM_MIN, setbacks: plotData.setback }
    }
  };

  const { isValid, errors } = validatePlan(layout);
  if (!isValid) console.warn('Rule-based layout validation warnings:', errors);
  return layout;
}

// ─── Layout dispatcher ────────────────────────────────────────────────────────

function placeRooms(req, _prefs, area, sizes, style, feats) {
  switch (style) {
    case 'l-shape':    return lShapeLayout   (req, area, sizes, feats);
    case 'split-zone': return splitZoneLayout(req, area, sizes, feats);
    case 'compact':    return compactLayout  (req, area, sizes, feats);
    case 'open-plan':  return openPlanLayout (req, area, sizes, feats);
    default:           return linearLayout   (req, area, sizes, feats);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS — used by all layouts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scale an array of row-heights so they sum exactly to targetLen.
 * Pure proportional scaling — no ROOM_MIN enforcement here.
 * (ROOM_MIN only applies to AI natural sizes in mergeSizes, not placement.)
 */
function scaleRows(rows, targetLen) {
  const total = rows.reduce((s, r) => s + r.h, 0);
  if (total <= 0) return rows;
  const scale = targetLen / total;
  let used = 0;
  return rows.map((r, i) => {
    if (i === rows.length - 1) {
      const h = r2(Math.max(1, targetLen - used));
      used += h;
      return { ...r, h };
    }
    const h = r2(Math.max(1, r.h * scale));
    used += h;
    return { ...r, h };
  });
}

/**
 * Scale an array of column-widths so they sum exactly to targetW.
 * Pure proportional scaling — no ROOM_MIN enforcement here.
 */
function scaleCols(cols, targetW) {
  const total = cols.reduce((s, c) => s + c.w, 0);
  if (total <= 0) return cols;
  const scale = targetW / total;
  let used = 0;
  return cols.map((c, i) => {
    if (i === cols.length - 1) {
      const w = r2(Math.max(1, targetW - used));
      used += w;
      return { ...c, w };
    }
    const w = r2(Math.max(1, c.w * scale));
    used += w;
    return { ...c, w };
  });
}

/** Clamp a value to [min, max] */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Clamp size to ROOM_MIN / ROOM_MAX */
function sz(type, w, h) {
  const mn = ROOM_MIN[type] || { w: 5, h: 5 };
  const mx = ROOM_MAX[type] || { w: 30, h: 30 };
  return { w: r2(clamp(w, mn.w, mx.w)), h: r2(clamp(h, mn.h, mx.h)) };
}

/**
 * Create a room object.
 * No min/max enforcement on placed dimensions — placement sizes are
 * determined by the layout algorithm and must not overflow their zone.
 * ROOM_MIN is only used as a guide for natural AI sizes (in mergeSizes).
 */
function room(type, x, y, w, h) {
  return {
    type,
    x:      r2(Math.max(0, x)),
    y:      r2(Math.max(0, y)),
    width:  r2(Math.max(1, w)),
    height: r2(Math.max(1, h)),
    label:  ROOM_LABELS[type] || type,
    floor:  1
  };
}

/**
 * Place bedroom+bathroom pairs in a HORIZONTAL row.
 * All rooms share the same height (rowH).
 * Widths scale proportionally to fill rowW.
 */
function placeBedRowH(rooms, units, sizes, sx, sy, rowW, rowH) {
  if (units.length === 0) return;

  const bathW = sizes.bathroom.w;
  // Natural widths for each unit (bed + bath side by side)
  const natCols = [];
  units.forEach(u => {
    natCols.push({ type: u.type, w: u.sz.w });
    if (u.hasBath) natCols.push({ type: 'bathroom', w: bathW });
  });

  const scaled = scaleCols(natCols, rowW);
  let cx = sx;
  scaled.forEach(c => {
    rooms.push(room(c.type, cx, sy, c.w, rowH));
    cx += c.w;
  });
}

/**
 * Place bedroom+bathroom pairs in a VERTICAL stack.
 * All rooms in each pair share the same height (unit height).
 * Heights scale proportionally to fill colH.
 * colW is split: bedW + bathW.
 */
function placeBedColV(rooms, units, sizes, sx, sy, colW, colH) {
  if (units.length === 0) return;

  // Each unit = bedroom height (bathroom is placed as a rear strip below bedroom)
  // This avoids side-by-side narrow-column width conflicts.
  const bathStripH = sizes.bathroom.h;  // fixed depth for the bathroom strip (~8ft)
  const bathStripW = r2(Math.min(sizes.bathroom.w * 1.5, colW * 0.55));  // bathroom width within column

  // Natural height per unit = bedroom + bathroom strip
  const natRows = units.map(u => ({
    type: u.type,
    h: u.sz.h + (u.hasBath ? bathStripH : 0),
    unit: u,
  }));

  const scaled = scaleRows(natRows, colH);
  let cy = sy;
  scaled.forEach(sr => {
    const u   = sr.unit;
    const tot = sr.h;
    if (u.hasBath) {
      // Scale bath strip proportionally to the unit
      const bh   = r2(tot * (bathStripH / (u.sz.h + bathStripH)));
      const bedH = r2(tot - bh);
      rooms.push(room(u.type,    sx,  cy,       colW,       bedH));
      rooms.push(room('bathroom', sx, cy + bedH, bathStripW, bh));
    } else {
      rooms.push(room(u.type, sx, cy, colW, tot));
    }
    cy += tot;
  });
}

/** Service row (Dining, Kitchen, Study, Utility) scaled to fill rowW × rowH */
function placeServiceRowH(rooms, cols, sx, sy, rowW, rowH) {
  if (cols.length === 0) return;
  const scaled = scaleCols(cols, rowW);
  let cx = sx;
  scaled.forEach(c => {
    rooms.push(room(c.type, cx, sy, c.w, rowH));
    cx += c.w;
  });
}

/** Build bedroom-unit descriptors from requirements */
function buildBedUnits(req, sizes) {
  const units = [];
  for (let i = 0; i < req.bedrooms; i++) {
    const isMaster = (i === 0 && req.master_bedroom);
    units.push({
      type:    isMaster ? 'master_bedroom' : 'bedroom',
      sz:      isMaster ? sizes.master_bedroom : sizes.bedroom,
      hasBath: i < req.bathrooms,
    });
  }
  if (req.guest_room > 0) {
    units.push({
      type:    'guest_room',
      sz:      sizes.guest_room,
      hasBath: req.bathrooms > req.bedrooms,
    });
  }
  return units;
}

/** Build service column descriptors from requirements */
function buildSvcCols(req, sizes) {
  const cols = [];
  if (req.dining     > 0) cols.push({ type: 'dining',       w: sizes.dining.w });
  if (req.kitchen    > 0) cols.push({ type: 'kitchen',      w: sizes.kitchen.w });
  if (req.study      > 0) cols.push({ type: 'study',        w: sizes.study.w });
  if (req.utility_room>0) cols.push({ type: 'utility_room', w: sizes.utility_room.w });
  return cols;
}

// ─────────────────────────────────────────────────────────────────────────────
//  LAYOUT ALGORITHMS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LINEAR — 3 horizontal bands front to back.
 *
 *  [  Balcony (full width)            ]  ← front/road
 *  [  Living Room (full width)        ]
 *  [  Dining | Kitchen | Study?       ]
 *  [  M.Bed | Bath | Bed | Bath | ... ]  ← back/garden
 *
 * All row heights are scaled proportionally to fill buildable length.
 */
function linearLayout(req, area, sizes, _feats) {
  const rooms = [];

  // ── Collect row descriptors with natural heights ──
  const rowDefs = [];

  if (req.balcony) {
    rowDefs.push({ role: 'balcony', h: sizes.balcony.h });
  }
  rowDefs.push({ role: 'living', h: sizes.living_room.h });

  const svcCols = buildSvcCols(req, sizes);
  if (svcCols.length > 0) {
    const svcH = Math.max(...svcCols.map(c => sizes[c.type]?.h || ROOM_MIN[c.type]?.h || 10));
    rowDefs.push({ role: 'service', h: svcH });
  }

  const bedUnits = buildBedUnits(req, sizes);
  if (bedUnits.length > 0) {
    const bedH = Math.max(...bedUnits.map(u => u.sz.h));
    rowDefs.push({ role: 'beds', h: bedH });
  }

  // ── Scale rows to fill buildable length ──
  const scaled = scaleRows(rowDefs, area.length);

  // ── Place rooms ──
  let sy = area.y;
  scaled.forEach(rd => {
    const h = rd.h;

    if (rd.role === 'balcony') {
      if (req.prayer_room) {
        const prW = sizes.prayer_room.w;
        rooms.push(room('balcony',     area.x,              sy, area.width - prW, h));
        rooms.push(room('prayer_room', area.x + area.width - prW, sy, prW,        h));
      } else {
        rooms.push(room('balcony', area.x, sy, area.width, h));
      }

    } else if (rd.role === 'living') {
      rooms.push(room('living_room', area.x, sy, area.width, h));

    } else if (rd.role === 'service') {
      placeServiceRowH(rooms, svcCols, area.x, sy, area.width, h);

    } else if (rd.role === 'beds') {
      placeBedRowH(rooms, bedUnits, sizes, area.x, sy, area.width, h);
    }

    sy += h;
  });

  return rooms;
}

/**
 * L-SHAPE — public wing at front, bedroom wing runs deep along one side.
 *
 *  [  Balcony (full width)  ]
 *  Left (55%)   |  Right (45%)
 *  Living Room  |  Kitchen
 *  Dining       |  Study?
 *  Beds + Baths |  Beds / Guest
 *
 * Each column scales independently to fill remaining height.
 */
function lShapeLayout(req, area, sizes, _feats) {
  const rooms  = [];
  const leftW  = r2(area.width * 0.55);
  const rightW = r2(area.width - leftW);
  const leftX  = area.x;
  const rightX = area.x + leftW;

  let sy = area.y;

  // Balcony spans full width
  const balH = req.balcony ? sizes.balcony.h : 0;
  if (req.balcony) {
    rooms.push(room('balcony', area.x, sy, area.width, balH));
    sy += balH;
  }

  const remH = area.length - balH;  // height available for both columns

  // ── LEFT column: Living → Dining → Beds ──
  const leftRows = [{ role: 'living', h: sizes.living_room.h, type: 'living_room' }];
  leftRows.push({ role: 'dining', h: sizes.dining.h, type: 'dining' });

  const bedUnits = buildBedUnits(req, sizes);
  const leftBeds  = bedUnits.slice(0, Math.ceil(bedUnits.length / 2));
  if (leftBeds.length > 0) {
    const bedH = Math.max(...leftBeds.map(u => u.sz.h));
    leftRows.push({ role: 'beds', h: bedH });
  }

  const scaledLeft = scaleRows(leftRows, remH);
  let ly = sy;
  scaledLeft.forEach(rd => {
    if (rd.role === 'living') {
      rooms.push(room('living_room', leftX, ly, leftW, rd.h));
    } else if (rd.role === 'dining') {
      rooms.push(room('dining', leftX, ly, leftW, rd.h));
    } else if (rd.role === 'beds') {
      placeBedColV(rooms, leftBeds, sizes, leftX, ly, leftW, rd.h);
    }
    ly += rd.h;
  });

  // ── RIGHT column: Kitchen → Study? → Right Beds ──
  const rightRows = [{ role: 'kitchen', h: sizes.kitchen.h, type: 'kitchen' }];
  if (req.study > 0) rightRows.push({ role: 'study', h: sizes.study.h, type: 'study' });
  if (req.prayer_room) rightRows.push({ role: 'prayer_room', h: sizes.prayer_room.h, type: 'prayer_room' });

  const rightBeds = bedUnits.slice(Math.ceil(bedUnits.length / 2));
  if (rightBeds.length > 0) {
    const bedH = Math.max(...rightBeds.map(u => u.sz.h));
    rightRows.push({ role: 'beds', h: bedH });
  } else {
    // No beds on right — fill with utility
    rightRows.push({ role: 'utility', h: ROOM_MIN.utility_room.h, type: 'utility_room' });
  }

  const scaledRight = scaleRows(rightRows, remH);
  let ry = sy;
  scaledRight.forEach(rd => {
    if (rd.role === 'kitchen') {
      rooms.push(room('kitchen', rightX, ry, rightW, rd.h));
    } else if (rd.role === 'study') {
      rooms.push(room('study', rightX, ry, rightW, rd.h));
    } else if (rd.role === 'prayer_room') {
      rooms.push(room('prayer_room', rightX, ry, rightW, rd.h));
    } else if (rd.role === 'beds') {
      placeBedColV(rooms, rightBeds, sizes, rightX, ry, rightW, rd.h);
    } else if (rd.role === 'utility') {
      rooms.push(room('utility_room', rightX, ry, rightW, rd.h));
    }
    ry += rd.h;
  });

  return rooms;
}

/**
 * SPLIT-ZONE — strict left = public zone, right = private zone.
 *
 *  [  Balcony (full width)  ]
 *  Left (48%)    |  Right (52%)
 *  Living Room   |  Master Bed + Bath
 *  Dining        |  Bedroom + Bath
 *  Kitchen       |  (Guest / Utility if space remains)
 *  Study?        |
 *
 * Each column scales independently.
 */
function splitZoneLayout(req, area, sizes, _feats) {
  const rooms  = [];
  const leftW  = r2(area.width * 0.48);
  const rightW = r2(area.width - leftW);
  const leftX  = area.x;
  const rightX = area.x + leftW;

  let sy = area.y;

  const balH = req.balcony ? sizes.balcony.h : 0;
  if (req.balcony) {
    rooms.push(room('balcony', area.x, sy, area.width, balH));
    sy += balH;
  }

  const remH = area.length - balH;

  // ── LEFT: public rooms stacked vertically, scaled to remH ──
  const publicRows = [
    { role: 'living',  h: sizes.living_room.h, type: 'living_room' },
    { role: 'dining',  h: sizes.dining.h,       type: 'dining' },
    { role: 'kitchen', h: sizes.kitchen.h,      type: 'kitchen' },
  ];
  if (req.study > 0)    publicRows.push({ role: 'study',       h: sizes.study.h,       type: 'study' });
  if (req.prayer_room)  publicRows.push({ role: 'prayer_room', h: sizes.prayer_room.h, type: 'prayer_room' });

  const scaledLeft = scaleRows(publicRows, remH);
  let ly = sy;
  scaledLeft.forEach(rd => {
    rooms.push(room(rd.type, leftX, ly, leftW, rd.h));
    ly += rd.h;
  });

  // ── RIGHT: private rooms stacked, each row = bed+bath side by side ──
  const bedUnits = buildBedUnits(req, sizes);
  // Each unit height = bedroom + bathroom strip (rear-attached)
  const bathStripH = sizes.bathroom.h;
  const bathStripW = r2(Math.min(sizes.bathroom.w * 1.5, rightW * 0.55));
  const privateRows = bedUnits.map(u => ({
    role: 'bedrow',
    h: u.sz.h + (u.hasBath ? bathStripH : 0),
    unit: u,
  }));
  if (req.utility_room > 0) {
    privateRows.push({ role: 'utility', h: sizes.utility_room.h, type: 'utility_room' });
  }

  if (privateRows.length === 0) {
    rooms.push(room('bedroom', rightX, sy, rightW, remH));
  } else {
    const scaledRight = scaleRows(privateRows, remH);
    let ry = sy;
    scaledRight.forEach(rd => {
      if (rd.role === 'bedrow') {
        const u   = rd.unit;
        const tot = rd.h;
        if (u.hasBath) {
          const bh   = r2(tot * (bathStripH / (u.sz.h + bathStripH)));
          const bedH = r2(tot - bh);
          rooms.push(room(u.type,    rightX, ry,       rightW,     bedH));
          rooms.push(room('bathroom', rightX, ry + bedH, bathStripW, bh));
        } else {
          rooms.push(room(u.type, rightX, ry, rightW, tot));
        }
      } else if (rd.role === 'utility') {
        rooms.push(room('utility_room', rightX, ry, rightW, rd.h));
      }
      ry += rd.h;
    });
  }

  return rooms;
}

/**
 * COMPACT — central corridor spine, rooms branch left and right.
 * Best for narrow plots.
 *
 *  Left          CORR  Right
 *  Living Room    │    Dining
 *  Study?         │    Kitchen
 *  M.Bed+Bath     │    Utility?
 *  Bed+Bath       │    Bed+Bath
 */
function compactLayout(req, area, sizes, _feats) {
  const rooms  = [];
  const leftW  = r2((area.width - CORR_W) * 0.52);
  const rightW = r2(area.width - CORR_W - leftW);
  const leftX  = area.x;
  const rightX = area.x + leftW + CORR_W;

  let sy = area.y;

  const balH = req.balcony ? sizes.balcony.h : 0;
  if (req.balcony) {
    rooms.push(room('balcony', area.x, sy, area.width, balH));
    sy += balH;
  }

  const remH = area.length - balH;

  // ── LEFT: Living → Study/Prayer → Beds ──
  const leftRows = [{ role: 'living', h: sizes.living_room.h, type: 'living_room' }];
  if (req.study      > 0) leftRows.push({ role: 'study',       h: sizes.study.h,       type: 'study' });
  if (req.prayer_room)    leftRows.push({ role: 'prayer_room', h: sizes.prayer_room.h, type: 'prayer_room' });

  const bedUnits = buildBedUnits(req, sizes);
  const leftBeds  = bedUnits.filter((_, i) => i % 2 === 0);
  const rightBeds = bedUnits.filter((_, i) => i % 2 === 1);

  if (leftBeds.length > 0) {
    const bedH = Math.max(...leftBeds.map(u => u.sz.h));
    leftRows.push({ role: 'beds', h: bedH });
  }

  const scaledLeft = scaleRows(leftRows, remH);
  let ly = sy;
  scaledLeft.forEach(rd => {
    if (rd.role === 'living') {
      rooms.push(room('living_room', leftX, ly, leftW, rd.h));
    } else if (rd.role === 'study') {
      rooms.push(room('study', leftX, ly, leftW, rd.h));
    } else if (rd.role === 'prayer_room') {
      rooms.push(room('prayer_room', leftX, ly, leftW, rd.h));
    } else if (rd.role === 'beds') {
      placeBedColV(rooms, leftBeds, sizes, leftX, ly, leftW, rd.h);
    }
    ly += rd.h;
  });

  // ── RIGHT: Dining → Kitchen → Utility → Beds ──
  const rightRows = [
    { role: 'dining',  h: sizes.dining.h,  type: 'dining' },
    { role: 'kitchen', h: sizes.kitchen.h, type: 'kitchen' },
  ];
  if (req.utility_room > 0) {
    rightRows.push({ role: 'utility', h: sizes.utility_room.h, type: 'utility_room' });
  }
  if (rightBeds.length > 0) {
    const bedH = Math.max(...rightBeds.map(u => u.sz.h));
    rightRows.push({ role: 'beds', h: bedH });
  }

  const scaledRight = scaleRows(rightRows, remH);
  let ry = sy;
  scaledRight.forEach(rd => {
    if (rd.role === 'dining') {
      rooms.push(room('dining', rightX, ry, rightW, rd.h));
    } else if (rd.role === 'kitchen') {
      rooms.push(room('kitchen', rightX, ry, rightW, rd.h));
    } else if (rd.role === 'utility') {
      rooms.push(room('utility_room', rightX, ry, rightW, rd.h));
    } else if (rd.role === 'beds') {
      placeBedColV(rooms, rightBeds, sizes, rightX, ry, rightW, rd.h);
    }
    ry += rd.h;
  });

  return rooms;
}

/**
 * OPEN-PLAN — large merged social core, private cluster at rear.
 *
 *  [  Balcony (full width)                     ]
 *  [  Living Room | Dining | Kitchen (open)    ]
 *  [  Study | Prayer (if any, full width row)  ]
 *  [  M.Bed+Bath | Bed+Bath | ... (full width) ]
 */
function openPlanLayout(req, area, sizes, _feats) {
  const rooms = [];

  const rowDefs = [];

  if (req.balcony) rowDefs.push({ role: 'balcony', h: sizes.balcony.h });

  // Open social core: Living + Dining + Kitchen side by side
  const socialH = Math.max(sizes.living_room.h, sizes.dining.h, sizes.kitchen.h);
  rowDefs.push({ role: 'social', h: socialH });

  // Optional mid row
  const midCols = [];
  if (req.study      > 0) midCols.push({ type: 'study',       w: sizes.study.w,       h: sizes.study.h });
  if (req.prayer_room)    midCols.push({ type: 'prayer_room', w: sizes.prayer_room.w, h: sizes.prayer_room.h });
  if (req.utility_room>0) midCols.push({ type: 'utility_room',w: sizes.utility_room.w,h: sizes.utility_room.h });
  if (midCols.length > 0) {
    const midH = Math.max(...midCols.map(c => c.h));
    rowDefs.push({ role: 'mid', h: midH });
  }

  const bedUnits = buildBedUnits(req, sizes);
  if (bedUnits.length > 0) {
    const bedH = Math.max(...bedUnits.map(u => u.sz.h));
    rowDefs.push({ role: 'beds', h: bedH });
  }

  const scaled = scaleRows(rowDefs, area.length);
  let sy = area.y;

  scaled.forEach(rd => {
    if (rd.role === 'balcony') {
      rooms.push(room('balcony', area.x, sy, area.width, rd.h));

    } else if (rd.role === 'social') {
      // Living | Dining | Kitchen — proportional widths
      const socialCols = [
        { type: 'living_room', w: sizes.living_room.w },
        { type: 'dining',      w: sizes.dining.w },
        { type: 'kitchen',     w: sizes.kitchen.w },
      ];
      placeServiceRowH(rooms, socialCols, area.x, sy, area.width, rd.h);

    } else if (rd.role === 'mid') {
      placeServiceRowH(rooms, midCols, area.x, sy, area.width, rd.h);

    } else if (rd.role === 'beds') {
      placeBedRowH(rooms, bedUnits, sizes, area.x, sy, area.width, rd.h);
    }
    sy += rd.h;
  });

  return rooms;
}

// ─── Door generation ─────────────────────────────────────────────────────────

function generateDoors(rooms, _plotData, buildable, prefs) {
  const doors = [];

  // 1. Main entry door — offset from parking side
  const parkSide = prefs.parking?.gate_direction || 'left';
  let mainDoorX;
  if (parkSide === 'right')       mainDoorX = buildable.x + buildable.width * 0.25;
  else if (parkSide === 'center') mainDoorX = buildable.x + buildable.width * 0.5 - DOOR_W / 2;
  else                            mainDoorX = buildable.x + buildable.width * 0.65;

  doors.push({
    x: mainDoorX, y: buildable.y,
    width: 4, height: 7,
    orientation: 'horizontal', type: 'main', label: 'ENTRY'
  });

  // Index by type
  const byType = {};
  rooms.forEach(r => { (byType[r.type] = byType[r.type] || []).push(r); });

  const sharedH = (r1, r2) => {
    const sharedY = Math.abs((r1.y + r1.height) - r2.y) < 1 ? r1.y + r1.height : null;
    if (!sharedY) return null;
    const l = Math.max(r1.x, r2.x), ri = Math.min(r1.x + r1.width, r2.x + r2.width);
    if (ri - l < DOOR_W + 0.5) return null;
    return { x: l + (ri - l) / 2 - DOOR_W / 2, y: sharedY };
  };
  const sharedV = (r1, r2) => {
    const sharedX = Math.abs((r1.x + r1.width) - r2.x) < 1 ? r1.x + r1.width : null;
    if (!sharedX) return null;
    const t = Math.max(r1.y, r2.y), b = Math.min(r1.y + r1.height, r2.y + r2.height);
    if (b - t < DOOR_W + 0.5) return null;
    return { x: sharedX, y: t + (b - t) / 2 - DOOR_W / 2 };
  };
  const findShared = (a, b) =>
    sharedH(a, b) || sharedH(b, a) || sharedV(a, b) || sharedV(b, a);

  // 2. Balcony ↔ Living
  (byType['balcony']||[]).forEach(bal =>
    (byType['living_room']||[]).forEach(liv => {
      const pt = sharedH(bal, liv);
      if (pt) doors.push({ x: pt.x, y: pt.y, width: DOOR_W, height: 7, orientation: 'horizontal', type: 'sliding' });
    })
  );

  // 3. Living ↔ Dining
  (byType['living_room']||[]).forEach(liv =>
    (byType['dining']||[]).forEach(din => {
      const pt = findShared(liv, din);
      if (pt) {
        const isV = !!(sharedV(liv,din)||sharedV(din,liv));
        doors.push({ x: pt.x, y: pt.y, width: DOOR_W, height: 7,
          orientation: isV ? 'vertical' : 'horizontal', type: 'room' });
      }
    })
  );

  // 4. Dining ↔ Kitchen
  (byType['dining']||[]).forEach(din =>
    (byType['kitchen']||[]).forEach(kit => {
      const pt = findShared(din, kit);
      if (pt) {
        const isV = !!(sharedV(din,kit)||sharedV(kit,din));
        doors.push({ x: pt.x, y: pt.y, width: DOOR_W, height: 7,
          orientation: isV ? 'vertical' : 'horizontal', type: 'room' });
      }
    })
  );

  // 5. Kitchen service door
  (byType['kitchen']||[]).forEach(kit => {
    doors.push({
      x: kit.x + kit.width * 0.7, y: kit.y + kit.height,
      width: DOOR_W, height: 7, orientation: 'horizontal', type: 'room', label: 'SERVICE'
    });
  });

  // 6. Bedroom ↔ Bathroom (en-suite)
  const bedTypes = ['master_bedroom', 'bedroom', 'guest_room'];
  (byType['bathroom']||[]).forEach(bath =>
    bedTypes.forEach(bt =>
      (byType[bt]||[]).forEach(bed => {
        const pt = findShared(bed, bath);
        if (pt) {
          const isV = !!(sharedV(bed,bath)||sharedV(bath,bed));
          doors.push({ x: pt.x, y: pt.y, width: 2.5, height: 7,
            orientation: isV ? 'vertical' : 'horizontal', type: 'bathroom' });
        }
      })
    )
  );

  // 7. Passage door on each private room (front wall toward living zone)
  const privateTypes = ['master_bedroom', 'bedroom', 'study', 'guest_room', 'prayer_room', 'utility_room'];
  privateTypes.forEach(bt =>
    (byType[bt]||[]).forEach(r => {
      doors.push({
        x: r.x + r.width * 0.3, y: r.y,
        width: DOOR_W, height: 7, orientation: 'horizontal', type: 'room'
      });
    })
  );

  // 8. Guarantee every room has at least one door ──────────────────────────
  // Check each room — if no existing door lies on any of its 4 walls, add one
  rooms.forEach(r => {
    const hasDoor = doors.some(d => {
      const TOL = 1.5;
      const onFront = Math.abs(d.y - r.y) < TOL           && d.x >= r.x - TOL && d.x < r.x + r.width;
      const onBack  = Math.abs(d.y - (r.y + r.height)) < TOL && d.x >= r.x - TOL && d.x < r.x + r.width;
      const onLeft  = Math.abs(d.x - r.x) < TOL           && d.y >= r.y - TOL && d.y < r.y + r.height;
      const onRight = Math.abs(d.x - (r.x + r.width)) < TOL && d.y >= r.y - TOL && d.y < r.y + r.height;
      return onFront || onBack || onLeft || onRight;
    });
    if (!hasDoor) {
      // Place door at 30% across the front wall of the room
      doors.push({
        x: r.x + r.width * 0.3, y: r.y,
        width: r.type === 'bathroom' ? 2.5 : DOOR_W,
        height: 7, orientation: 'horizontal', type: 'room'
      });
    }
  });

  return doors;
}

// ─── Windows ─────────────────────────────────────────────────────────────────

function generateWindows(rooms, buildable) {
  const windows = [];
  rooms.forEach(r => {
    const onFront = Math.abs(r.y - buildable.y) < 1;
    const onBack  = Math.abs(r.y + r.height - (buildable.y + buildable.length)) < 1;
    const onLeft  = Math.abs(r.x - buildable.x) < 1;
    const onRight = Math.abs(r.x + r.width - (buildable.x + buildable.width)) < 1;

    if (onFront || onBack) {
      windows.push({
        x: r.x + r.width * 0.25, y: onFront ? r.y : r.y + r.height - 0.5,
        width: Math.min(4, r.width * 0.4), height: 0.5,
        orientation: 'horizontal', wallSide: onFront ? 'front' : 'back'
      });
    }
    if (onLeft || onRight) {
      windows.push({
        x: onLeft ? r.x : r.x + r.width - 0.5,
        y: r.y + r.height * 0.3,
        width: 0.5, height: Math.min(3, r.height * 0.35),
        orientation: 'vertical', wallSide: onLeft ? 'left' : 'right'
      });
    }
  });
  return windows;
}

// ─── Walls ────────────────────────────────────────────────────────────────────

function generateWalls(rooms, plot) {
  const walls = [
    { x1: 0, y1: 0, x2: plot.width, y2: 0,            thickness: 0.5, type: 'exterior' },
    { x1: 0, y1: plot.length, x2: plot.width, y2: plot.length, thickness: 0.5, type: 'exterior' },
    { x1: 0, y1: 0, x2: 0, y2: plot.length,            thickness: 0.5, type: 'exterior' },
    { x1: plot.width, y1: 0, x2: plot.width, y2: plot.length, thickness: 0.5, type: 'exterior' },
  ];
  rooms.forEach(r => {
    walls.push({ x1: r.x, y1: r.y, x2: r.x + r.width, y2: r.y, thickness: 0.3, type: 'interior' });
    walls.push({ x1: r.x, y1: r.y + r.height, x2: r.x + r.width, y2: r.y + r.height, thickness: 0.3, type: 'interior' });
    walls.push({ x1: r.x, y1: r.y, x2: r.x, y2: r.y + r.height, thickness: 0.3, type: 'interior' });
    walls.push({ x1: r.x + r.width, y1: r.y, x2: r.x + r.width, y2: r.y + r.height, thickness: 0.3, type: 'interior' });
  });
  return walls;
}

// ─── Staircase ────────────────────────────────────────────────────────────────

function placeStaircase(area, position = 'corner') {
  const w = 4, h = 8;
  let x, y;
  switch (position) {
    case 'center':
      x = area.x + Math.floor(area.width  / 2) - w / 2;
      y = area.y + Math.floor(area.length / 2) - h / 2;
      break;
    case 'side':
      x = area.x;
      y = area.y + Math.floor(area.length / 2) - h / 2;
      break;
    default:
      x = area.x + area.width  - w;
      y = area.y + area.length - h;
  }
  return {
    x: r2(clamp(x, area.x, area.x + area.width  - w)),
    y: r2(clamp(y, area.y, area.y + area.length - h)),
    width: w, height: h, direction: 'up', type: 'straight'
  };
}

// ─── Parking ─────────────────────────────────────────────────────────────────

function placeParking(plotData, buildable, parkingPrefs) {
  if (!parkingPrefs?.enabled) return null;

  const cars  = Math.max(1, parkingPrefs.cars || 1);
  const parkH = r2(Math.min(PARK_L, Math.max(6, buildable.y - 0.5)));
  const parkW = r2(Math.min(PARK_W * cars, buildable.width * 0.55));

  const side  = parkingPrefs.gate_direction || 'left';
  let parkX;
  if (side === 'right')       parkX = plotData.width - parkW;
  else if (side === 'center') parkX = (plotData.width - parkW) / 2;
  else                        parkX = 0;

  return {
    x: r2(parkX), y: 0,
    width: parkW, height: parkH,
    cars, type: parkingPrefs.type || 'open',
    label: 'PARKING', gateX: r2(parkX + parkW / 2)
  };
}

// ─── Setback zones ────────────────────────────────────────────────────────────

function buildSetbackZones(plot) {
  const sb = plot.setback;
  return [
    { label: 'FRONT SETBACK', sublabel: 'Main Gate / Entry Zone',
      x: 0, y: 0, width: plot.width, height: sb.back, type: 'front' },
    { label: 'REAR SETBACK',  sublabel: 'Garden / Open Area',
      x: 0, y: plot.length - sb.front, width: plot.width, height: sb.front, type: 'rear' },
    { label: 'SIDE', sublabel: '',
      x: 0, y: sb.back, width: sb.left, height: plot.length - sb.front - sb.back, type: 'side' },
    { label: 'SIDE', sublabel: '',
      x: plot.width - sb.right, y: sb.back,
      width: sb.right, height: plot.length - sb.front - sb.back, type: 'side' },
  ].filter(z => z.width > 0.5 && z.height > 0.5);
}

// ─── Dimensions ───────────────────────────────────────────────────────────────

function buildDimensions(plot) {
  return [
    { type: 'length', value: plot.length, position: { x: plot.width + 2, y: plot.length / 2 } },
    { type: 'width',  value: plot.width,  position: { x: plot.width / 2, y: -2 } },
  ];
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

function parsePlot(plot) {
  return {
    width:   parseFloat(plot.width),
    length:  parseFloat(plot.length),
    facing:  (plot.facing || 'north').toLowerCase(),
    setback: {
      front: parseFloat(plot.setback?.front || 6),
      back:  parseFloat(plot.setback?.back  || 4),
      left:  parseFloat(plot.setback?.left  || 4),
      right: parseFloat(plot.setback?.right || 4),
    }
  };
}

function parseRequirements(r) {
  return {
    bedrooms:       parseInt(r.bedrooms       || 2),
    master_bedroom: r.master_bedroom !== false,
    kitchen:        parseInt(r.kitchen        || 1),
    dining:         parseInt(r.dining         || 1),
    living_room:    parseInt(r.living_room     || 1),
    bathrooms:      parseInt(r.bathrooms      || 2),
    study:          parseInt(r.study          || 0),
    balcony:        r.balcony !== false,
    terrace:        !!r.terrace,
    prayer_room:    !!r.prayer_room,
    guest_room:     parseInt(r.guest_room     || 0),
    utility_room:   parseInt(r.utility_room   || 0),
  };
}

function parsePreferences(p) {
  return {
    style:  p.style  || 'modern',
    vastu:  !!p.vastu,
    budget: p.budget || 'medium',
    parking: p.parking ? {
      enabled:        !!p.parking.enabled,
      cars:           parseInt(p.parking.cars || 1),
      type:           p.parking.type          || 'open',
      gate_direction: p.parking.gate_direction || 'left',
    } : { enabled: false }
  };
}

function getBuildable(plot) {
  return {
    x:      plot.setback.left,
    y:      plot.setback.back,
    width:  Math.max(10, plot.width  - plot.setback.left  - plot.setback.right),
    length: Math.max(10, plot.length - plot.setback.front - plot.setback.back),
  };
}

// ─── Size merging ─────────────────────────────────────────────────────────────

function mergeSizes(aiSizes) {
  const merged = {};
  for (const [type, mn] of Object.entries(ROOM_MIN)) {
    const mx = ROOM_MAX[type] || { w: 30, h: 30 };
    const ai = aiSizes[type] || {};
    const w  = clamp(ai.width  || mn.w, mn.w, mx.w);
    const h  = clamp(ai.height || mn.h, mn.h, mx.h);
    merged[type] = { w: r2(w), h: r2(h) };
  }
  return merged;
}

// ─── Default fallback params ──────────────────────────────────────────────────

function defaultParams(count, offset = 0) {
  const styles = ['linear', 'l-shape', 'split-zone', 'compact', 'open-plan'];
  const themes = ['Modern Minimalist', 'Contemporary', 'Traditional Elegance', 'Vastu Compliant', 'Scandinavian'];
  const sizesList = [
    { living_room:{width:16,height:14}, dining:{width:13,height:11}, kitchen:{width:12,height:10}, master_bedroom:{width:14,height:13}, bedroom:{width:12,height:11}, bathroom:{width:7,height:8}, study:{width:11,height:10}, balcony:{width:14,height:5}, guest_room:{width:12,height:11}, utility_room:{width:8,height:8}, prayer_room:{width:9,height:9} },
    { living_room:{width:17,height:15}, dining:{width:12,height:12}, kitchen:{width:11,height:11}, master_bedroom:{width:15,height:13}, bedroom:{width:12,height:12}, bathroom:{width:7,height:9}, study:{width:10,height:10}, balcony:{width:16,height:5}, guest_room:{width:12,height:10}, utility_room:{width:8,height:8}, prayer_room:{width:10,height:9} },
    { living_room:{width:15,height:14}, dining:{width:14,height:11}, kitchen:{width:12,height:10}, master_bedroom:{width:13,height:13}, bedroom:{width:11,height:11}, bathroom:{width:6,height:8}, study:{width:10,height:10}, balcony:{width:13,height:5}, guest_room:{width:11,height:10}, utility_room:{width:8,height:8}, prayer_room:{width:9,height:9} },
    { living_room:{width:16,height:13}, dining:{width:13,height:10}, kitchen:{width:11,height:10}, master_bedroom:{width:14,height:12}, bedroom:{width:12,height:10}, bathroom:{width:7,height:8}, study:{width:11,height:10}, balcony:{width:12,height:5}, guest_room:{width:12,height:10}, utility_room:{width:8,height:8}, prayer_room:{width:9,height:9} },
    { living_room:{width:18,height:15}, dining:{width:14,height:11}, kitchen:{width:12,height:11}, master_bedroom:{width:15,height:14}, bedroom:{width:13,height:11}, bathroom:{width:7,height:9}, study:{width:10,height:10}, balcony:{width:16,height:5}, guest_room:{width:13,height:11}, utility_room:{width:8,height:8}, prayer_room:{width:10,height:9} },
  ];
  return Array.from({ length: count }, (_, i) => {
    const idx = (offset + i) % styles.length;
    return {
      layoutStyle: styles[idx],
      designTheme: themes[idx],
      description: `${themes[idx]} — ${styles[idx].replace('-', ' ')} layout`,
      roomSizes:   sizesList[idx],
      features:    { masterEnSuite: true, balconyPosition: 'front', staircasePosition: 'corner' }
    };
  });
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function r2(n) { return Math.round(n * 10) / 10; }

const ROOM_LABELS = {
  living_room: 'Living Room', dining: 'Dining', kitchen: 'Kitchen',
  master_bedroom: 'Master Bed', bedroom: 'Bedroom', bathroom: 'Bathroom',
  study: 'Study', balcony: 'Balcony', terrace: 'Terrace',
  prayer_room: 'Prayer Room', guest_room: 'Guest Room', utility_room: 'Utility',
};

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  generateLayout,
  generateLayoutVariations,
  MIN_ROOM_SIZES: ROOM_MIN,
  ROOM_ADJACENCY_RULES: {},
  STANDARDS: { corridor_width: CORR_W, wall_thickness: 0.3, door_width: DOOR_W, parking_width: PARK_W, parking_length: PARK_L }
};
