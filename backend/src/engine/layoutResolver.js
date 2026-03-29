'use strict';
/**
 * layoutResolver.js
 * Converts Gemini's band/col/sizeWeight decisions into precise pixel rectangles.
 *
 * Key improvement: uses room.minH and room.minW from Gemini's output directly.
 * Gemini is now the authoritative source for room minimum sizes — not a static table.
 * Static table (ROOM_SIZES) is kept only as a safety fallback.
 */

const { ROOM_SIZES } = require('../knowledge/physicalRules');

const SCALE = 10; // px per foot

/**
 * Splits a total pixel dimension into N slots proportional to weights[],
 * while guaranteeing each slot is at least its minPx.
 * Returns array of { offset, size } — gap-free.
 */
function splitByWeights(total, weights, minPxPerSlot = []) {
  const n = weights.length;

  // Step 1: give each slot its minimum first
  const mins  = weights.map((_, i) => Math.max(1, minPxPerSlot[i] || 0));
  const sumMin = mins.reduce((a, b) => a + b, 0);

  // Step 2: distribute remaining space by weight
  const surplus = Math.max(0, total - sumMin);
  const sumW    = weights.reduce((a, b) => a + b, 0);

  const sizes = [];
  let used = 0;
  for (let i = 0; i < n; i++) {
    if (i === n - 1) {
      sizes.push(Math.max(mins[i], total - used));
    } else {
      const extra = surplus > 0 ? Math.round((weights[i] / sumW) * surplus) : 0;
      const size  = mins[i] + extra;
      sizes.push(size);
      used += size;
    }
  }

  const slots = [];
  let cursor = 0;
  for (const size of sizes) {
    slots.push({ offset: cursor, size });
    cursor += size;
  }
  return slots;
}

/**
 * Return the minimum height (px) required for a given band.
 * Priority: room.minH (Gemini's explicit value) → ROOM_SIZES table → defaultFrac * BH
 */
function bandMinH(rooms, band, BH, defaultFrac) {
  let maxMin = 0;
  for (const room of rooms) {
    if ((room.band || 2) !== band) continue;

    // 1st priority: Gemini explicitly set minH for this room
    if (room.minH && room.minH > 0) {
      maxMin = Math.max(maxMin, room.minH * SCALE);
      continue;
    }

    // 2nd priority: static table fallback
    const rules = ROOM_SIZES[room.type];
    if (rules) maxMin = Math.max(maxMin, rules.minH * SCALE);
  }
  return maxMin || Math.round(defaultFrac * BH);
}

/**
 * Compute band heights that:
 *  1. Respect each band's minimum room requirement (from Gemini minH or table)
 *  2. NEVER produce negative or zero heights (safe for any plot size)
 *  3. Distribute surplus proportionally (band1:band2:band3 = 1:2:3 shares)
 */
function computeBandHeights(rooms, BH) {
  const raw = {
    1: bandMinH(rooms, 1, BH, 0.20),
    2: bandMinH(rooms, 2, BH, 0.35),
    3: bandMinH(rooms, 3, BH, 0.40),
  };

  const totalRaw = raw[1] + raw[2] + raw[3];

  // If minimums exceed BH, scale proportionally so they sum = BH
  const scale  = totalRaw > BH ? (BH / totalRaw) : 1;
  const scaled = {
    1: Math.max(1, Math.floor(raw[1] * scale)),
    2: Math.max(1, Math.floor(raw[2] * scale)),
    3: 0,
  };
  // Band 3 takes exact remainder — always ≥ 1 by construction
  scaled[3] = Math.max(1, BH - scaled[1] - scaled[2]);

  if (scale < 1) return scaled; // tight plot, no surplus

  // Distribute surplus by 1:2:3 share ratio
  const surplus = BH - scaled[1] - scaled[2] - scaled[3];
  if (surplus > 0) {
    const totalShare = 6;
    scaled[1] += Math.round((1 / totalShare) * surplus);
    scaled[2] += Math.round((2 / totalShare) * surplus);
    scaled[3]  = Math.max(1, BH - scaled[1] - scaled[2]);
  }

  return scaled;
}

/**
 * resolveLayout(geminiPlan, buildableW, buildableH)
 *
 * geminiPlan.rooms[] each has: type, band, col, colSpan, sizeWeight, minH, minW
 * buildableW, buildableH are in FEET.
 *
 * Returns rooms[] with added: x, y, w, h, widthFt, heightFt, areaFt
 * (x/y/w/h are in pixels relative to the buildable area origin)
 */
function resolveLayout(geminiPlan, buildableW, buildableH) {
  const BW = buildableW * SCALE;
  const BH = buildableH * SCALE;

  // --- 1. Compute safe band heights using Gemini minH values ---
  const bandH = computeBandHeights(geminiPlan.rooms, BH);
  const bandY = {
    1: 0,
    2: bandH[1],
    3: bandH[1] + bandH[2],
  };

  // --- 2. Group rooms by band ---
  const byBand = { 1: [], 2: [], 3: [] };
  for (const room of geminiPlan.rooms) {
    const b = room.band || 2;
    byBand[b].push(room);
  }

  // --- 3. For each band, lay out rooms left-to-right by col, respecting minW ---
  const resolved = [];

  for (const band of [1, 2, 3]) {
    const rooms = byBand[band];
    if (!rooms.length) continue;

    rooms.sort((a, b) => (a.col || 1) - (b.col || 1));

    const weights   = rooms.map(r => Math.max(1, r.sizeWeight || 3));

    // Build per-slot minimum widths from room.minW (Gemini) → table → 0
    const minPxPerSlot = rooms.map(r => {
      if (r.minW && r.minW > 0) return r.minW * SCALE;
      const rules = ROOM_SIZES[r.type];
      return rules ? rules.minW * SCALE : 0;
    });

    const xSlots = splitByWeights(BW, weights, minPxPerSlot);

    const bH = bandH[band];
    const bY = bandY[band];

    rooms.forEach((room, i) => {
      const slot = xSlots[i];
      resolved.push({
        ...room,
        x: slot.offset,
        y: bY,
        w: slot.size,
        h: bH,
        widthFt:  slot.size / SCALE,
        heightFt: bH / SCALE,
        areaFt:   (slot.size / SCALE) * (bH / SCALE),
      });
    });
  }

  return resolved;
}

module.exports = { resolveLayout, splitByWeights, computeBandHeights, SCALE };
