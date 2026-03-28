'use strict';
/**
 * physicsEnforcer.js
 * Enforces physical rules after pixel assignment.
 * Adds doors, windows, kitchen platforms, bathroom fixtures to each room.
 * Never changes x/y/w/h — only annotates with drawn elements.
 */

const { DOOR_RULES, WINDOW_RULES, KITCHEN_RULES, BATHROOM_RULES } = require('../knowledge/physicalRules');

const SCALE = 10; // px per foot

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Clamp v between lo and hi */
const clp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Compute door position on a given wall of a room.
 * Returns { x1, y1, x2, y2, hingeX, hingeY, swingX, swingY }
 * Wall = 'north'|'south'|'east'|'west'
 */
function computeDoorPosition(room, wall) {
  const { x, y, w, h } = room;
  const dw = DOOR_RULES.doorWidthFt * SCALE;            // door width in px
  const margin = DOOR_RULES.minDistFromCornerFt * SCALE; // keep away from corner

  let x1, y1, x2, y2, hingeX, hingeY, swingX, swingY;

  switch (wall) {
    case 'north': {
      const cx = clp(x + w * 0.4, x + margin, x + w - dw - margin);
      x1 = cx; y1 = y; x2 = cx + dw; y2 = y;
      hingeX = cx; hingeY = y;
      swingX = cx; swingY = y + dw; // arc swings inward
      break;
    }
    case 'south': {
      const cx = clp(x + w * 0.4, x + margin, x + w - dw - margin);
      x1 = cx; y1 = y + h; x2 = cx + dw; y2 = y + h;
      hingeX = cx; hingeY = y + h;
      swingX = cx; swingY = y + h - dw;
      break;
    }
    case 'west': {
      const cy = clp(y + h * 0.4, y + margin, y + h - dw - margin);
      x1 = x; y1 = cy; x2 = x; y2 = cy + dw;
      hingeX = x; hingeY = cy;
      swingX = x + dw; swingY = cy;
      break;
    }
    case 'east': {
      const cy = clp(y + h * 0.4, y + margin, y + h - dw - margin);
      x1 = x + w; y1 = cy; x2 = x + w; y2 = cy + dw;
      hingeX = x + w; hingeY = cy;
      swingX = x + w - dw; swingY = cy;
      break;
    }
    default:
      return null;
  }

  return { x1, y1, x2, y2, hingeX, hingeY, swingX, swingY, radius: dw };
}

/**
 * Compute window position on a given wall.
 * Returns { x1, y1, x2, y2 } (center section of the wall)
 */
function computeWindowPosition(room, wall) {
  const { x, y, w, h } = room;
  const frac = 0.35; // window occupies 35% of wall length

  switch (wall) {
    case 'north': {
      const cx = x + w * 0.5;
      const half = (w * frac) / 2;
      return { x1: cx - half, y1: y, x2: cx + half, y2: y };
    }
    case 'south': {
      const cx = x + w * 0.5;
      const half = (w * frac) / 2;
      return { x1: cx - half, y1: y + h, x2: cx + half, y2: y + h };
    }
    case 'west': {
      const cy = y + h * 0.5;
      const half = (h * frac) / 2;
      return { x1: x, y1: cy - half, x2: x, y2: cy + half };
    }
    case 'east': {
      const cy = y + h * 0.5;
      const half = (h * frac) / 2;
      return { x1: x + w, y1: cy - half, x2: x + w, y2: cy + half };
    }
    default:
      return null;
  }
}

/**
 * Compute kitchen platform (counter) rectangle on the platform wall.
 * Platform depth = 2ft. Returns { x, y, w, h }
 */
function computePlatformRect(room, platformWall) {
  const { x, y, w, h } = room;
  const depth = KITCHEN_RULES.platformDepthFt * SCALE;

  switch (platformWall) {
    case 'north': return { x, y, w, h: depth };
    case 'south': return { x, y: y + h - depth, w, h: depth };
    case 'west':  return { x, y, w: depth, h };
    case 'east':  return { x: x + w - depth, y, w: depth, h };
    default:      return null;
  }
}

/**
 * Compute sink position on the platform (center of platform).
 */
function computeSinkPosition(room, platformWall) {
  const plat = computePlatformRect(room, platformWall);
  if (!plat) return null;
  return { cx: plat.x + plat.w / 2, cy: plat.y + plat.h / 2 };
}

/**
 * Compute WC and basin positions inside bathroom.
 * WC = far from door, basin = near door.
 */
