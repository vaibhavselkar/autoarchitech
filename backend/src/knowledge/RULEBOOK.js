'use strict';
/**
 * AUTOARCHITECT RULE BOOK v1.0
 * Complete rules for generating valid Indian residential floor plans.
 * These rules are ABSOLUTE — no plan is shown to the user unless all
 * mandatory rules pass.
 *
 * Source: National Building Code 2016 (NBC India), Vastu Shastra,
 *         Indian municipal bylaws, common residential design practice.
 */

const RULEBOOK = {

  // ═══════════════════════════════════════
  // SECTION 1 — PLOT & SETBACK RULES
  // ═══════════════════════════════════════
  plot: {
    minBuildableArea: 400, // sqft — reject plot if buildable area < this

    defaultSetbacks: {
      NORTH: { front: 3, rear: 3, left: 2, right: 2 },
      SOUTH: { front: 3, rear: 3, left: 2, right: 2 },
      EAST:  { front: 3, rear: 3, left: 2, right: 2 },
      WEST:  { front: 3, rear: 3, left: 2, right: 2 },
    },

    // If parking is requested, front setback must be at least 10ft (driveway)
    parkingMinFrontSetback: 10,

    // FRONT wall = road side = where main gate and entry go
    // REAR wall  = most private side = bedrooms face here
    facingWallMap: {
      NORTH: { front: 'north', rear: 'south', left: 'west',  right: 'east'  },
      SOUTH: { front: 'south', rear: 'north', left: 'east',  right: 'west'  },
      EAST:  { front: 'east',  rear: 'west',  left: 'north', right: 'south' },
      WEST:  { front: 'west',  rear: 'east',  left: 'south', right: 'north' },
    },
  },

  // ═══════════════════════════════════════
  // SECTION 2 — MANDATORY ROOM SIZES (NBC India 2016)
  // ═══════════════════════════════════════
  roomSizes: {
    living_room:    { minW: 10, minH: 10, minArea: 120, label: 'Living Room'   },
    dining:         { minW:  8, minH:  8, minArea:  80, label: 'Dining Room'   },
    kitchen:        { minW:  6, minH:  8, minArea:  50, label: 'Kitchen'       },
    master_bedroom: { minW: 10, minH: 10, minArea: 120, label: 'Master Bedroom'},
    bedroom:        { minW:  9, minH: 10, minArea: 100, label: 'Bedroom'       },
    bathroom:       { minW:  4, minH:  6, minArea:  30, label: 'Bathroom'      },
    toilet:         { minW:  3, minH:  5, minArea:  18, label: 'Toilet'        },
    balcony:        { minW:  5, minH:  4, minArea:  25, label: 'Balcony'       },
    parking:        { minW:  9, minH: 18, minArea: 162, label: 'Parking'       },
    corridor:       { minW:  3, minH:  3, minArea:   0, label: 'Passage'       },
    entry:          { minW:  4, minH:  4, minArea:  16, label: 'Entry/Foyer'   },
    pooja:          { minW:  4, minH:  4, minArea:  16, label: 'Pooja Room'    },
    utility:        { minW:  4, minH:  5, minArea:  20, label: 'Utility'       },
    staircase:      { minW:  3, minH:  4, minArea:  12, label: 'Staircase'     },
  },

  // A room 4× longer than wide is a corridor, not a room — invalid
  maxAspectRatio: 3.5,

  // Bathroom must always be smaller than any bedroom in the same plan
  bathroomMustBeSmallerThanBedroom: true,

  // ═══════════════════════════════════════
  // SECTION 3 — ZONE & BAND PLACEMENT RULES
  // ═══════════════════════════════════════
  // Plot divided into 3 horizontal bands:
  //   Band 1 = FRONT  (road side, public, entry zone)
  //   Band 2 = MIDDLE (semi-public, living/service zone)
  //   Band 3 = REAR   (private, bedroom zone)
  zonePlacement: {
    mustBeFront:     ['parking', 'balcony', 'entry'],
    mustBeRear:      ['master_bedroom'],
    neverFront:      ['master_bedroom', 'bedroom', 'bathroom', 'toilet'],
    preferNotFront:  ['kitchen', 'utility', 'toilet'],

    bandMinHeights: {
      band1: 5,   // min 5ft — parking forces 18ft if present
      band2: 10,  // living/dining/kitchen need 10ft min
      band3: 10,  // bedrooms need 10ft min
    },

    // Band height = max(minH of rooms in that band), then distribute rest
    bandHeightStrategy: 'max_of_minimums',
  },

  // ═══════════════════════════════════════
  // SECTION 4 — ADJACENCY RULES
  // ═══════════════════════════════════════
  adjacency: {
    required: [
      {
        room: 'kitchen',
        mustTouchOneOf: ['dining', 'living_room'],
        reason: 'Kitchen must be accessible from dining or living without going outside',
      },
      {
        room: 'dining',
        mustTouchOneOf: ['kitchen', 'living_room'],
        reason: 'Dining must be adjacent to kitchen for food service',
      },
      {
        room: 'bathroom',
        mustTouchOneOf: ['master_bedroom', 'bedroom', 'corridor', 'living_room'],
        reason: 'Every bathroom must be accessible from a bedroom or passage',
      },
    ],

    forbidden: [
      { roomA: 'bathroom', roomB: 'kitchen', reason: 'Health code — bathroom and kitchen must never share a wall' },
      { roomA: 'toilet',   roomB: 'kitchen', reason: 'Health code — toilet and kitchen must never share a wall'   },
      { roomA: 'bathroom', roomB: 'dining',  reason: 'Bathroom door must never face dining room'                  },
      { roomA: 'toilet',   roomB: 'dining',  reason: 'Toilet must not be adjacent to dining room'                 },
      { roomA: 'pooja',    roomB: 'bathroom',reason: 'Vastu — sacred room must not be adjacent to bathroom'       },
      { roomA: 'pooja',    roomB: 'toilet',  reason: 'Vastu — sacred room must not be adjacent to toilet'         },
    ],

    // Two rooms within this distance (ft) are considered adjacent
    adjacencyToleranceFt: 2,
  },

  // ═══════════════════════════════════════
  // SECTION 5 — DOOR RULES
  // ═══════════════════════════════════════
  doors: {
    standardWidthFt: 3,
    mainGateWidthFt: 5,

    maxDoors: {
      bathroom:       1,  // ONLY 1 DOOR — no exceptions
      toilet:         1,
      kitchen:        2,  // one from dining, one service entry
      bedroom:        1,
      master_bedroom: 2,  // can have en-suite door to bathroom
      living_room:    3,  // main entry + dining + bedroom corridor
      default:        1,
    },

    noDoorOnPlatformWall: true,   // kitchen counter wall must not have a door
    swingDirection: 'inward',     // door arc sweeps INTO the room
    minDistFromCornerFt: 2,       // door edge min 2ft from room corner

    mainEntry: {
      mustBeOnFrontWall: true,
      mustFaceParking:   true,
      opensInward:       true,
    },
  },

  // ═══════════════════════════════════════
  // SECTION 6 — WINDOW RULES
  // ═══════════════════════════════════════
  windows: {
    mustHaveWindow:  ['living_room', 'master_bedroom', 'bedroom', 'kitchen', 'dining', 'pooja'],
    canBeInternal:   ['bathroom', 'toilet', 'corridor', 'utility', 'staircase'],

    minWindowAreaFraction: 0.1,   // NBC: window ≥ 1/10 of floor area
    minVentAreaFraction:   0.05,  // NBC: ventilation ≥ 1/20 of floor area

    standardSizes: {
      bedroom:    { width: 4, height: 4 },
      living_room:{ width: 5, height: 4 },
      kitchen:    { width: 3, height: 3 },
      bathroom:   { width: 2, height: 2 },
    },

    symbol: 'three_parallel_lines',
  },

  // ═══════════════════════════════════════
  // SECTION 7 — KITCHEN SPECIFIC RULES
  // ═══════════════════════════════════════
  kitchen: {
    platform: {
      maxWalls:               2,     // straight or L-shape, never U-shape in small kitchens
      depthFt:                2,     // standard counter depth
      heightFt:               2.75,  // standard counter height (33 inches)
      platformWallHasWindow:  true,  // cook faces window — natural light
      doorMustAvoidPlatformWall: true,
    },

    sink: {
      position: 'end_of_platform_near_window',
      symbol:   'rect_with_circle',
    },

    crossVentilationRequired: true,
    minClearSpaceFt: 4,             // min clear floor space between counter and opposite wall

    serviceEntryForLargeKitchen: true,
    largeKitchenAreaSqft: 100,
  },

  // ═══════════════════════════════════════
  // SECTION 8 — BATHROOM SPECIFIC RULES
  // ═══════════════════════════════════════
  bathroom: {
    wcAtFarEnd:    true,   // WC always farthest from door
    basinNearDoor: true,   // basin always nearest door

    fixtures: {
      wc:     { widthFt: 1.5, heightFt: 2.5 },
      basin:  { widthFt: 1.5, heightFt: 1.5 },
      shower: { widthFt: 3,   heightFt: 3   },
    },

    door: {
      count:       1,
      opensInward: true,
      mustNotFaceWC: true,
    },

    doorMustNotFaceToward: ['dining', 'kitchen', 'main_entry'],
    notVisibleFromEntry:   true,
    preferExteriorWall:    false,  // internal bathroom is common in Indian homes
  },

  // ═══════════════════════════════════════
  // SECTION 9 — BEDROOM SPECIFIC RULES
  // ═══════════════════════════════════════
  bedroom: {
    mustHaveWindow: true,

    master: {
      mustBeLargestBedroom: true,
      preferRear:           true,
      canHaveEnsuite:       true,
      ensuiteConnection:    'second_door_in_bedroom',
    },

    doorNotVisibleFromEntry: true,
    minWidthForQueenBed:     10,
    minWidthForSingleBed:    9,
    windowSillHeightFt:      3,
  },

  // ═══════════════════════════════════════
  // SECTION 10 — CIRCULATION RULES
  // ═══════════════════════════════════════
  circulation: {
    privateRooms:    ['bedroom', 'master_bedroom'],
    serviceRooms:    ['bathroom', 'toilet', 'kitchen', 'utility'],
    needPublicAccess:['kitchen', 'dining', 'bathroom', 'living_room'],

    minCorridorWidthFt: 3.5,
    corridorNeededWhen: 'bedrooms_gt_2_or_shared_bathrooms',

    staircase: {
      minWidthFt:           3.5,
      minTreadDepthInches:  10,
      maxRiserHeightInches: 7,
      mustHaveLanding:      true,
    },
  },

  // ═══════════════════════════════════════
  // SECTION 11 — NATURAL LIGHT RULES
  // ═══════════════════════════════════════
  naturalLight: {
    lightQuality: {
      north: 'consistent_diffused',
      east:  'morning_sun',
      south: 'winter_sun_summer_shade',
      west:  'harsh_afternoon_sun',
    },

    idealWindowWall: {
      living_room:    ['north', 'east'],
      master_bedroom: ['east', 'south'],
      bedroom:        ['east', 'south', 'west'],
      kitchen:        ['east', 'south'],
      dining:         ['east', 'north'],
      bathroom:       ['east', 'west', 'none'],
      balcony:        ['north', 'east'],
    },

    adjustForPlotFacing: true,
  },

  // ═══════════════════════════════════════
  // SECTION 12 — VASTU RULES
  // ═══════════════════════════════════════
  vastu: {
    idealQuadrant: {
      pooja:          'NE',
      living_room:    'NW',
      master_bedroom: 'SW',
      kitchen:        'SE',
      dining:         'W',
      bedroom:        'NW',
      bathroom:       'NW',
      toilet:         'NW',
      entry:          'NE',
      staircase:      'SW',
    },

    strictlyAvoid: {
      kitchen:  ['NE', 'SW'],
      bedroom:  ['NE'],
      bathroom: ['NE', 'SE'],
      toilet:   ['NE', 'SE', 'SW'],
      pooja:    ['S', 'SW', 'W'],
    },

    bonusPlacements: {
      kitchen_in_SE:       10,
      master_bed_in_SW:    10,
      pooja_in_NE:         15,
      living_in_NW:         8,
      main_entry_north_NE: 10,
      no_toilet_NE:         5,
    },
  },

  // ═══════════════════════════════════════
  // SECTION 13 — GEOMETRY GUARANTEE RULES
  // ═══════════════════════════════════════
  geometry: {
    fullCoverageRequired: true,
    maxOverlapFt:         0.2,   // wall thickness tolerance
    bandHeightRule:       'max_of_room_minimums',
    roomWidthRule:        'min_first_then_proportional',
    maxAspectRatio:       3.5,
    failOnBelowMinimum:   true,
  },

  // ═══════════════════════════════════════
  // SECTION 14 — SCORING RULES
  // ═══════════════════════════════════════
  scoring: {
    minimumDisplayScore: 80,  // plans below this are NOT shown — retry/fallback

    weights: {
      fullCoverage:          25,
      allRoomsMinSize:       20,
      noForbiddenAdjacency:  20,
      correctBandPlacement:  15,
      validAspectRatios:     10,
      windowsOnRightWalls:    5,
      vastuCompliance:        5,
    },

    hardFailures: [
      'void_space_detected',
      'bathroom_touches_kitchen',
      'room_outside_plot_boundary',
      'zero_size_room',
      'infinite_aspect_ratio',
    ],
  },

  // ═══════════════════════════════════════
  // SECTION 15 — THREE PLAN VARIATION RULES
  // ═══════════════════════════════════════
  variations: {
    mustBeDifferentLayoutTypes: true,

    combinations: [
      ['linear', 'private-wing', 'service-front'],
      ['linear', 'open',         'vastu'],
      ['split',  'compact',      'open'],
    ],

    planCharacteristics: {
      plan1: {
        name:          'Best Value',
        description:   'Most practical layout for Indian family living',
        layoutType:    'linear',
        bandStructure: 'clear_three_bands',
        keyFeature:    'Separate zones for public and private life',
      },
      plan2: {
        name:        'Modern Open',
        description: 'Contemporary open-plan living concept',
        layoutType:  'private-wing',
        keyFeature:  'Bedrooms in private wing, open social zone',
      },
      plan3: {
        name:        'Vastu Compliant',
        description: 'Traditional Vastu-based room placement',
        layoutType:  'service-front',
        vastuScore:  'maximum',
        keyFeature:  'Service zone at front, family living opens to rear garden',
      },
    },

    plan3Alternative: {
      name:       'Compact Efficient',
      layoutType: 'compact',
      keyFeature: 'Central passage connects all rooms efficiently',
    },

    similarityThreshold: 0.7,
  },
};

