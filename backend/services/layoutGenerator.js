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

const { validatePlan: schemaValidatePlan } = require('../../shared/plan-schema');
const { validatePlan }                     = require('./planValidator');
const { autoFix }                          = require('./planAutoFixer');
const geminiService                        = require('./geminiService');

// ─── Hard limits (also used by fallback generator) ───────────────────────────

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
  living_room:    { w: 35, h: 18 },
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

// ─── Staircase room builder ───────────────────────────────────────────────────

/**
 * Returns a staircase room object placed according to position preference.
 * Dimensions depend on staircase type:
 *   dog-leg  → 10 × 5 ft  (most common in Indian homes, requires landing)
 *   straight → 10 × 3.5 ft (single flight, compact)
 *   spiral   →  6 × 6 ft  (circular, tight corner)
 *
 * Position:
 *   center → placed at horizontal center, just below the balcony/front zone
 *   corner → placed at x=0 (left corner) at the service zone level
 *   side   → placed at right edge at the service zone level
 *
 * The y coordinate is kept near the front third of the plan so the staircase
 * is accessible from the entry without walking through private rooms.
 */
function _staircaseRoom(stType, stPos, W, H) {
  const dims = {
    'dog-leg':  { w: 10, h: 5 },
    'straight': { w: 10, h: Math.round(3.5) },
    'spiral':   { w:  6, h: 6 },
  };
  const { w, h } = dims[stType] || dims['dog-leg'];
  const safeW = Math.min(w, Math.floor(W * 0.40));
  const safeH = Math.min(h, Math.floor(H * 0.20));

  // Place around the middle horizontal band (y ≈ 30-45% of buildable height)
  const y = Math.round(H * 0.33);
  let x;
  if (stPos === 'corner') x = 0;
  else if (stPos === 'side') x = W - safeW;
  else x = Math.round((W - safeW) / 2); // center

  return { type: 'staircase', x, y, width: safeW, height: safeH };
}

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

  // ── AI generates plans, fallback to rule-based if AI fails ──────────────
  let aiLayouts = null;
  try {
    aiLayouts = await geminiService.generateRoomPlacements(plot, requirements, preferences, variations);
  } catch (err) {
    console.warn(`AI plan generation failed (${err.message}) — will use fallback`);
  }

  if (!aiLayouts || aiLayouts.length === 0) {
    console.warn('AI returned no plans — using rule-based fallback layouts');
    return generateFallbackLayouts(plotData, prefs, buildable, req, variations);
  }

  const results = [];
  for (let i = 0; i < Math.min(aiLayouts.length, variations); i++) {
    const ai = aiLayouts[i];
    if (ai.rooms && ai.rooms.length > 0) {
      resolveOverlaps(ai.rooms, buildable);
      trimOverlaps(ai.rooms, buildable);
      fillGaps(ai.rooms, buildable);
      enforceRoomHierarchy(ai.rooms);
      if (validateAIRooms(ai.rooms, buildable)) {
        const fixedRooms = enforceRoomCounts(ai.rooms, req, buildable);
        resolveOverlaps(fixedRooms, buildable);
        trimOverlaps(fixedRooms, buildable);
        fillGaps(fixedRooms, buildable);
        enforceRoomHierarchy(fixedRooms);
        results.push(buildVariationFromAIRooms(plotData, prefs, buildable, { ...ai, rooms: fixedRooms }, i));
      } else {
        console.warn(`AI variation ${i + 1} failed validation — skipping`);
      }
    }
  }

  if (results.length === 0) {
    console.warn('All AI variations failed — using rule-based fallback layouts');
    return generateFallbackLayouts(plotData, prefs, buildable, req, variations);
  }

  return results;
}

// ─── Smart validator-aware builders ──────────────────────────────────────────
// Validator minimums (ROOM_MIN_DIM in planValidator.js — these are the ones that count):
//   living_room h≥10, master_bedroom h≥10, bedroom h≥10, kitchen h≥7, dining h≥10, bathroom h≥7
// These builders guarantee 100% coverage and zero ROOM_MIN_DIM violations.

const clp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Private-zone helper: place paired bedroom rows starting at y=privStartY.
// All rows span full W. Each bed has an en-suite bath (until baths are used up).
// Returns the y value reached after the last row.
function _placePrivateRows(rooms, W, privStartY, H, regBeds, regH, bathW1, bedW1, baths, firstBathIdx) {
  const regRows = Math.ceil(regBeds / 2);
  let bathIdx = firstBathIdx;
  let y = privStartY;

  for (let row = 0; row < regRows; row++) {
    const bedsInRow = Math.min(2, regBeds - row * 2);
    const rowH      = row === regRows - 1 ? (H - y) : regH;

    if (bedsInRow === 1) {
      if (bathIdx < baths) {
        rooms.push({ type: 'bedroom',  x: 0,     y, width: bedW1,  height: rowH });
        rooms.push({ type: 'bathroom', x: bedW1, y, width: bathW1, height: rowH });
        bathIdx++;
      } else {
        rooms.push({ type: 'bedroom', x: 0, y, width: W, height: rowH });
      }
    } else {
      if (bathIdx < baths) {
        // Bed | Bath | Bed — bath in the middle, adjacent to both beds
        const bw  = clp(Math.round(W * 0.19), 6, 9);
        const bw1 = r2((W - bw) / 2);
        rooms.push({ type: 'bedroom',  x: 0,        y, width: bw1,      height: rowH });
        rooms.push({ type: 'bathroom', x: bw1,      y, width: bw,       height: rowH });
        rooms.push({ type: 'bedroom',  x: bw1 + bw, y, width: W-bw1-bw, height: rowH });
        bathIdx++;
      } else {
        const w1 = r2(W / 2);
        rooms.push({ type: 'bedroom', x: 0,  y, width: w1,     height: rowH });
        rooms.push({ type: 'bedroom', x: w1, y, width: W - w1, height: rowH });
      }
    }
    y += rowH;
  }
  return y;
}

// Validator minimums (from planValidator.js ROOM_MIN_DIM)
const VM = { liv: 10, bed: 10, serv: 10, kit: 7, bath: 7, balc: 5 };

/**
 * Plan 1 — Classic Linear
 * Horizontal bands: balcony → living → dining/kitchen → bedrooms.
 * Dining on LEFT, kitchen on RIGHT. Bath attached to right of each bedroom row.
 * Balcony skipped on tight plots so all rooms stay above validator minimums.
 */
/**
 * Distribute `total` height across zones with given ideal shares.
 * Guarantees: each zone ≥ its minimum, total always = `total`.
 * If minimums alone exceed `total`, scales proportionally.
 */
/**
 * Distribute `total` height across zones.
 * zones = [{ min, shares }, ...]
 * Guarantees: all heights ≥ 1, sum = total.
 * On generous plots: each zone ≥ its min + surplus proportional to shares.
 * On tight plots: scale min proportionally (rooms may be below validator min).
 */
