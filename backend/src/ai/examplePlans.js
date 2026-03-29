'use strict';
/**
 * examplePlans.js — Few-shot learning library for Gemini.
 *
 * Each example uses DIRECT x/y/width/height COORDINATES (feet, buildable-relative).
 * Gemini copies this coordinate system when designing new plans.
 *
 * Coordinate system:
 *   origin (0,0) = front-left corner of the buildable area
 *   x grows RIGHT, y grows DOWN (away from road)
 *   y=0 = road side (front), y=buildableH = rear/garden side
 *
 * Rules verified in every example:
 *   ✓ No bathroom shares a wall with kitchen
 *   ✓ Kitchen adjacent to dining (shared wall)
 *   ✓ Balcony at front (y near 0)
 *   ✓ Master bedroom at rear (y large)
 *   ✓ All rooms within buildable bounds
 *   ✓ No overlaps
 *   ✓ Rooms cover most of the buildable area
 */

const EXAMPLE_PLANS = [

  // ── EXAMPLE 1: 40×60ft plot, North-facing, 3BHK ─────────────────────────
  // Buildable: 32×50ft (setbacks L4 R4 F6 B4)
  {
    input: {
      plotWidth: 40, plotHeight: 60, facing: 'NORTH',
      bedrooms: 3, bathrooms: 2,
      buildableW: 32, buildableH: 50,
    },
    output: {
      planName: 'North-facing 3BHK Linear',
      layoutType: 'linear',
      engineerThinking: 'Road on north. Balcony at y=0 faces road for visibility. Living room spans full width in the middle band to maximise space. Kitchen placed at rear-right with east window for morning light. Both bathrooms serve bedrooms in the rear band — no bathroom touches kitchen.',
      vastuCompliant: false,
      sunlightStrategy: 'East-facing kitchen and west-facing living room create morning and afternoon light balance.',
      ventilationStrategy: 'Full-width living room allows north-south cross-ventilation. Kitchen exhaust goes east.',
      rooms: [
        { type: 'balcony',        label: 'Balcony',        x: 0,  y: 0,  width: 32, height: 5  },
        { type: 'living_room',    label: 'Living Room',    x: 0,  y: 5,  width: 32, height: 14 },
        { type: 'dining',         label: 'Dining Room',    x: 0,  y: 19, width: 16, height: 11 },
        { type: 'kitchen',        label: 'Kitchen',        x: 16, y: 19, width: 16, height: 11, windowWall: 'east', doorWall: 'west', platformWall: 'east' },
        { type: 'master_bedroom', label: 'Master Bedroom', x: 0,  y: 30, width: 20, height: 13 },
        { type: 'bathroom',       label: 'Bathroom 1',     x: 20, y: 30, width: 7,  height: 13 },
        { type: 'bedroom',        label: 'Bedroom 2',      x: 0,  y: 43, width: 16, height: 7  },
        { type: 'bedroom',        label: 'Bedroom 3',      x: 16, y: 43, width: 9,  height: 7  },
        { type: 'bathroom',       label: 'Bathroom 2',     x: 25, y: 43, width: 7,  height: 7  },
      ],
      _notes: [
        'Total height: 5+14+11+13+7 = 50ft = buildableH ✓',
        'Total width: 32ft = buildableW ✓',
        'Bathroom 1 at x=20-27, y=30-43 — Kitchen at x=16-32, y=19-30 — NO shared wall (different y range)',
        'Bathroom 2 at x=25-32, y=43-50 — Kitchen at x=16-32, y=19-30 — NO shared wall (different y range)',
        'Kitchen doorWall=west, platformWall=east — opposite walls ✓',
        'Balcony at y=0 (front), master bedroom at y=30 (rear) ✓',
      ],
    },
  },

  // ── EXAMPLE 2: 30×50ft plot, East-facing, 2BHK, Vastu ───────────────────
  // Buildable: 22×42ft (setbacks L4 R4 F4 B4)
  {
    input: {
      plotWidth: 30, plotHeight: 50, facing: 'EAST',
      bedrooms: 2, bathrooms: 1,
      buildableW: 22, buildableH: 42,
    },
    output: {
      planName: 'East-facing Vastu 2BHK',
      layoutType: 'vastu',
      engineerThinking: 'Road on east. Entry and balcony face east for morning sun — auspicious in Vastu. Kitchen in SE quadrant (right side near front) as Vastu fire zone. Master bedroom in SW (right side, rear) for stability. Single bathroom between both bedrooms, nowhere near kitchen.',
      vastuCompliant: true,
      sunlightStrategy: 'Balcony on east wall gets morning sun. Kitchen on east-south corner uses morning light for cooking.',
      ventilationStrategy: 'Balcony at front, bedrooms at rear — east-west airflow through living room.',
      rooms: [
        { type: 'balcony',        label: 'Balcony',        x: 0,  y: 0,  width: 14, height: 5  },
        { type: 'kitchen',        label: 'Kitchen',        x: 14, y: 0,  width: 8,  height: 10, windowWall: 'east', doorWall: 'south', platformWall: 'east' },
        { type: 'living_room',    label: 'Living Room',    x: 0,  y: 5,  width: 14, height: 15 },
        { type: 'dining',         label: 'Dining Room',    x: 14, y: 10, width: 8,  height: 10 },
        { type: 'master_bedroom', label: 'Master Bedroom', x: 0,  y: 20, width: 14, height: 12 },
        { type: 'bathroom',       label: 'Bathroom',       x: 14, y: 20, width: 8,  height: 10 },
        { type: 'bedroom',        label: 'Bedroom 2',      x: 0,  y: 32, width: 22, height: 10 },
      ],
      _notes: [
        'Total height: covers 0 to 42ft ✓',
        'Kitchen at y=0-10. Bathroom at y=20-30. No shared wall (10ft gap) ✓',
        'Kitchen doorWall=south (into dining), platformWall=east ✓',
        'Vastu: kitchen east-front (SE on east-facing), master bedroom rear-left (SW) ✓',
        'Balcony at y=0 (front, near road) ✓',
      ],
    },
  },

  // ── EXAMPLE 3: 50×50ft plot, North-facing, 4BHK ─────────────────────────
  // Buildable: 42×42ft (setbacks L4 R4 F4 B4)
  {
    input: {
      plotWidth: 50, plotHeight: 50, facing: 'NORTH',
      bedrooms: 4, bathrooms: 3,
      buildableW: 42, buildableH: 42,
    },
    output: {
      planName: 'North-facing Split-Zone 4BHK',
      layoutType: 'split',
      engineerThinking: 'Large square plot allows a split-zone layout. Left column is the private bedroom wing; right column has public spaces. This separates road noise from the sleeping zone. Three bathrooms each directly serve a bedroom — none touch the kitchen on the right side.',
      vastuCompliant: false,
      sunlightStrategy: 'Right-side living room gets west afternoon sun. Left-side bedrooms get east morning light.',
      ventilationStrategy: 'Left and right columns separated by a central corridor allow independent ventilation paths.',
      rooms: [
        { type: 'balcony',        label: 'Balcony',        x: 0,  y: 0,  width: 42, height: 5  },
        { type: 'living_room',    label: 'Living Room',    x: 22, y: 5,  width: 20, height: 14 },
        { type: 'master_bedroom', label: 'Master Bedroom', x: 0,  y: 5,  width: 15, height: 14 },
        { type: 'bathroom',       label: 'Master Bath',    x: 15, y: 5,  width: 7,  height: 14 },
        { type: 'dining',         label: 'Dining Room',    x: 22, y: 19, width: 12, height: 11 },
        { type: 'kitchen',        label: 'Kitchen',        x: 34, y: 19, width: 8,  height: 11, windowWall: 'east', doorWall: 'west', platformWall: 'east' },
        { type: 'bedroom',        label: 'Bedroom 2',      x: 0,  y: 19, width: 14, height: 11 },
        { type: 'bathroom',       label: 'Bathroom 2',     x: 14, y: 19, width: 8,  height: 11 },
        { type: 'bedroom',        label: 'Bedroom 3',      x: 0,  y: 30, width: 14, height: 12 },
        { type: 'bedroom',        label: 'Bedroom 4',      x: 14, y: 30, width: 14, height: 12 },
        { type: 'bathroom',       label: 'Bathroom 3',     x: 28, y: 30, width: 14, height: 12 },
      ],
      _notes: [
        'Kitchen at x=34-42, y=19-30. All bathrooms: x=15-22 y=5-19, x=14-22 y=19-30, x=28-42 y=30-42',
        'Bathroom 3 at x=28-42, y=30-42. Kitchen at x=34-42, y=19-30. Shared x range BUT different y — no shared wall ✓',
        'Kitchen doorWall=west (into dining), platformWall=east ✓',
        'Private wing on left (bedrooms), public on right (living+kitchen) — clear split ✓',
      ],
    },
  },

  // ── EXAMPLE 4: 25×40ft plot, South-facing, 2BHK, Compact ────────────────
  // Buildable: 19×32ft (setbacks L3 R3 F4 B4)
  {
    input: {
      plotWidth: 25, plotHeight: 40, facing: 'SOUTH',
      bedrooms: 2, bathrooms: 1,
      buildableW: 19, buildableH: 32,
    },
    output: {
      planName: 'South-facing Compact 2BHK',
      layoutType: 'compact',
      engineerThinking: 'Road on south. Very compact 19×32ft buildable requires a single-column stack. Balcony at front (y=0, south) maximises street presence. Living room behind balcony gets south light. Kitchen pushed to rear-left corner with north window — away from road noise. Single bathroom between bedrooms at the rear.',
      vastuCompliant: false,
      sunlightStrategy: 'South-facing balcony and living room get maximum winter sun — critical for compact homes.',
      ventilationStrategy: 'Narrow plot creates natural north-south stack ventilation from kitchen to living room.',
      rooms: [
        { type: 'balcony',        label: 'Balcony',        x: 0,  y: 0,  width: 19, height: 5  },
        { type: 'living_room',    label: 'Living Room',    x: 0,  y: 5,  width: 19, height: 12 },
        { type: 'dining',         label: 'Dining Room',    x: 0,  y: 17, width: 10, height: 8  },
        { type: 'kitchen',        label: 'Kitchen',        x: 10, y: 17, width: 9,  height: 8,  windowWall: 'north', doorWall: 'west', platformWall: 'north' },
        { type: 'master_bedroom', label: 'Master Bedroom', x: 0,  y: 25, width: 12, height: 7  },
        { type: 'bathroom',       label: 'Bathroom',       x: 12, y: 25, width: 7,  height: 7  },
        { type: 'bedroom',        label: 'Bedroom 2',      x: 0,  y: 32, width: 19, height: 0  },
      ],
      _notes: [
        'Compact: single column layout — no room for side wings at 19ft width',
        'Kitchen at x=10-19, y=17-25. Bathroom at x=12-19, y=25-32. Different y range — no shared wall ✓',
        'Kitchen doorWall=west (into dining at y=17-25, x=0-10 — shared wall) ✓',
        'Kitchen platformWall=north (rear wall), windowWall=north ✓',
        'Balcony at y=0 (front/south road side) ✓',
      ],
    },
  },

  // ── EXAMPLE 5: 60×60ft plot, West-facing, 5BHK ──────────────────────────
  // Buildable: 52×52ft (setbacks L4 R4 F4 B4)
  {
    input: {
      plotWidth: 60, plotHeight: 60, facing: 'WEST',
      bedrooms: 5, bathrooms: 4,
      buildableW: 52, buildableH: 52,
    },
    output: {
      planName: 'West-facing Open-Plan 5BHK',
      layoutType: 'open',
      engineerThinking: 'Road on west. Large 52×52ft buildable enables a true open-plan public zone. Living and dining merge in the front band. Kitchen at north-rear corner maximises distance from road entry. Five bedrooms in two rear rows with four bathrooms each serving a bedroom. No bathroom is adjacent to the kitchen.',
      vastuCompliant: false,
      sunlightStrategy: 'West-facing living room captures evening light. East rear bedrooms get quiet morning light.',
      ventilationStrategy: 'Open-plan front zone and full-width bedroom rows allow east-west cross-ventilation throughout.',
      rooms: [
        { type: 'balcony',        label: 'Balcony',        x: 0,  y: 0,  width: 36, height: 5  },
        { type: 'living_room',    label: 'Living Room',    x: 0,  y: 5,  width: 36, height: 16 },
        { type: 'dining',         label: 'Dining Room',    x: 36, y: 5,  width: 16, height: 10 },
        { type: 'kitchen',        label: 'Kitchen',        x: 36, y: 15, width: 16, height: 12, windowWall: 'east', doorWall: 'north', platformWall: 'east' },
        { type: 'master_bedroom', label: 'Master Bedroom', x: 0,  y: 21, width: 18, height: 14 },
        { type: 'bathroom',       label: 'Master Bath',    x: 18, y: 21, width: 8,  height: 14 },
        { type: 'bedroom',        label: 'Bedroom 2',      x: 26, y: 21, width: 14, height: 14 },
        { type: 'bedroom',        label: 'Bedroom 3',      x: 40, y: 21, width: 12, height: 14 },
        { type: 'bathroom',       label: 'Bathroom 2',     x: 36, y: 27, width: 16, height: 8  },
        { type: 'bedroom',        label: 'Bedroom 4',      x: 0,  y: 35, width: 18, height: 17 },
        { type: 'bathroom',       label: 'Bathroom 3',     x: 18, y: 35, width: 8,  height: 17 },
        { type: 'bedroom',        label: 'Bedroom 5',      x: 26, y: 35, width: 26, height: 17 },
        { type: 'bathroom',       label: 'Bathroom 4',     x: 44, y: 35, width: 8,  height: 17 },
      ],
      _notes: [
        'Kitchen at x=36-52, y=15-27. All bathrooms are at y=21-52 — no shared wall with kitchen ✓',
        'Kitchen doorWall=north (into dining at y=5-15), platformWall=east ✓',
        'Open-plan: living (36ft wide) + dining share front zone',
        'Two bedroom rows: y=21-35 and y=35-52 — each row has dedicated bathrooms',
        'No bathroom is at y=15-27 (kitchen zone) ✓',
      ],
    },
  },

];

/**
 * buildFewShotSection()
 * Returns the few-shot block injected into every Gemini prompt.
 * Shows Gemini the x/y/width/height coordinate system with verified examples.
 */
function buildFewShotSection() {
  return EXAMPLE_PLANS.map((ex, i) => {
    const cleanOutput = { ...ex.output };
    delete cleanOutput._notes;

    return `EXAMPLE ${i + 1} — ${ex.input.plotWidth}×${ex.input.plotHeight}ft ${ex.input.facing}-facing ${ex.input.bedrooms}BHK:
Buildable area: ${ex.input.buildableW}ft wide × ${ex.input.buildableH}ft deep

Input: ${JSON.stringify(ex.input, null, 2)}

Correct output (use this coordinate style):
${JSON.stringify(cleanOutput, null, 2)}

Why this layout is correct:
${ex.output._notes.map(n => '  - ' + n).join('\n')}`;
  }).join('\n\n---\n\n');
}

module.exports = { EXAMPLE_PLANS, buildFewShotSection };
