'use strict';

/**
 * Plan Quality Validator
 *
 * Validates a layoutJson against Indian residential architecture standards.
 * Rooms are in PLOT coordinates (including setback offset).
 *
 * Returns: { isValid, errors, warnings, score, coverage }
 */

const ROOM_LABEL = {
  living_room: 'Living Room', master_bedroom: 'Master Bedroom', bedroom: 'Bedroom',
  kitchen: 'Kitchen', dining: 'Dining Room', bathroom: 'Bathroom', balcony: 'Balcony',
  study: 'Study', guest_room: 'Guest Room', terrace: 'Terrace',
  prayer_room: 'Prayer Room', utility_room: 'Utility Room', staircase: 'Staircase',
};

// Indian residential minimum sizes (sq.ft and ft per side)
const ROOM_MIN_SQFT = {
  living_room: 120, master_bedroom: 120, bedroom: 100,
  kitchen: 60, dining: 80, bathroom: 35, balcony: 30,
};
const ROOM_MIN_DIM = {
  living_room:    { w: 10, h: 10 },
  master_bedroom: { w: 10, h: 10 },
  bedroom:        { w:  9, h: 10 },
  kitchen:        { w:  8, h:  7 },
  dining:         { w:  8, h: 10 },
  bathroom:       { w:  5, h:  7 },
  balcony:        { w:  5, h:  4 },
};

function lbl(type) { return ROOM_LABEL[type] || type; }

// Check whether two rooms share a wall edge (within TOL feet)
function adjacent(a, b, TOL = 2) {
  const overlapX = a.x < b.x + b.width + TOL  && a.x + a.width  > b.x - TOL;
  const overlapY = a.y < b.y + b.height + TOL  && a.y + a.height > b.y - TOL;
  const touchL   = Math.abs(a.x - (b.x + b.width))  < TOL && overlapY;
  const touchR   = Math.abs((a.x + a.width)  - b.x)  < TOL && overlapY;
  const touchT   = Math.abs(a.y - (b.y + b.height)) < TOL && overlapX;
  const touchB   = Math.abs((a.y + a.height) - b.y)  < TOL && overlapX;
  return touchL || touchR || touchT || touchB;
}