/**
 * buildRulebookPrompt()
 *
 * Converts the rulebook into a dense prompt section for Gemini.
 * Include this in every room-design call so Gemini is always aware
 * of absolute architectural constraints.
 */
function buildRulebookPrompt() {
  const rs = RULEBOOK.roomSizes;
  return `
ABSOLUTE RULES — violating any of these makes the plan invalid and it will be rejected:

ROOM SIZE MINIMUMS (NBC India 2016):
  living_room:     min ${rs.living_room.minW}×${rs.living_room.minH}ft  (${rs.living_room.minArea}sqft)
  master_bedroom:  min ${rs.master_bedroom.minW}×${rs.master_bedroom.minH}ft  (${rs.master_bedroom.minArea}sqft)
  bedroom:         min ${rs.bedroom.minW}×${rs.bedroom.minH}ft  (${rs.bedroom.minArea}sqft)
  kitchen:         min ${rs.kitchen.minW}×${rs.kitchen.minH}ft  (${rs.kitchen.minArea}sqft)
  dining:          min ${rs.dining.minW}×${rs.dining.minH}ft  (${rs.dining.minArea}sqft)
  bathroom:        min ${rs.bathroom.minW}×${rs.bathroom.minH}ft  (${rs.bathroom.minArea}sqft)
  balcony:         min ${rs.balcony.minW}×${rs.balcony.minH}ft
  parking:         min ${rs.parking.minW}×${rs.parking.minH}ft

MAXIMUM ASPECT RATIO: ${RULEBOOK.maxAspectRatio}:1 — no room may be a corridor shape

BAND PLACEMENT (mandatory — band 1 = front/road, band 3 = rear/private):
  Band 1 (front): ${RULEBOOK.zonePlacement.mustBeFront.join(', ')} ONLY
  Band 3 (rear):  ${RULEBOOK.zonePlacement.mustBeRear.join(', ')} REQUIRED
  NEVER in Band 1: ${RULEBOOK.zonePlacement.neverFront.join(', ')}

FORBIDDEN ADJACENCIES (health code — plan rejected if violated):
${RULEBOOK.adjacency.forbidden.map(f => `  ${f.roomA} must NEVER share a wall with ${f.roomB} — ${f.reason}`).join('\n')}

REQUIRED ADJACENCIES:
${RULEBOOK.adjacency.required.map(r => `  ${r.room} must touch one of: ${r.mustTouchOneOf.join(' or ')}`).join('\n')}

DOOR RULES:
  bathroom/toilet: exactly 1 door, swings inward, must NOT face dining or kitchen
  kitchen door:    NEVER on the same wall as the platform/counter
  all doors:       swing INTO the room, minimum ${RULEBOOK.doors.minDistFromCornerFt}ft from room corner
  main entry:      must be on the FRONT (road-facing) wall

WINDOW RULES:
  MUST have exterior window: ${RULEBOOK.windows.mustHaveWindow.join(', ')}
  OK without window: ${RULEBOOK.windows.canBeInternal.join(', ')}

KITCHEN RULES:
  counter/platform wall = same wall as window (light while cooking)
  door on the wall OPPOSITE the platform
  min ${RULEBOOK.kitchen.minClearSpaceFt}ft clear floor space between counter and opposite wall

GEOMETRY RULES:
  rooms must tile perfectly — zero gaps allowed in buildable area
  no overlaps between rooms (max ${RULEBOOK.geometry.maxOverlapFt}ft tolerance for wall thickness)
  band height = max(minH of rooms in that band), then distribute remaining height proportionally
  room width  = give each room its minW first, then distribute remaining width by room size

MINIMUM DISPLAY SCORE: ${RULEBOOK.scoring.minimumDisplayScore}/100
  Plans below this score are REJECTED — do not produce invalid geometry
`.trim();
}

module.exports = { RULEBOOK, buildRulebookPrompt };