function _zoneHeights(total, zones) {
  const sumMin   = zones.reduce((s, z) => s + z.min, 0);
  const sumShare = zones.reduce((s, z) => s + z.shares, 0);
  const result   = [];

  if (sumMin >= total) {
    // Tight: scale each min proportionally
    const scale = total / sumMin;
    let used = 0;
    for (let i = 0; i < zones.length; i++) {
      if (i === zones.length - 1) {
        result.push(Math.max(1, total - used));
      } else {
        const h = Math.max(1, Math.floor(zones[i].min * scale));
        result.push(h);
        used += h;
      }
    }
  } else {
    // Normal: minimums guaranteed + distribute surplus by shares
    const surplus = total - sumMin;
    let used = 0;
    for (let i = 0; i < zones.length; i++) {
      if (i === zones.length - 1) {
        result.push(Math.max(1, total - used));
      } else {
        const h = zones[i].min + Math.round((zones[i].shares / sumShare) * surplus);
        result.push(h);
        used += h;
      }
    }
  }

  return result;
}

function buildSmartLinear(W, H, req) {
  const beds      = clp(parseInt(req.bedrooms  || 2), 1, 6);
  const baths     = clp(parseInt(req.bathrooms || 2), 0, beds);
  const hasStairs = (req.floors || 1) > 1;

  const bathW       = clp(Math.round(W * 0.28), 6, 9);
  const bedW        = W - bathW;
  const regBeds     = Math.max(0, beds - 1);
  const regRows     = Math.ceil(regBeds / 2);
  const totalBedRows = 1 + regRows;

  const minTotalH = VM.balc + VM.liv + VM.serv + totalBedRows * VM.bed;
  const includeBalc = H >= minTotalH;
  const balcH = includeBalc ? VM.balc : 0;
  const remainH = H - balcH;

  // Zone definitions: { min height, proportional share }
  const [livH, servH, totalBedH] = _zoneHeights(remainH, [
    { min: VM.liv,                shares: 2 },
    { min: VM.serv,               shares: 1.5 },
    { min: VM.bed * totalBedRows, shares: 1.5 * totalBedRows },
  ]);
  const eachBedH = Math.max(1, Math.floor(totalBedH / totalBedRows));

  const rooms = [];
  let y = 0;

  if (includeBalc) {
    rooms.push({ type: 'balcony', x: 0, y, width: W, height: balcH });
    y += balcH;
  }

  rooms.push({ type: 'living_room', x: 0, y, width: W, height: livH });
  y += livH;

  const dinW = r2(W * 0.48);
  rooms.push({ type: 'dining',  x: 0,    y, width: dinW,     height: servH });
  rooms.push({ type: 'kitchen', x: dinW, y, width: W - dinW, height: servH });
  y += servH;

  if (baths >= 1) {
    rooms.push({ type: 'master_bedroom', x: 0,    y, width: bedW,  height: eachBedH });
    rooms.push({ type: 'bathroom',       x: bedW, y, width: bathW, height: eachBedH });
  } else {
    rooms.push({ type: 'master_bedroom', x: 0, y, width: W, height: eachBedH });
  }
  y += eachBedH;

  _placePrivateRows(rooms, W, y, H, regBeds, eachBedH, bathW, bedW, baths, baths >= 1 ? 1 : 0);
  if (hasStairs) rooms.push(_staircaseRoom(req.staircase_type, req.staircase_position, W, H));
  return rooms;
}

/**
 * Plan 2 — Private Wing (bedrooms on LEFT, public rooms on RIGHT)
 * Visually the mirror of a typical split-zone: the bedroom wing is on the left,
 * living/dining/kitchen stack on the right. Kitchen at the BOTTOM of the public column.
 * Balcony spans right side at the front.
 * Falls back to linear if plot is too narrow for two viable columns.
 */
function buildSmartPrivateWing(W, H, req) {
  const beds      = clp(parseInt(req.bedrooms  || 2), 1, 6);
  const baths     = clp(parseInt(req.bathrooms || 2), 0, beds);
  const hasStairs = (req.floors || 1) > 1;

  const bathWP = 6;
  const minPrivW = 10 + bathWP;   // bed_w(10) + bath_w(6) = 16 ft minimum
  const minPubW  = 10;            // living_room min w

  if (W < minPrivW + minPubW) return buildSmartLinear(W, H, req);

  // Private wing on LEFT — wider to allow generously-sized bedrooms
  const privW = Math.max(minPrivW, Math.round(W * 0.56));
  const pubW  = W - privW;
  const privBedW = privW - bathWP;

  const includeBalc = (H - VM.balc) >= (VM.liv + VM.serv + VM.kit);
  const balcH = includeBalc ? VM.balc : 0;

  // Public column: kitchen at BOTTOM, dining in middle, living at top (near road)
  const pubH = H - balcH;
  const livH = r2(pubH * 0.42);
  const kitH = r2(pubH * 0.30);   // kitchen near the rear
  const dinH = pubH - livH - kitH;

  const privBedH = r2((H - balcH) / beds);

  const rooms = [];

  if (includeBalc) {
    // Balcony on the RIGHT side (public side) only — distinctive asymmetric front
    rooms.push({ type: 'balcony', x: privW, y: 0, width: pubW, height: balcH });
  }

  const py = balcH;
  // Public column stacked: living (top) → dining → kitchen (bottom)
  rooms.push({ type: 'living_room', x: privW, y: py,             width: pubW, height: livH });
  rooms.push({ type: 'dining',      x: privW, y: py + livH,      width: pubW, height: dinH });
  rooms.push({ type: 'kitchen',     x: privW, y: py+livH+dinH,   width: pubW, height: kitH });

  // Private column (LEFT): bedrooms with baths on RIGHT edge of column
  let bathIdx = 0;
  for (let i = 0; i < beds; i++) {
    const bedType = i === 0 ? 'master_bedroom' : 'bedroom';
    const hasBath = bathIdx < baths;
    const bedY    = balcH + i * privBedH;
    const rowH    = i === beds - 1 ? (H - bedY) : privBedH;

    if (hasBath) {
      rooms.push({ type: bedType,    x: 0,          y: bedY, width: privBedW, height: rowH });
      rooms.push({ type: 'bathroom', x: privBedW,   y: bedY, width: bathWP,   height: rowH });
      bathIdx++;
    } else {
      rooms.push({ type: bedType, x: 0, y: bedY, width: privW, height: rowH });
    }
  }

  if (hasStairs) rooms.push(_staircaseRoom(req.staircase_type, req.staircase_position, W, H));
  return rooms;
}

/**
 * Plan 3 — Service-Front Open Plan
 * Kitchen RIGHT | Dining LEFT at the FRONT (after a partial offset balcony),
 * then a generous living room below the service zone,
 * then bedrooms at the rear.
 * Bath on LEFT side of bedroom rows (opposite of Plan 1).
 * Falls back to linear on tight plots.
 */
