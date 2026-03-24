'use strict';

/**
 * Plan Auto-Fixer
 *
 * Attempts to fix common validation failures before falling back to regeneration.
 * All room coordinates are in PLOT space (including setback offset).
 */

const { validatePlan } = require('./planValidator');

const ROOM_MIN = {
  living_room:    { w: 10, h: 10, sqft: 120 },
  master_bedroom: { w: 10, h: 10, sqft: 120 },
  bedroom:        { w:  9, h: 10, sqft: 100 },
  kitchen:        { w:  8, h:  7, sqft:  60 },
  dining:         { w:  8, h: 10, sqft:  80 },
  bathroom:       { w:  5, h:  7, sqft:  35 },
  balcony:        { w:  5, h:  4, sqft:  30 },
};

const ROOM_MAX = {
  living_room:    { w: 22, h: 18 },
  master_bedroom: { w: 16, h: 15 },
  bedroom:        { w: 14, h: 13 },
  kitchen:        { w: 14, h: 12 },
  dining:         { w: 16, h: 13 },
  bathroom:       { w:  9, h: 10 },
  balcony:        { w: 50, h:  6 },
};

const r2 = v => Math.round(v * 100) / 100;
const deepCopy = obj => JSON.parse(JSON.stringify(obj));

// Are two rooms adjacent (within TOL ft)?
function adjacent(a, b, TOL = 2) {
  const overX = a.x < b.x + b.width + TOL  && a.x + a.width  > b.x - TOL;
  const overY = a.y < b.y + b.height + TOL  && a.y + a.height > b.y - TOL;
  return (
    (Math.abs(a.x - (b.x + b.width))  < TOL && overY) ||
    (Math.abs((a.x + a.width) - b.x)  < TOL && overY) ||
    (Math.abs(a.y - (b.y + b.height)) < TOL && overX) ||
    (Math.abs((a.y + a.height) - b.y) < TOL && overX)
  );
}

/**
 * Attempt to auto-fix a plan that failed validation.
 * Returns { plan, wasFixed } or null if unfixable.
 */
function autoFix(layout, errors) {
  const errorTypes = new Set(errors.map(e => e.type));
  let fixed = deepCopy(layout);

  // Apply fixes in order of severity
  if (errorTypes.has('ROOM_OVERLAP')) {
    fixed = resolveOverlaps(fixed);
  }
  if (errorTypes.has('ROOM_TOO_SMALL') || errorTypes.has('ROOM_TOO_NARROW')) {
    fixed = enlargeSmallRooms(fixed);
  }
  if (errorTypes.has('VOID_SPACE') || errorTypes.has('DISCONNECTED_ROOM')) {
    fixed = expandRoomsToFillVoids(fixed);
    // Second pass — filling may have opened new gaps
    fixed = expandRoomsToFillVoids(fixed);
  }

  const result = validatePlan(fixed);
  if (result.isValid) return { plan: fixed, wasFixed: true };

  // One more round of the most common fixes
  fixed = resolveOverlaps(fixed);
  fixed = expandRoomsToFillVoids(fixed);

  const result2 = validatePlan(fixed);
  if (result2.isValid) return { plan: fixed, wasFixed: true };

  return null; // Give up — caller should regenerate
}

// ─── Fix 1: Resolve overlapping rooms ────────────────────────────────────────
function resolveOverlaps(layout) {
  const sb    = layout.plot.setback || { front: 6, back: 4, left: 4, right: 4 };
  const bx1   = sb.left,            by1 = sb.back;
  const bx2   = layout.plot.width  - sb.right;
  const by2   = layout.plot.length - sb.front;
  const rooms = layout.rooms.map(r => ({ ...r }));

  for (let iter = 0; iter < 25; iter++) {
    let anyOverlap = false;
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const a = rooms[i], b = rooms[j];
        const ix = Math.min(a.x + a.width,  b.x + b.width)  - Math.max(a.x, b.x);
        const iy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        if (ix <= 1 || iy <= 1) continue;
        anyOverlap = true;
        // Push the smaller room away from the larger
        const [big, small] = a.width * a.height >= b.width * b.height ? [a, b] : [b, a];
        if (ix <= iy) {
          if (small.x + small.width / 2 > big.x + big.width / 2) {
            small.x = r2(Math.min(bx2 - small.width, big.x + big.width));
          } else {
            small.x = r2(Math.max(bx1, big.x - small.width));
          }
        } else {
          if (small.y + small.height / 2 > big.y + big.height / 2) {
            small.y = r2(Math.min(by2 - small.height, big.y + big.height));
          } else {
            small.y = r2(Math.max(by1, big.y - small.height));
          }
        }
      }
    }
    if (!anyOverlap) break;
  }

  return { ...layout, rooms };
}

