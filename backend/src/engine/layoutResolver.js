'use strict';
/**
 * layoutResolver.js
 * Converts Gemini's band/col/sizeWeight decisions into precise pixel rectangles.
 * Uses splitIntoRows + splitIntoColumns so gaps are mathematically impossible.
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
      ? total - cursor                           // last slot takes remainder
      : Math.round((weights[i] / sumW) * total);
    slots.push({ offset: cursor, size });
    cursor += size;
  }
  return slots;
}

/**
 * Compute the minimum required height (in px) for a given band.
 * This is the maximum of all room minH values in that band.
 */
function computeMinBandH(rooms, band) {
  let minH = 0;
  for (const room of rooms) {
    if ((room.band || 2) !== band) continue;
    const rules = ROOM_SIZES[room.type];
    if (rules) minH = Math.max(minH, rules.minH * SCALE);
  }
  return minH;
}

/**
 * Compute dynamic band heights so every band is at least as tall
 * as its tallest room's minimum, with remaining space distributed
 * proportionally (band 1 = 1 share, band 2 = 2 shares, band 3 = 3 shares).
 */
function computeBandHeights(rooms, BH) {
  const BAND_SHARES = { 1: 1, 2: 2, 3: 3 };

  // Step 1: compute minimum required px height for each band
  const minH = {
    1: computeMinBandH(rooms, 1),
    2: computeMinBandH(rooms, 2),
    3: computeMinBandH(rooms, 3),
  };

  // Step 2: reserve minimum for each band, distribute remainder by shares
  const totalMin  = minH[1] + minH[2] + minH[3];
  const remainder = Math.max(0, BH - totalMin);
  const totalShare = BAND_SHARES[1] + BAND_SHARES[2] + BAND_SHARES[3]; // 6

  const bandH = {
    1: minH[1] + Math.round((BAND_SHARES[1] / totalShare) * remainder),
    2: minH[2] + Math.round((BAND_SHARES[2] / totalShare) * remainder),
    3: 0, // band 3 gets exact remainder
  };
  bandH[3] = BH - bandH[1] - bandH[2];

  return bandH;
}

/**
 * resolveLayout(geminiPlan, buildableW, buildableH)
 *
 * geminiPlan.rooms[] each has: type, band, col, colSpan, sizeWeight
 * buildableW, buildableH are in FEET.
 *
 * Returns rooms[] with added: x, y, w, h, widthFt, heightFt, areaFt (all pixel coords except Ft fields)
 */
function resolveLayout(geminiPlan, buildableW, buildableH) {
  const BW = buildableW * SCALE;  // total buildable px width
  const BH = buildableH * SCALE;  // total buildable px height

  // --- 1. Compute dynamic band heights ---
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

  // --- 3. For each band, lay out rooms left-to-right by (col, sizeWeight) ---
  const resolved = [];

  for (const band of [1, 2, 3]) {
    const rooms = byBand[band];
    if (!rooms.length) continue;

    // Sort by col so the left-to-right order is stable
    rooms.sort((a, b) => (a.col || 1) - (b.col || 1));

    const weights = rooms.map(r => r.sizeWeight || 3);
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