function buildSmartServiceFront(W, H, req) {
  const beds      = clp(parseInt(req.bedrooms  || 2), 1, 6);
  const baths     = clp(parseInt(req.bathrooms || 2), 0, beds);
  const hasStairs = (req.floors || 1) > 1;

  const bathW = clp(Math.round(W * 0.28), 6, 9);
  const bedW  = W - bathW;
  const regBeds = Math.max(0, beds - 1);
  const regRows = Math.ceil(regBeds / 2);

  const totalBedRowsSF = 1 + regRows;
  const minTotalHSF = VM.balc + VM.serv + VM.liv + totalBedRowsSF * VM.bed;
  const includeBalc = H >= minTotalHSF;
  const balcH = includeBalc ? VM.balc : 0;
  const remainH = H - balcH;

  const [servH, livH, totalBedHSF] = _zoneHeights(remainH, [
    { min: VM.serv,                    shares: 1.5 },
    { min: VM.liv,                     shares: 2   },
    { min: VM.bed * totalBedRowsSF,    shares: 1.5 * totalBedRowsSF },
  ]);
  const eachBedHSF = Math.max(1, Math.floor(totalBedHSF / totalBedRowsSF));

  if (livH < 2) return buildSmartLinear(W, H, req);

  const rooms = [];
  let y = 0;

  if (includeBalc) {
    // Offset balcony on the RIGHT side — distinctive from Plan 1's full-width balcony
    const balW = r2(W * 0.62);
    rooms.push({ type: 'balcony', x: W - balW, y, width: balW, height: balcH });
    y += balcH;
  }

  // Service row FIRST (kitchen RIGHT, dining LEFT — opposite of Plan 1)
  const kitW = r2(W * 0.46);
  const dinW = W - kitW;
  rooms.push({ type: 'dining',  x: 0,    y, width: dinW, height: servH });
  rooms.push({ type: 'kitchen', x: dinW, y, width: kitW, height: servH });
  y += servH;

  // Living room below service — open to garden/rear
  rooms.push({ type: 'living_room', x: 0, y, width: W, height: livH });
  y += livH;

  // Bedroom rows: bath on LEFT (opposite of Plan 1)
  if (baths >= 1) {
    rooms.push({ type: 'bathroom',       x: 0,     y, width: bathW, height: eachBedHSF });
    rooms.push({ type: 'master_bedroom', x: bathW, y, width: bedW,  height: eachBedHSF });
  } else {
    rooms.push({ type: 'master_bedroom', x: 0, y, width: W, height: eachBedHSF });
  }
  y += eachBedHSF;

  // Regular beds: also bath on LEFT
  const regRows2 = Math.ceil(regBeds / 2);
  let bathIdx = baths >= 1 ? 1 : 0;
  for (let row = 0; row < regRows2; row++) {
    const bedsInRow = Math.min(2, regBeds - row * 2);
    const rowH      = row === regRows2 - 1 ? (H - y) : eachBedHSF;

    if (bedsInRow === 1) {
      if (bathIdx < baths) {
        rooms.push({ type: 'bathroom', x: 0,     y, width: bathW, height: rowH });
        rooms.push({ type: 'bedroom',  x: bathW, y, width: bedW,  height: rowH });
        bathIdx++;
      } else {
        rooms.push({ type: 'bedroom', x: 0, y, width: W, height: rowH });
      }
    } else {
      if (bathIdx < baths) {
        const bw  = clp(Math.round(W * 0.19), 6, 9);
        const bw1 = r2((W - bw) / 2);
        rooms.push({ type: 'bedroom',  x: 0,        y, width: bw1,      height: rowH });
        rooms.push({ type: 'bathroom', x: bw1,      y, width: bw,       height: rowH });
        rooms.push({ type: 'bedroom',  x: bw1 + bw, y, width: W-bw1-bw, height: rowH });
        bathIdx++;
      } else {
        const w1 = r2(W / 2);
        rooms.push({ type: 'bedroom', x: 0,  y, width: w1,     height: rowH });
        rooms.push({ type: 'bedroom', x: w1, y, width: W - w1, height: rowH });
      }
    }
    y += rowH;
  }

  if (hasStairs) rooms.push(_staircaseRoom(req.staircase_type, req.staircase_position, W, H));
  return rooms;
}


// ─── Smart stream generator: deterministic rule-based, instant results ─────────
// Encodes all validator rules directly — no AI calls, no retries, scores >90.
// onPlanReady(layout, index, attempts) is called for each completed plan.

/**
 * generateLayoutVariationsStream
 *
 * Architecture:
 *   GEMINI = the BRAIN  → decides which 3 layouts work best, names them,
 *                          explains the engineering rationale (one API call)
 *   SMART BUILDERS = the HANDS → execute the layout with guaranteed valid scores
 *
 * This gives genuine AI intelligence (unique plans per requirements) +
 * reliable high scores (smart builders are validator-aware).
 */