function computeFixturePositions(room, doorWall) {
  const { x, y, w, h } = room;
  const wc    = BATHROOM_RULES.fixtures.wc;
  const basin = BATHROOM_RULES.fixtures.basin;
  const wcW   = wc.widthFt    * SCALE;
  const wcH   = wc.heightFt   * SCALE;
  const basW  = basin.widthFt * SCALE;
  const basH  = basin.heightFt * SCALE;

  // Place WC in corner far from door wall, basin near door
  let wcRect, basinRect;
  switch (doorWall) {
    case 'south': // door is at bottom → basin near bottom, WC at top
      basinRect = { x: x + w - basW - 4, y: y + h - basH - 4, w: basW, h: basH };
      wcRect    = { x: x + 4, y: y + 4, w: wcW, h: wcH };
      break;
    case 'north': // door at top → basin near top, WC at bottom
      basinRect = { x: x + 4, y: y + 4, w: basW, h: basH };
      wcRect    = { x: x + 4, y: y + h - wcH - 4, w: wcW, h: wcH };
      break;
    case 'west': // door at left → basin near left, WC at right
      basinRect = { x: x + 4, y: y + 4, w: basW, h: basH };
      wcRect    = { x: x + w - wcW - 4, y: y + 4, w: wcW, h: wcH };
      break;
    case 'east': // door at right → basin near right, WC at left
      basinRect = { x: x + w - basW - 4, y: y + 4, w: basW, h: basH };
      wcRect    = { x: x + 4, y: y + 4, w: wcW, h: wcH };
      break;
    default:
      basinRect = { x: x + 4, y: y + 4, w: basW, h: basH };
      wcRect    = { x: x + 4, y: y + h - wcH - 4, w: wcW, h: wcH };
  }

  return { wc: wcRect, basin: basinRect };
}

// ─── Per-type enforcers ────────────────────────────────────────────────────────

function enforceKitchenRules(room) {
  const platformWall = room.platformWall && room.platformWall !== 'none'
    ? room.platformWall
    : (room.windowWall && room.windowWall !== 'none' ? room.windowWall : 'north');

  // Door must NOT be on platform wall — pick opposite
  const opposite = { north: 'south', south: 'north', east: 'west', west: 'east' };
  const doorWall = (room.doorWall && room.doorWall !== platformWall)
    ? room.doorWall
    : opposite[platformWall];

  return {
    ...room,
    platformWall,
    doorWall,
    _door:     computeDoorPosition(room, doorWall),
    _window:   computeWindowPosition(room, platformWall), // window = platform wall
    _platform: computePlatformRect(room, platformWall),
    _sink:     computeSinkPosition(room, platformWall),
  };
}

function enforceBathroomRules(room) {
  const doorWall = room.doorWall || 'south';
  const fixtures = computeFixturePositions(room, doorWall);

  return {
    ...room,
    doorWall,
    _door:  computeDoorPosition(room, doorWall),
    _wc:    fixtures.wc,
    _basin: fixtures.basin,
  };
}

function enforceBedroomRules(room) {
  const doorWall   = room.doorWall   || 'south';
  const windowWall = room.windowWall || 'north';

  return {
    ...room,
    doorWall,
    windowWall,
    _door:   computeDoorPosition(room, doorWall),
    _window: computeWindowPosition(room, windowWall),
  };
}

function enforceLivingRules(room) {
  const doorWall   = room.doorWall   || 'south';
  const windowWall = room.windowWall || 'north';

  return {
    ...room,
    doorWall,
    windowWall,
    _door:   computeDoorPosition(room, doorWall),
    _window: computeWindowPosition(room, windowWall),
  };
}

function enforceDiningRules(room) {
  const doorWall   = room.doorWall   || 'east';
  const windowWall = room.windowWall || 'west';

  return {
    ...room,
    doorWall,
    windowWall,
    _door:   computeDoorPosition(room, doorWall),
    _window: computeWindowPosition(room, windowWall),
  };
}

function enforceBalconyRules(room) {
  // Balcony: no door arc (open), just a railing — represented as a window on outer wall
  const windowWall = room.windowWall || 'north';
  return {
    ...room,
    windowWall,
    _window: computeWindowPosition(room, windowWall),
  };
}

function enforceEntryRules(room) {
  const doorWall = room.doorWall || 'south';
  return {
    ...room,
    doorWall,
    _door: computeDoorPosition(room, doorWall),
  };
}

function enforceParkingRules(room) {
  // Parking: show main gate on front wall (north = road side)
  const gateWall = 'north';
  return {
    ...room,
    _gate: computeWindowPosition(room, gateWall), // reuse window position for gate line
  };
}

// ─── Main entry ───────────────────────────────────────────────────────────────

/**
 * enforcePhysics(rooms)
 * Applies type-specific rules to each room.
 * Returns new rooms array — original is not mutated.
 */
function enforcePhysics(rooms) {
  return rooms.map(room => {
    switch (room.type) {
      case 'kitchen':        return enforceKitchenRules(room);
      case 'bathroom':       return enforceBathroomRules(room);
      case 'master_bedroom': return enforceBedroomRules(room);
      case 'bedroom':        return enforceBedroomRules(room);
      case 'living':
      case 'living_room':    return enforceLivingRules(room);
      case 'dining':         return enforceDiningRules(room);
      case 'balcony':        return enforceBalconyRules(room);
      case 'entry':          return enforceEntryRules(room);
      case 'parking':        return enforceParkingRules(room);
      default: {
        // Generic: add door if doorWall is set
        const doorWall = room.doorWall;
        return doorWall
          ? { ...room, _door: computeDoorPosition(room, doorWall) }
          : room;
      }
    }
  });
}

module.exports = {
  enforcePhysics,
  computeDoorPosition,
  computeWindowPosition,
  computePlatformRect,
  computeFixturePositions,
};