function validatePlan(layout) {
  const errors   = [];
  const warnings = [];
  let   score    = 100;

  const plot  = layout.plot  || {};
  const rooms = layout.rooms || [];
  const doors = layout.doors || [];
  const sb    = plot.setback || { front: 6, back: 4, left: 4, right: 4 };

  // Buildable region in plot coordinates
  const bx1 = sb.left;
  const by1 = sb.front;
  const bx2 = plot.width  - sb.right;
  const by2 = plot.length - sb.back;
  const bW  = bx2 - bx1;
  const bH  = by2 - by1;
  const buildableArea = bW * bH;

  // Exclude non-habitable rooms from coverage calc
  const habRooms  = rooms.filter(r => r.type !== 'staircase' && r.type !== 'terrace');
  const totalArea = habRooms.reduce((s, r) => s + r.width * r.height, 0);
  const coverage  = buildableArea > 0 ? totalArea / buildableArea : 0;

  // ─── HARD RULES ────────────────────────────────────────────────────────────

  // RULE 1 — Full coverage ≥ 85%
  if (coverage < 0.85) {
    errors.push({
      type: 'VOID_SPACE',
      message: `Unoccupied void space — rooms cover only ${Math.round(coverage * 100)}% of buildable area (need ≥85%)`,
    });
    score -= 25;
  }

  // RULE 2 — No disconnected rooms
  rooms.forEach(room => {
    const TOL = 2;
    const onBoundary = (
      room.x        <= bx1 + TOL ||
      room.y        <= by1 + TOL ||
      room.x + room.width  >= bx2 - TOL ||
      room.y + room.height >= by2 - TOL
    );
    const connected = onBoundary || rooms.some(other => other !== room && adjacent(room, other, TOL));
    if (!connected) {
      errors.push({ type: 'DISCONNECTED_ROOM', message: `'${lbl(room.type)}' is floating — not connected to any adjacent room or wall` });
      score -= 20;
    }
  });

  // RULE 3 — No significant room overlaps
  const seenPairs = new Set();
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i], b = rooms[j];
      const ix = Math.min(a.x + a.width,  b.x + b.width)  - Math.max(a.x, b.x);
      const iy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      if (ix > 2 && iy > 2) {
        const key = `${Math.min(i, j)}-${Math.max(i, j)}`;
        if (!seenPairs.has(key)) {
          seenPairs.add(key);
          errors.push({ type: 'ROOM_OVERLAP', message: `'${lbl(a.type)}' overlaps '${lbl(b.type)}' by ${Math.round(ix * iy)} sq.ft` });
          score -= 20;
        }
      }
    }
  }

  // RULE 4 — Minimum room sizes (Indian residential standards)
  rooms.forEach(room => {
    const minSqft = ROOM_MIN_SQFT[room.type];
    const minDim  = ROOM_MIN_DIM[room.type];
    if (!minSqft) return;
    const sqft = room.width * room.height;
    if (sqft < minSqft) {
      errors.push({
        type: 'ROOM_TOO_SMALL', roomType: room.type,
        message: `${lbl(room.type)} is ${Math.round(sqft)} sq.ft — minimum is ${minSqft} sq.ft`,
      });
      score -= 20;
    } else if (minDim && (room.width < minDim.w || room.height < minDim.h)) {
      errors.push({
        type: 'ROOM_TOO_NARROW', roomType: room.type,
        message: `${lbl(room.type)} is ${room.width}×${room.height}ft — minimum is ${minDim.w}×${minDim.h}ft`,
      });
      score -= 10;
    }
  });

  // RULE 5 — Rooms inside buildable boundary
  rooms.forEach(room => {
    const outside = (
      room.x        < bx1 - 0.5 ||
      room.y        < by1 - 0.5 ||
      room.x + room.width  > bx2 + 0.5 ||
      room.y + room.height > by2 + 0.5
    );
    if (outside) {
      errors.push({ type: 'OUT_OF_BOUNDS', message: `'${lbl(room.type)}' extends outside the buildable boundary` });
      score -= 20;
    }
  });

  // RULE 6 — Bathroom must be adjacent to a bedroom
  const bedTypes = ['master_bedroom', 'bedroom', 'guest_room'];
  const hasBeds  = rooms.some(r => bedTypes.includes(r.type));
  rooms.filter(r => r.type === 'bathroom').forEach(bath => {
    if (hasBeds && !rooms.some(r => bedTypes.includes(r.type) && adjacent(bath, r))) {
      errors.push({ type: 'ISOLATED_BATHROOM', message: `Bathroom has no adjacent bedroom` });
      score -= 20;
    }
  });

  // RULE 7 — Kitchen adjacent to dining or living
  rooms.filter(r => r.type === 'kitchen').forEach(kit => {
    if (!rooms.some(r => ['dining', 'living_room'].includes(r.type) && adjacent(kit, r))) {
      errors.push({ type: 'INACCESSIBLE_KITCHEN', message: 'Kitchen is not adjacent to any dining or living space' });
      score -= 20;
    }
  });

  // RULE 8 — Main entry faces the road
  const mainDoor = doors.find(d => d.type === 'main');
  if (mainDoor) {
    // Main door should be near front wall (y ≈ sb.back = by1 in plot coords)
    if (Math.abs(mainDoor.y - by1) > 3) {
      const facing = (plot.facing || 'north').toUpperCase();
      errors.push({ type: 'WRONG_ENTRY', message: `Main entry not on road-facing wall (${facing} facing)` });
      score -= 15;
    }
  }

  // ─── WARNINGS ──────────────────────────────────────────────────────────────

  // W1 — Kitchen facing road
  rooms.filter(r => r.type === 'kitchen').forEach(k => {
    if (k.y - by1 < bH * 0.25) {
      warnings.push({ type: 'KITCHEN_ROAD_FACING', message: 'Kitchen faces road — consider moving to rear' });
      score -= 5;
    }
  });

  // W2 — Master bedroom should be the largest bedroom
  const masters   = rooms.filter(r => r.type === 'master_bedroom');
  const bedrooms  = rooms.filter(r => r.type === 'bedroom' || r.type === 'guest_room');
  masters.forEach(m => {
    const mArea = m.width * m.height;
    bedrooms.forEach((b, idx) => {
      if (b.width * b.height > mArea + 5) {
        warnings.push({ type: 'MASTER_NOT_LARGEST', message: `Bedroom ${idx + 1} (${Math.round(b.width * b.height)} sq.ft) is larger than Master Bedroom (${Math.round(mArea)} sq.ft)` });
        score -= 5;
      }
    });
  });

  // W3 — Living room should be the largest habitable room
  const livings = rooms.filter(r => r.type === 'living_room');
  const nonLiv  = rooms.filter(r => !['balcony','terrace','bathroom','utility_room','staircase','living_room'].includes(r.type));
  livings.forEach(liv => {
    const lArea = liv.width * liv.height;
    nonLiv.forEach(other => {
      if (other.width * other.height > lArea + 10) {
        warnings.push({ type: 'LIVING_NOT_LARGEST', message: `${lbl(other.type)} (${Math.round(other.width * other.height)} sq.ft) exceeds Living Room (${Math.round(lArea)} sq.ft)` });
        score -= 5;
      }
    });
  });

  score = Math.max(0, Math.min(100, score));

  return {
    isValid:      errors.length === 0,
    errors,
    warnings,
    score,
    coverage:     Math.round(coverage * 100),
    buildableArea: Math.round(buildableArea),
    roomArea:     Math.round(totalArea),
  };
}

module.exports = { validatePlan };