async function generateLayoutVariationsStream(plot, requirements, preferences = {}, count = 3, onPlanReady) {
  const { getDesignRecommendations, callGemini } = require('../src/ai/geminiPrompt');
  // resolveLayout removed — Gemini now outputs x/y/width/height directly
  const { TYPE_TO_FRONTEND }                     = require('../src/knowledge/physicalRules');

  const plotData  = parsePlot(plot);
  const req       = parseRequirements(requirements);
  const prefs     = parsePreferences(preferences);
  const buildable = getBuildable(plotData);
  const W = buildable.width, H = buildable.length;

  // Builder map — indexed by style string
  const BUILDERS = {
    'linear':        () => buildSmartLinear(W, H, req),
    'private-wing':  () => buildSmartPrivateWing(W, H, req),
    'service-front': () => buildSmartServiceFront(W, H, req),
  };

  // Default configs (used when Gemini is unavailable)
  const DEFAULT_CONFIGS = [
    { style: 'linear',        theme: 'Modern Minimalist',    planName: `${req.bedrooms}BHK Linear Home`,        engineerThinking: 'Full-width horizontal zoning — balcony at front, living in middle, bedrooms at rear. Maximises cross-ventilation across the full plot width.',       vastuCompliant: false, sunlightStrategy: 'East-facing kitchen gets morning light.', ventilationStrategy: 'Full-width rooms allow cross-ventilation.' },
    { style: 'private-wing',  theme: 'Contemporary Indian',  planName: `${req.bedrooms}BHK Private Wing`,       engineerThinking: 'Bedrooms clustered in a private left column away from road noise. Living and kitchen stack on the right for easy service access.',                   vastuCompliant: false, sunlightStrategy: 'South-west bedrooms avoid morning road noise.', ventilationStrategy: 'Column separation creates natural airflow corridors.' },
    { style: 'service-front', theme: 'Traditional Elegance', planName: `${req.bedrooms}BHK Garden Living`,      engineerThinking: 'Kitchen and dining near the road for service convenience. Living room opens to the rear garden — the family zone is calm and private.',            vastuCompliant: false, sunlightStrategy: 'Living room faces garden for afternoon light.', ventilationStrategy: 'Kitchen vents to road side; living to garden.' },
  ];

  // ── Step 1: Get Gemini's design recommendations (one call, all 3 plans) ────
  let configs = DEFAULT_CONFIGS;
  if (process.env.GEMINI_API_KEY) {
    try {
      const userParams = {
        plotWidth:  plotData.width,
        plotHeight: plotData.length,
        facing:     plotData.facing || 'North',
        bedrooms:   req.bedrooms,
        bathrooms:  req.bathrooms,
        city:       preferences.city || 'Central India',
        setbacks: {
          front: plotData.setback?.front || 3,
          rear:  plotData.setback?.back  || 3,
          left:  plotData.setback?.left  || 2,
          right: plotData.setback?.right || 2,
        },
      };
      const recs = await getDesignRecommendations(userParams);
      if (recs?.plans?.length >= 3) {
        configs = recs.plans.map(p => ({
          style:              p.style || 'linear',
          theme:              p.theme || 'Modern Minimalist',
          planName:           p.planName,
          engineerThinking:   p.engineerThinking,
          vastuCompliant:     p.vastuCompliant ?? false,
          sunlightStrategy:   p.sunlightStrategy,
          ventilationStrategy:p.ventilationStrategy,
        }));
        console.log('  Gemini provided recommendations:', configs.map(c => c.style).join(', '));
      }
    } catch (err) {
      console.warn('  Gemini design recommendations failed:', err.message, '— using defaults');
    }
  }

  // ── Guarantee each plan uses a DIFFERENT visual builder ────────────────────
  // Even if Gemini recommends same style for multiple plans, force distinct styles
  // so the 3 plans are always visually different.
  {
    const allStyles  = ['linear', 'private-wing', 'service-front'];
    const seenStyles = new Set();
    const unused     = () => allStyles.find(s => !seenStyles.has(s));

    configs = configs.map(c => {
      const s = allStyles.includes(c.style) ? c.style : allStyles[0];
      if (!seenStyles.has(s)) {
        seenStyles.add(s);
        return { ...c, style: s };
      }
      // Duplicate — replace with next unused style
      const replacement = unused();
      if (replacement) seenStyles.add(replacement);
      return { ...c, style: replacement || s };
    });
    console.log('  Assigned styles:', configs.map(c => c.style).join(', '));
  }

  // ── Pre-score every builder once so recovery can pick intelligently ─────────
  const styleScores = {};
  for (const s of ['linear', 'private-wing', 'service-front']) {
    try {
      const r = BUILDERS[s]();
      resolveOverlaps(r, buildable);
      const l = buildVariationFromAIRooms(plotData, prefs, buildable,
        { rooms: r, designTheme: s, layoutStyle: s, description: s }, 0);
      styleScores[s] = l.validation?.score ?? 0;
    } catch { styleScores[s] = 0; }
  }
  console.log('  Style scores:', JSON.stringify(styleScores));

  // ── Step 2: AI-First — Gemini designs actual rooms, validator scores, smart builder fallback ──
  //
  //  Pipeline per plan:
  //   A. callGemini(style) → band/col/sizeWeight decisions (actual room layout)
  //   B. resolveLayout()   → pixel coords → convert to feet
  //   C. buildVariationFromAIRooms() → doors/windows/validator score
  //   D. If score < 65, smart builder fallback (guaranteed valid rooms)
  //   E. Overlay Gemini's planName/engineerThinking onto whichever layout won

  const generator      = process.env.GEMINI_API_KEY ? 'gemini-ai-first' : 'rule-based';
  const assignedStyles = configs.map(c => c.style);
  const buildableW     = buildable.width;
  const buildableH     = buildable.length;

  const n = Math.min(count, configs.length);
  for (let i = 0; i < n; i++) {
    const cfg   = configs[i];
    const style = cfg.style;

    // ── A: Try Gemini actual room design ────────────────────────────────────
    let rooms    = null;
    let aiSource = 'rule-based';

    if (process.env.GEMINI_API_KEY) {
      try {
        const sb = plotData.setback || {};
        const geminiPlan = await callGemini({
          plotWidth:  plotData.width,
          plotHeight: plotData.length,
          facing:     (plotData.facing || 'NORTH').toUpperCase(),
          bedrooms:   req.bedrooms,
          bathrooms:  req.bathrooms,
          style:      cfg.theme || style,
          priorities: ['natural light', 'privacy', 'ventilation'],
          setbacks: {
            front: sb.front || 6,
            rear:  sb.back  || 4,
            left:  sb.left  || 4,
            right: sb.right || 4,
          },
          city: preferences.city || 'Central India',
        });

        // Gemini now returns x/y/width/height directly — no resolveLayout needed
        if (geminiPlan?.rooms?.length >= 3) {
          const ftRooms = geminiPlan.rooms
            .filter(r => r.type && r.width > 0 && r.height > 0)
            .map(r => ({
              type:         TYPE_TO_FRONTEND[r.type] || r.type,
              label:        r.label,
              x:            Math.max(0, Number(r.x)      || 0),
              y:            Math.max(0, Number(r.y)      || 0),
              width:        Math.max(1, Number(r.width)  || 8),
              height:       Math.max(1, Number(r.height) || 8),
              windowWall:   r.windowWall   || 'none',
              doorWall:     r.doorWall     || 'south',
              platformWall: r.platformWall || 'none',
            }))
            // Clamp to buildable area
            .map(r => ({
              ...r,
              x:      Math.min(r.x,      buildableW - r.width),
              y:      Math.min(r.y,      buildableH - r.height),
              width:  Math.min(r.width,  buildableW),
              height: Math.min(r.height, buildableH),
            }));

          if ((req.floors || 1) > 1) {
            ftRooms.push(_staircaseRoom(req.staircase_type, req.staircase_position, buildableW, buildableH));
          }

          // Store metadata for feedback loop
          ftRooms._geminiMeta = {
            planName:            geminiPlan.planName,
            layoutType:          geminiPlan.layoutType,
            engineerThinking:    geminiPlan.engineerThinking,
            vastuCompliant:      geminiPlan.vastuCompliant,
            sunlightStrategy:    geminiPlan.sunlightStrategy,
            ventilationStrategy: geminiPlan.ventilationStrategy,
          };

          rooms    = ftRooms;
          aiSource = 'gemini-room-design';
          console.log(`  Plan ${i + 1}: Gemini designed ${rooms.length} rooms for ${plotData.width}×${plotData.length}ft ${plotData.facing}-facing`);
        }
      } catch (err) {
        console.warn(`  Plan ${i + 1}: Gemini room design failed (${err.message}) — using smart builder`);
      }
    }

    // ── D: Smart builder fallback if Gemini failed or returned too few rooms ─
    if (!rooms || rooms.length < 3) {
      rooms    = BUILDERS[style]();
      aiSource = 'smart-builder';
    }

    resolveOverlaps(rooms, buildable);

    let layout = buildVariationFromAIRooms(plotData, prefs, buildable, {
      rooms,
      designTheme: cfg.theme || style,
      layoutStyle: style,
      description: cfg.planName || `${req.bedrooms}BHK ${style} plan`,
    }, i);

    // ── D2: Recovery — if score < 65, try smart builders (never reuse another plan's style) ──
    if ((layout.validation?.score ?? 0) < 65) {
      const candidates = ['private-wing', 'linear', 'service-front']
        .filter(s => s !== style && !assignedStyles.slice(0, i).includes(s) && !assignedStyles.slice(i + 1).includes(s));
      let bestScore = layout.validation?.score ?? 0;
      for (const candidate of candidates) {
        const fbRooms = BUILDERS[candidate]();
        resolveOverlaps(fbRooms, buildable);
        const fbLayout = buildVariationFromAIRooms(plotData, prefs, buildable, {
          rooms: fbRooms,
          designTheme: cfg.theme || candidate,
          layoutStyle: candidate,
          description: cfg.planName || `${req.bedrooms}BHK ${candidate}`,
        }, i);
        const fbScore = fbLayout.validation?.score ?? 0;
        if (fbScore > bestScore) {
          bestScore = fbScore;
          layout    = fbLayout;
          aiSource  = `smart-builder-recovery(${candidate})`;
        }
        if (bestScore >= 75) break;
      }
    }

    // ── E: Overlay Gemini's design intelligence ──────────────────────────────
    layout.planName            = cfg.planName;
    layout.engineerThinking    = cfg.engineerThinking;
    layout.vastuCompliant      = cfg.vastuCompliant;
    layout.sunlightStrategy    = cfg.sunlightStrategy;
    layout.ventilationStrategy = cfg.ventilationStrategy;
    layout.metadata = {
      ...layout.metadata,
      designTheme: cfg.planName || cfg.theme,
      layoutStyle: style,
      generator,
      aiSource,
    };

    const score = layout.validation?.score ?? 0;
    console.log(`  Plan ${i + 1} (${style}) [${aiSource}]: "${cfg.planName || cfg.theme}" score=${score}`);

    // ── Feedback loop: save high-scoring Gemini plans to grow the example library ──
    // Only saves plans Gemini actually designed (not smart-builder fallbacks).
    if (aiSource === 'gemini-room-design' && score >= 85) {
      try {
        const { saveGoodPlan } = require('../src/ai/exampleCollector');
        const geminiInput = {
          plotWidth:  plotData.width,
          plotHeight: plotData.length,
          facing:     (plotData.facing || 'NORTH').toUpperCase(),
          bedrooms:   req.bedrooms,
          bathrooms:  req.bathrooms,
          style:      cfg.theme || style,
        };
        const meta = rooms._geminiMeta || {};
        const geminiPlan = {
          planName:            meta.planName            || layout.planName,
          layoutType:          meta.layoutType          || style,
          engineerThinking:    meta.engineerThinking    || layout.engineerThinking,
          vastuCompliant:      meta.vastuCompliant      ?? layout.vastuCompliant,
          sunlightStrategy:    meta.sunlightStrategy    || layout.sunlightStrategy,
          ventilationStrategy: meta.ventilationStrategy || layout.ventilationStrategy,
          rooms: rooms.filter(r => r.type).map(r => ({
            type:         r.type,
            label:        r.label,
            x:            r.x,
            y:            r.y,
            width:        r.width,
            height:       r.height,
            windowWall:   r.windowWall   || 'none',
            doorWall:     r.doorWall     || 'south',
            platformWall: r.platformWall || 'none',
          })),
        };
        // Fire-and-forget — never block plan delivery
        saveGoodPlan(geminiInput, geminiPlan, score).catch(err =>
          console.warn('  [exampleCollector] Save failed:', err.message)
        );
      } catch (err) {
        console.warn('  [exampleCollector] Save failed:', err.message);
      }
    }

    await onPlanReady(layout, i, 0);
  }
}

