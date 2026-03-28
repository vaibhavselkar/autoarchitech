'use strict';
/**
 * physicalRules.js — Ground truth for all physical constraints.
 * Nothing here imports from AI. This file is the single source of truth.
 */

const ROOM_SIZES = {
  // [minWidthFt, minHeightFt, maxWidthFraction, maxHeightFraction]
  living:         { minW: 12, minH: 10, maxWFrac: 0.65, maxHFrac: 0.45 },
  dining:         { minW: 10, minH: 10, maxWFrac: 0.55, maxHFrac: 0.40 },
  kitchen:        { minW:  8, minH:  8, maxWFrac: 0.45, maxHFrac: 0.35 },
  master_bedroom: { minW: 12, minH: 12, maxWFrac: 0.60, maxHFrac: 0.45 },
  bedroom:        { minW: 10, minH: 10, maxWFrac: 0.50, maxHFrac: 0.40 },
  bathroom:       { minW:  5, minH:  7, maxWFrac: 0.25, maxHFrac: 0.25 },
  balcony:        { minW:  8, minH:  4, maxWFrac: 0.70, maxHFrac: 0.15 },
  parking:        { minW:  9, minH: 12, maxWFrac: 0.40, maxHFrac: 0.25 },
  corridor:       { minW:  3, minH:  3, maxWFrac: 0.15, maxHFrac: 0.80 },
  entry:          { minW:  4, minH:  4, maxWFrac: 0.30, maxHFrac: 0.15 },
};

const WINDOW_RULES = {
  mustHaveWindow: ['living', 'master_bedroom', 'bedroom', 'kitchen', 'dining'],
  canBeInternal:  ['bathroom', 'corridor', 'utility', 'storage'],
  windowWidth:    0.35, // fraction of room width used for window symbol
};

const DOOR_RULES = {
  maxDoorsPerRoom: {
    bathroom:       1,
    kitchen:        2,
    bedroom:        1,
    master_bedroom: 2,
    living:         2,
    default:        1,
  },
  minDistFromCornerFt: 2,
  doorWidthFt:         3,
  noDoorOnPlatformWall: true,
};

const KITCHEN_RULES = {
  platformDepthFt: 2,
  platformWall:    'auto',
};

const BATHROOM_RULES = {
  fixtures: {
    wc:    { widthFt: 1.5, heightFt: 2.5 },
    basin: { widthFt: 1.5, heightFt: 1.5 },
  },
  mustBeSmallerThan: ['bedroom', 'master_bedroom'],
};

const ADJACENCY_RULES = {
  required: [
    { room: 'kitchen',  mustTouchOneOf: ['dining', 'living'] },
    { room: 'dining',   mustTouchOneOf: ['kitchen', 'living'] },
    { room: 'bathroom', mustTouchOneOf: ['master_bedroom', 'bedroom'] },
  ],
  forbidden: [
    { roomA: 'bathroom', roomB: 'kitchen' },
    { roomA: 'bathroom', roomB: 'dining'  },
  ],
};

const CIRCULATION_RULES = {
  mustHavePublicAccess: ['kitchen', 'dining', 'bathroom', 'living'],
  corridorWidthFt:      3.5,
};

// Map Gemini type names → frontend type names used by React components
const TYPE_TO_FRONTEND = {
  living:         'living_room',
  dining:         'dining',
  kitchen:        'kitchen',
  master_bedroom: 'master_bedroom',
  bedroom:        'bedroom',
  bathroom:       'bathroom',
  balcony:        'balcony',
  parking:        'parking',
  corridor:       'corridor',
  entry:          'entry',
};

module.exports = {
  ROOM_SIZES,
  WINDOW_RULES,
  DOOR_RULES,
  KITCHEN_RULES,
  BATHROOM_RULES,
  ADJACENCY_RULES,
  CIRCULATION_RULES,
  TYPE_TO_FRONTEND,
};