// ─── Fix 2: Expand rooms to fill void spaces ──────────────────────────────────
function expandRoomsToFillVoids(layout) {
  const sb    = layout.plot.setback || { front: 6, back: 4, left: 4, right: 4 };
  const bx1   = sb.left,            by1 = sb.back;
  const bx2   = layout.plot.width  - sb.right;
  const by2   = layout.plot.length - sb.front;
  const rooms = layout.rooms.map(r => ({ ...r }));

  for (const room of rooms) {
    const others = rooms.filter(r => r !== room);
    const maxW   = ROOM_MAX[room.type]?.w ?? (bx2 - bx1);
    const maxH   = ROOM_MAX[room.type]?.h ?? (by2 - by1);

    // Try expanding RIGHT
    const nextRight = Math.min(
      bx2,
      ...others
        .filter(o => o.x > room.x + room.width - 0.5 &&
                     o.y < room.y + room.height && o.y + o.height > room.y)
        .map(o => o.x)
    );
    const gapRight = nextRight - (room.x + room.width);
    if (gapRight > 0.5) {
      room.width = r2(Math.min(maxW, room.width + gapRight));
    }

    // Try expanding DOWN
    const nextDown = Math.min(
      by2,
      ...others
        .filter(o => o.y > room.y + room.height - 0.5 &&
                     o.x < room.x + room.width && o.x + o.width > room.x)
        .map(o => o.y)
    );
    const gapDown = nextDown - (room.y + room.height);
    if (gapDown > 0.5) {
      room.height = r2(Math.min(maxH, room.height + gapDown));
    }
  }

  return { ...layout, rooms };
}

// ─── Fix 3: Enlarge rooms that are below minimum size ────────────────────────
function enlargeSmallRooms(layout) {
  const sb    = layout.plot.setback || { front: 6, back: 4, left: 4, right: 4 };
  const bx2   = layout.plot.width  - sb.right;
  const by2   = layout.plot.length - sb.front;
  const rooms = layout.rooms.map(r => ({ ...r }));

  for (const room of rooms) {
    const min = ROOM_MIN[room.type];
    if (!min) continue;
    if (room.width >= min.w && room.height >= min.h && room.width * room.height >= min.sqft) continue;

    // Sorted neighbors by area descending (largest donors first)
    const neighbors = rooms
      .filter(o => o !== room && adjacent(room, o))
      .sort((a, b) => b.width * b.height - a.width * a.height);

    for (const donor of neighbors) {
      const dMin = ROOM_MIN[donor.type];
      const dMinW = dMin?.w ?? 5;
      const dMinH = dMin?.h ?? 5;

      // Donate width if donor is to the right and has surplus
      const donorOnRight = Math.abs(donor.x - (room.x + room.width)) < 2;
      if (room.width < min.w && donorOnRight && donor.width - 2 > dMinW) {
        const give = r2(Math.min(min.w - room.width, donor.width - dMinW - 0.5));
        if (give > 0) {
          room.width  = r2(Math.min(bx2 - room.x, room.width + give));
          donor.x     = r2(donor.x + give);
          donor.width = r2(Math.max(dMinW, donor.width - give));
        }
      }

      // Donate height if donor is below and has surplus
      const donorBelow = Math.abs(donor.y - (room.y + room.height)) < 2;
      if (room.height < min.h && donorBelow && donor.height - 2 > dMinH) {
        const give = r2(Math.min(min.h - room.height, donor.height - dMinH - 0.5));
        if (give > 0) {
          room.height  = r2(Math.min(by2 - room.y, room.height + give));
          donor.y      = r2(donor.y + give);
          donor.height = r2(Math.max(dMinH, donor.height - give));
        }
      }

      if (room.width >= min.w && room.height >= min.h && room.width * room.height >= min.sqft) break;
    }
  }

  return { ...layout, rooms };
}

module.exports = { autoFix };