// ─── Rule-based fallback: always produces valid layouts ───────────────────────

function generateFallbackLayouts(plotData, prefs, buildable, req, count) {
  const W = buildable.width, H = buildable.length;
  const results = [];

  const layoutBuilders = [
    () => buildSmartLinear(W, H, req),
    () => buildSmartPrivateWing(W, H, req),
    () => buildSmartServiceFront(W, H, req),
    () => buildOpenPlanRooms(W, H, req),
    () => buildCompactRooms(W, H, req),
  ];

  const themes = ['Modern Minimalist', 'Contemporary', 'Traditional Elegance', 'Scandinavian', 'Vastu Compliant'];
  const styles = ['linear', 'private-wing', 'service-front', 'open-plan', 'compact'];

  for (let i = 0; i < Math.min(count, layoutBuilders.length); i++) {
    const rooms = layoutBuilders[i]();
    resolveOverlaps(rooms, buildable);
    const aiData = {
      rooms,
      designTheme: themes[i],
      layoutStyle: styles[i],
      description: `Fallback ${styles[i]} plan`,
    };
    results.push(buildVariationFromAIRooms(plotData, prefs, buildable, aiData, i));
  }

  if (results.length === 0) throw new Error('Could not generate any valid floor plan. Please adjust your plot dimensions or requirements.');
  return results;
}

// Layout builder helpers — all return rooms in buildable-relative coords


function buildLShapeRooms(W, H, req) {
  const rooms = [];
  const balH = 5, balW = r2(W * 0.65), balX = r2(W * 0.35); // right-aligned 65%
  rooms.push({ type: 'balcony', x: balX, y: 0, width: balW, height: balH });

  const leftW = r2(W * 0.55), rightW = r2(W - W * 0.55);
  const remH = H - balH;

  const livH = r2(remH * 0.4);
  const dinH = r2(remH * 0.3);
  const kitH = r2(remH - livH - dinH);
  rooms.push({ type: 'living_room', x: 0,     y: balH,              width: leftW, height: livH });
  rooms.push({ type: 'dining',      x: 0,     y: balH + livH,       width: leftW, height: dinH });
  rooms.push({ type: 'kitchen',     x: 0,     y: balH + livH + dinH, width: leftW, height: kitH });

  distributePrivateRooms(rooms, rightW, balH, remH, req, leftW);
  return rooms;
}

function buildOpenPlanRooms(W, H, req) {
  const rooms = [];
  const balH = 5;
  rooms.push({ type: 'balcony', x: 0, y: 0, width: W, height: balH });

  const openH = Math.min(14, H * 0.25);
  const livW = r2(W * 0.4), dinW = r2(W * 0.3), kitW = r2(W - W * 0.4 - W * 0.3);
  rooms.push({ type: 'living_room', x: 0,            y: balH, width: livW, height: r2(openH) });
  rooms.push({ type: 'dining',      x: livW,          y: balH, width: dinW, height: r2(openH) });
  rooms.push({ type: 'kitchen',     x: livW + dinW,   y: balH, width: kitW, height: r2(openH) });

  distributePrivateRooms(rooms, W, balH + openH, H - balH - openH, req);
  return rooms;
}

