'use strict';
/**
 * layoutResolver.js
 * Converts Gemini's band/col/sizeWeight decisions into precise pixel rectangles.
 * Uses splitByWeights so gaps are mathematically impossible.
 */

const { ROOM_SIZES } = require('../knowledge/physicalRules');

const SCALE = 10; // px per foot

/**
 * Splits a total pixel dimension into N slots proportional to weights[].
 * Returns array of { offset, size } — mathematically gap-free.
 */
function splitByWeights(total, weights) {
  const sumW = weights.reduce((a, b) => a + b, 0);
  const slots = [];
  let cursor = 0;
  for (let i = 0; i < weights.length; i++) {
    const size = (i === weights.length - 1)
      ? total - cursor                           // last slot takes exact remainder
      : Math.round((weights[i] / sumW) * total);
    slots.push({ offset: cursor, size });
    cursor += size;
  }
  return slots;
}

/**
 * Return the maximum minH (px) of all rooms in a given band.
 * Falls back to defaultFrac * BH if the band has no rooms.
 */
function bandMinH(rooms, band, BH, defaultFrac) {
  let maxMin = 0;
  for (const room of rooms) {
    if ((room.band || 2) !== band) continue;
    const rules = ROOM_SIZES[room.type];
    if (rules) maxMin = Math.max(maxMin, rules.minH * SCALE);
  }
  return maxMin || Math.round(defaultFrac * BH);
}

/**
 * Compute band heights that:
 *  1. Respect each band's minimum room requirement
 *  2. NEVER produce negative or zero heights (safe for any plot size)
 *  3. Distribute surplus proportionally (band1:band2:band3 = 1:2:3 shares)
 */
function computeBandHeights(rooms, BH) {
  // Raw minimums — may sum > BH on small plots
  const raw = {
    1: bandMinH(rooms, 1, BH, 0.20),
    2: bandMinH(rooms, 2, BH, 0.35),
    3: bandMinH(rooms, 3, BH, 0.40),
  };

  const totalRaw = raw[1] + raw[2] + raw[3];

  // If minimums exceed BH, scale each band proportionally so they sum = BH
  // This keeps relative proportions intact on any plot size.
  const scale  = totalRaw > BH ? (BH / totalRaw) : 1;
  const scaled = {
    1: Math.max(1, Math.floor(raw[1] * scale)),
    2: Math.max(1, Math.floor(raw[2] * scale)),
    3: 0,
  };
  // Band 3 takes exact remainder — always ≥ 1 by construction
  scaled[3] = Math.max(1, BH - scaled[1] - scaled[2]);

  // If we scaled down (small plot), we're done — no surplus to distribute.
  if (scale < 1) return scaled;

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
 * geminiPlan.rooms[] each has: type, band, col, colSpan, sizeWeight
 * buildableW, buildableH are in FEET.
 *
 * Returns rooms[] with added: x, y, w, h, widthFt, heightFt, areaFt
 * (x/y/w/h are in pixels relative to the buildable area origin)
 */
function resolveLayout(geminiPlan, buildableW, buildableH) {
  const BW = buildableW * SCALE;
  const BH = buildableH * SCALE;

  // --- 1. Compute safe band heights ---
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

  // --- 3. For each band, lay out rooms left-to-right by col (then sizeWeight) ---
  const resolved = [];

  for (const band of [1, 2, 3]) {
    const rooms = byBand[band];
    if (!rooms.length) continue;

    rooms.sort((a, b) => (a.col || 1) - (b.col || 1));

    const weights = rooms.map(r => Math.max(1, r.sizeWeight || 3));
    const xSlots  = splitByWeights(BW, weights);

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