function buildCompactRooms(W, H, req) {
  const rooms = [];
  const balH = 5, balW = r2(W * 0.75), balX = r2((W - W * 0.75) / 2); // center 75%
  rooms.push({ type: 'balcony', x: balX, y: 0, width: balW, height: balH });

  const corrW = 3.5;
  const leftW = r2((W - corrW) * 0.5);
  const rightW = r2(W - corrW - leftW);
  const corrX = leftW;
  const remH = H - balH;

  const livH = r2(remH * 0.4);
  const dinH = r2(remH - livH);
  rooms.push({ type: 'living_room', x: 0,     y: balH,          width: leftW,  height: livH });
  rooms.push({ type: 'dining',      x: 0,     y: balH + livH,   width: leftW,  height: dinH });
  rooms.push({ type: 'kitchen',     x: corrX + corrW, y: balH, width: rightW, height: r2(remH * 0.35) });

  distributePrivateRooms(rooms, rightW, balH + remH * 0.35, H - balH - remH * 0.35, req, corrX + corrW);
  return rooms;
}

function distributePrivateRooms(rooms, W, startY, totalH, req, offsetX = 0) {
  const beds  = parseInt(req.bedrooms  || 2);
  const baths = parseInt(req.bathrooms || 2);

  if (totalH < 8 || W < 11) return;

  // Each bedroom row: bedroom on left + en-suite bathroom on right (same row, touching wall)
  // This guarantees bathroom-bedroom adjacency and prevents isolated bathrooms.
  const BATH_W = Math.min(9, Math.max(7, Math.round(W * 0.28)));
  const BED_W  = W - BATH_W;

  const extras = [];
  if (parseInt(req.study || 0) > 0) extras.push('study');
  if (req.prayer_room)              extras.push('prayer_room');

  const totalRows = beds + extras.length;
  if (totalRows === 0) return;

  const rowH = r2(totalH / totalRows);

  for (let i = 0; i < beds; i++) {
    const bedType = i === 0 ? 'master_bedroom' : 'bedroom';
    const hasBath = i < baths;
    const y = r2(startY + i * rowH);

    if (hasBath) {
      // Bedroom on left, its en-suite bathroom on the right — share a vertical wall
      rooms.push({ type: bedType,   x: r2(offsetX),          y, width: r2(BED_W),  height: rowH });
      rooms.push({ type: 'bathroom',x: r2(offsetX + BED_W),  y, width: BATH_W,     height: Math.min(rowH, 10) });
    } else {
      rooms.push({ type: bedType,   x: r2(offsetX), y, width: W, height: rowH });
    }
  }

  // If more bathrooms than bedrooms, split the last bathroom slot into two
  if (baths > beds && beds > 0) {
    const lastBath = [...rooms].reverse().find(r => r.type === 'bathroom');
    if (lastBath) {
      const halfW = Math.max(6, Math.round(lastBath.width / 2));
      lastBath.width = halfW;
      rooms.push({ type: 'bathroom', x: r2(lastBath.x + halfW), y: lastBath.y, width: Math.max(6, BATH_W - halfW), height: lastBath.height });
    }
  }

  // Extra rooms (study, prayer_room) fill additional rows after bedrooms
  for (let i = 0; i < extras.length; i++) {
    const y = r2(startY + (beds + i) * rowH);
    rooms.push({ type: extras[i], x: r2(offsetX), y, width: W, height: rowH });
  }
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
  const hasTotalBeds = hasMaster + hasRegular; // eslint-disable-line no-unused-vars

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
  const MAX_ITER = 150;

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

// ─── Trim remaining overlaps by shrinking the later room on each pair ────────
// Called after resolveOverlaps to guarantee zero overlap (push-apart can oscillate).

function trimOverlaps(rooms, buildable) {
  const W = buildable.width, H = buildable.length;

  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const a = rooms[i], b = rooms[j];
        const ox = Math.min(a.x + a.width,  b.x + b.width)  - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        if (ox <= 0.1 || oy <= 0.1) continue;

        // Use ROOM_MIN for the trimmed room so it never goes below its minimum size
        const minBW = ROOM_MIN[b.type]?.w ?? 5;
        const minBH = ROOM_MIN[b.type]?.h ?? 5;

        if (ox <= oy) {
          if (b.x + b.width / 2 >= a.x + a.width / 2) {
            const newX = r2(a.x + a.width);
            b.width  = Math.max(minBW, r2(b.x + b.width - newX));
            b.x      = Math.min(newX, W - b.width);
          } else {
            b.width = Math.max(minBW, r2(a.x - b.x));
          }
        } else {
          if (b.y + b.height / 2 >= a.y + a.height / 2) {
            const newY = r2(a.y + a.height);
            b.height = Math.max(minBH, r2(b.y + b.height - newY));
            b.y      = Math.min(newY, H - b.height);
          } else {
            b.height = Math.max(minBH, r2(a.y - b.y));
          }
        }
        b.x = Math.max(0, Math.min(W - b.width,  b.x));
        b.y = Math.max(0, Math.min(H - b.height, b.y));
      }
    }
  }
  return rooms;
}

// ─── Fill gaps left after trimming by expanding rooms into empty space ────────

function fillGaps(rooms, buildable) {
  const W = buildable.width, H = buildable.length;

  for (const room of rooms) {
    const maxW = ROOM_MAX[room.type]?.w ?? W;
    const maxH = ROOM_MAX[room.type]?.h ?? H;

    // Extend right edge toward nearest wall/room that shares vertical overlap
    const rightEdge = r2(room.x + room.width);
    if (room.width < maxW) {
      const nearestRight = rooms
        .filter(r => r !== room
          && r.x >= rightEdge - 0.1
          && Math.max(r.y, room.y) < Math.min(r.y + r.height, room.y + room.height) - 0.5)
        .reduce((m, r) => Math.min(m, r.x), W);
      if (nearestRight - rightEdge > 1) {
        room.width = r2(Math.min(maxW, nearestRight - room.x));
      }
    }

    // Extend bottom edge toward nearest wall/room that shares horizontal overlap
    const bottomEdge = r2(room.y + room.height);
    if (room.height < maxH) {
      const nearestDown = rooms
        .filter(r => r !== room
          && r.y >= bottomEdge - 0.1
          && Math.max(r.x, room.x) < Math.min(r.x + r.width, room.x + room.width) - 0.5)
        .reduce((m, r) => Math.min(m, r.y), H);
      if (nearestDown - bottomEdge > 1) {
        room.height = r2(Math.min(maxH, nearestDown - room.y));
      }
    }
  }

  return rooms;
}

// ─── Enforce architectural room-size hierarchy ────────────────────────────────
// Rule: living_room = largest habitable room; bathrooms = smallest habitable room

function enforceRoomHierarchy(rooms) {
  const baths  = rooms.filter(r => r.type === 'bathroom');
  const beds   = rooms.filter(r => ['master_bedroom','bedroom','guest_room'].includes(r.type));
  const living = rooms.filter(r => r.type === 'living_room');

  // 1. Every bathroom must be smaller (by area) than every bedroom
  baths.forEach(bath => {
    beds.forEach(bed => {
      if (bath.width * bath.height >= bed.width * bed.height) {
        const factor = Math.sqrt((bed.width * bed.height * 0.65) / (bath.width * bath.height));
        bath.width  = r2(Math.max(ROOM_MIN.bathroom.w, Math.min(ROOM_MAX.bathroom.w, bath.width  * factor)));
        bath.height = r2(Math.max(ROOM_MIN.bathroom.h, Math.min(ROOM_MAX.bathroom.h, bath.height * factor)));
      }
    });
  });

  // 2. Living room must have more area than any other habitable room
  const habitable = rooms.filter(r => !['balcony','terrace','bathroom','utility_room'].includes(r.type)
                                    && r.type !== 'living_room');
  living.forEach(liv => {
    const livArea = liv.width * liv.height;
    habitable.forEach(other => {
      if (other.width * other.height >= livArea) {
        const factor = Math.sqrt(livArea / (other.width * other.height)) * 0.93;
        const mn = ROOM_MIN[other.type] || { w: 8, h: 8 };
        other.width  = r2(Math.max(mn.w, other.width  * factor));
        other.height = r2(Math.max(mn.h, other.height * factor));
      }
    });
  });

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

    // Clamp to ROOM_MIN/ROOM_MAX so downstream rendering is never pathological
    const minW = ROOM_MIN[r.type]?.w ?? 3, minH = ROOM_MIN[r.type]?.h ?? 3;
    const maxW = ROOM_MAX[r.type]?.w ?? W, maxH = ROOM_MAX[r.type]?.h ?? H;
    r.width  = Math.max(minW, Math.min(maxW, r.width));
    r.height = Math.max(minH, Math.min(maxH, r.height));
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
  const staircase  = placeStaircase(buildable, prefs.customIdea || '', rooms);
  const parking    = placeParking(plotData, buildable, prefs.parking);
  const setbackZones = buildSetbackZones(plotData);

  const layout = {
    plot: plotData, rooms, walls, doors, windows,
    staircase, parking, setbackZones,
    dimensions: buildDimensions(plotData),
    metadata: {
      version: 4,
      generatedAt: new Date().toISOString(),
      generatorType: 'ai',
      designTheme:   aiData.designTheme || `AI Plan ${index + 1}`,
      description: aiData.description || '',
      layoutStyle: aiData.layoutStyle || 'ai-generated',
      constraints: { minRoomSize: ROOM_MIN, setbacks: plotData.setback }
    }
  };

  // Schema check (structural)
  const schema = schemaValidatePlan(layout);
  if (!schema.isValid) console.warn('Schema warnings:', schema.errors);

  // Quality validation — run and attach result; auto-fix if possible
  let finalLayout = layout;
  const quality = validatePlan(layout);
  if (!quality.isValid) {
    const fixed = autoFix(layout, quality.errors);
    if (fixed) {
      finalLayout = fixed.plan;
      finalLayout.metadata.wasFixed = true;
    }
  }
  finalLayout.validation = validatePlan(finalLayout); // attach final quality score
  return finalLayout;
}
const ROOM_LABELS = {
  living_room: 'Living Room', dining: 'Dining', kitchen: 'Kitchen',
  master_bedroom: 'Master Bed', bedroom: 'Bedroom', bathroom: 'Bathroom',
  study: 'Study', balcony: 'Balcony', terrace: 'Terrace',
  prayer_room: 'Prayer Room', guest_room: 'Guest Room', utility_room: 'Utility',
  staircase: 'Staircase', entry: 'Entry / Foyer', corridor: 'Corridor',
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
    bedrooms:           parseInt(req.bedrooms     ?? req.numBedrooms  ?? 2),
    bathrooms:          parseInt(req.bathrooms    ?? req.numBathrooms ?? 2),
    living_room:        req.living_room  !== false ? 1 : 0,
    dining:             req.dining       !== false ? 1 : 0,
    kitchen:            req.kitchen      !== false ? 1 : 0,
    balcony:            req.balcony      !== false ? 1 : 0,
    study:              parseInt(req.study        ?? 0),
    prayer_room:        req.prayer_room  ? 1 : 0,
    guest_room:         parseInt(req.guest_room   ?? 0),
    utility_room:       parseInt(req.utility_room ?? 0),
    floors:             parseInt(req.floors       ?? 1),
    staircase_type:     req.staircase_type     || 'dog-leg',   // dog-leg | straight | spiral
    staircase_position: req.staircase_position || 'center',    // center | corner | side
  };
}

function parsePreferences(prefs = {}) {
  return {
    vastu:      prefs.vastu      || false,
    parking:    prefs.parking    || { cars: 1, gate_direction: 'left' },
    style:      prefs.style      || 'modern',
    customIdea: prefs.customIdea || '',
  };
}

function getBuildable(plotData) {
  const sb = plotData.setback;
  return {
    x:      sb.left,
    y:      sb.front,
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

  // 1. Main entry — wide double door (6ft) on front wall.
  // CRITICAL: Entry MUST open into a living/dining/entry room — NEVER kitchen or bathroom.
  // Find the best front room (lowest y, highest priority) and center the door on it.
  const ENTRY_PRIORITY = {
    entry: 0, living_room: 1, dining: 2, balcony: 3,
    master_bedroom: 4, bedroom: 4, study: 5, guest_room: 5,
    utility_room: 6, kitchen: 99, bathroom: 100,
  };
  const frontThreshold = buildable.y + Math.min(buildable.length * 0.35, 15);
  const frontRooms = rooms
    .filter(r => r.y <= frontThreshold)
    .sort((a, b) => {
      const pa = ENTRY_PRIORITY[a.type] ?? 50;
      const pb = ENTRY_PRIORITY[b.type] ?? 50;
      if (pa !== pb) return pa - pb;
      return a.y - b.y; // prefer rooms closer to road
    });
  let mainDoorX;
  if (frontRooms.length > 0) {
    const entryRoom = frontRooms[0]; // best room (non-kitchen priority)
    mainDoorX = r2(entryRoom.x + entryRoom.width / 2 - 3);
  } else {
    // Fallback: parking-side geometry
    const parkSide = prefs.parking?.gate_direction || 'left';
    mainDoorX = parkSide === 'right'  ? buildable.x + buildable.width * 0.25
              : parkSide === 'center' ? buildable.x + buildable.width * 0.5 - 3
              :                         buildable.x + buildable.width * 0.65;
  }
  // Clamp within buildable width
  mainDoorX = Math.max(buildable.x, Math.min(buildable.x + buildable.width - 6, mainDoorX));
  doors.push({ x: mainDoorX, y: buildable.y, width: 6, height: 7, orientation: 'horizontal', type: 'main', label: 'ENTRY' });

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

  // 4. Dining ↔ Kitchen (open arch / wide passage)
  (byType['dining']||[]).forEach(din => (byType['kitchen']||[]).forEach(kit => {
    const pt = findShared(din, kit);
    if (pt) {
      const isV = !!(sharedV(din,kit)||sharedV(kit,din));
      doors.push({ x: pt.x, y: pt.y, width: DOOR_W + 1, height: 7, orientation: isV?'vertical':'horizontal', type: 'room' });
    }
  }));

  // 5. Bedroom ↔ Bathroom — ONE door per bathroom, via shared wall only
  const bathsDone = new Set();
  ['master_bedroom','bedroom','guest_room'].forEach(bt =>
    (byType[bt]||[]).forEach(bed => {
      (byType['bathroom']||[]).forEach((bath, bi) => {
        if (bathsDone.has(bi)) return;
        const pt = findShared(bed, bath);
        if (pt) {
          const isV = !!(sharedV(bed,bath)||sharedV(bath,bed));
          doors.push({ x: pt.x, y: pt.y, width: 2.5, height: 7, orientation: isV?'vertical':'horizontal', type: 'bathroom' });
          bathsDone.add(bi);
        }
      });
    })
  );

  // 6. Passage door on every private room (NOT bathrooms — they only open into bedrooms)
  ['master_bedroom','bedroom','study','guest_room','prayer_room','utility_room'].forEach(bt =>
    (byType[bt]||[]).forEach(r =>
      doors.push({ x: r.x + r.width * 0.3, y: r.y, width: DOOR_W, height: 7, orientation: 'horizontal', type: 'room' })
    )
  );

  // 7. Guarantee every room has at least one door
  //    Bathrooms: door must face their nearest bedroom; other rooms: fallback on top wall
  const allBeds = rooms.filter(r => ['master_bedroom','bedroom','guest_room'].includes(r.type));
  rooms.forEach(r => {
    const TOL = 1.5;
    const hasDoor = doors.some(d => {
      const onFront = Math.abs(d.y - r.y) < TOL              && d.x >= r.x - TOL && d.x < r.x + r.width;
      const onBack  = Math.abs(d.y - (r.y + r.height)) < TOL && d.x >= r.x - TOL && d.x < r.x + r.width;
      const onLeft  = Math.abs(d.x - r.x) < TOL              && d.y >= r.y - TOL && d.y < r.y + r.height;
      const onRight = Math.abs(d.x - (r.x + r.width)) < TOL  && d.y >= r.y - TOL && d.y < r.y + r.height;
      return onFront || onBack || onLeft || onRight;
    });
    if (hasDoor) return;

    if (r.type === 'bathroom') {
      // Place on wall facing nearest bedroom; skip if no bedrooms in plan
      if (allBeds.length === 0) return;
      const rCX = r.x + r.width / 2, rCY = r.y + r.height / 2;
      const nearest = allBeds.reduce((a, b) => {
        const da = Math.abs((a.x + a.width / 2) - rCX) + Math.abs((a.y + a.height / 2) - rCY);
        const db = Math.abs((b.x + b.width / 2) - rCX) + Math.abs((b.y + b.height / 2) - rCY);
        return da <= db ? a : b;
      });
      const dx = (nearest.x + nearest.width / 2) - rCX;
      const dy = (nearest.y + nearest.height / 2) - rCY;
      if (Math.abs(dx) >= Math.abs(dy)) {
        const wx = dx > 0 ? r.x + r.width : r.x;
        doors.push({ x: wx, y: r.y + r.height * 0.3, width: 2.5, height: 7, orientation: 'vertical', type: 'bathroom' });
      } else {
        const wy = dy > 0 ? r.y + r.height : r.y;
        doors.push({ x: r.x + r.width * 0.3, y: wy, width: 2.5, height: 7, orientation: 'horizontal', type: 'bathroom' });
      }
    } else {
      doors.push({ x: r.x + r.width * 0.3, y: r.y, width: DOOR_W, height: 7, orientation: 'horizontal', type: 'room' });
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

function placeStaircase(buildable, hint, rooms = []) {
  const SW = 8, SH = 10;
  const bx = buildable.x, by = buildable.y;
  const bw = buildable.width, bh = buildable.length;

  const allCorners = [
    { x: bx + bw - SW, y: by + bh - SH },  // rear-right  (default first)
    { x: bx,           y: by + bh - SH },  // rear-left
    { x: bx + bw - SW, y: by           },  // front-right
    { x: bx,           y: by           },  // front-left
  ];

  // If user asked for staircase at front, prefer front corners
  const corners = /stair.*front|front.*stair/i.test(hint || '')
    ? [allCorners[2], allCorners[3], allCorners[0], allCorners[1]]
    : allCorners;

  // Pick corner with least overlap against rooms
  const overlapArea = (sx, sy) => rooms.reduce((sum, r) => {
    const ox = Math.min(sx + SW, r.x + r.width)  - Math.max(sx, r.x);
    const oy = Math.min(sy + SH, r.y + r.height) - Math.max(sy, r.y);
    return sum + (ox > 0 && oy > 0 ? ox * oy : 0);
  }, 0);

  const best = corners.reduce((a, b) => overlapArea(a.x, a.y) <= overlapArea(b.x, b.y) ? a : b);
  return { x: best.x, y: best.y, width: SW, height: SH, type: 'staircase' };
}

function placeParking(plotData, _buildable, parkPrefs = {}) {
  const cars   = parseInt(parkPrefs.cars || 1);
  const dir    = parkPrefs.gate_direction || 'left';
  const facing = (plotData.facing || 'north').toLowerCase();
  const sb     = plotData.setback;

  let x, y, w, h;
  if (facing === 'north' || facing === 'south') {
    // Road on top (north) or bottom (south): parking is a horizontal band
    w = r2(PARK_W * cars);
    h = PARK_L;
    x = dir === 'right' ? plotData.width - w - sb.right : sb.left;
    y = facing === 'north' ? 0 : plotData.length - h;
  } else {
    // Road on left (west) or right (east): parking is a vertical strip along that side
    w = PARK_L;
    h = r2(PARK_W * cars);
    y = dir === 'right' ? plotData.length - h - sb.back : sb.front;
    x = facing === 'east' ? plotData.width - w : 0;
  }

  return { x: r2(x), y: r2(y), width: w, height: h, cars, gate_direction: dir,
    gate: { x: r2(x), y: r2(y), width: w, height: h } };
}

function buildSetbackZones(plotData) {
  const sb = plotData.setback;
  return [
    { x: 0, y: 0, width: plotData.width, height: sb.front, label: 'Front Setback', zone: 'front' },
    { x: 0, y: plotData.length - sb.back, width: plotData.width, height: sb.back, label: 'Rear Setback', zone: 'rear' },
    { x: 0, y: sb.front, width: sb.left, height: plotData.length - sb.front - sb.back, label: 'Left Setback', zone: 'left' },
    { x: plotData.width - sb.right, y: sb.front, width: sb.right, height: plotData.length - sb.front - sb.back, label: 'Right Setback', zone: 'right' },
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
  generateLayoutVariationsStream,
  MIN_ROOM_SIZES: ROOM_MIN,
  ROOM_ADJACENCY_RULES: {},
  STANDARDS: { corridor_width: CORR_W, wall_thickness: 0.3, door_width: DOOR_W, parking_width: PARK_W, parking_length: PARK_L }
};
