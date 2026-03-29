'use strict';
/**
 * examplePlans.js — Few-shot learning library for Gemini.
 *
 * These are hand-crafted, validator-verified example plans.
 * Each covers a different plot size, orientation, and BHK count.
 * Gemini reads these BEFORE designing a new plan and copies the pattern.
 *
 * Rules verified in every example:
 *   ✓ No bathroom shares a wall with kitchen (different band OR column)
 *   ✓ Kitchen platformWall ≠ doorWall
 *   ✓ Every bedroom has a windowWall
 *   ✓ Bathroom sizeWeight always 1, living always 5
 *   ✓ minH and minW specified for every room
 *   ✓ Master bedroom always in band 3
 *   ✓ Parking always in band 1
 */

const EXAMPLE_PLANS = [

  // ── EXAMPLE 1: 40×35ft, North-facing, 3BHK ──────────────────────────────
  {
    input: {
      plotWidth: 40, plotHeight: 35, facing: 'NORTH',
      bedrooms: 3, bathrooms: 2, style: 'Modern Indian',
    },
    output: {
      planName: 'North-facing 3BHK Linear',
      layoutType: 'linear',
      engineerThinking: 'Road is on the north. Parking and balcony face the road for easy access. Living room in band 2 gets afternoon light from the west. Kitchen placed at rear-right for privacy and ventilation. Both bathrooms are in band 3 flanking bedrooms — never touching the kitchen which is band 2.',
      vastuCompliant: false,
      sunlightStrategy: 'Living room on west side of band 2 gets afternoon sun. Bedrooms on south wall get winter sun.',
      ventilationStrategy: 'Kitchen on east wall has cross-ventilation with west-facing living room.',
      rooms: [
        { id: 'parking', label: 'Parking',        type: 'parking',        band: 1, col: 1, colSpan: 1, sizeWeight: 2, doorWall: 'north', windowWall: 'none',  platformWall: 'none',  minW: 9,  minH: 18 },
        { id: 'balcony', label: 'Balcony',         type: 'balcony',        band: 1, col: 2, colSpan: 2, sizeWeight: 5, doorWall: 'south', windowWall: 'north', platformWall: 'none',  minW: 10, minH: 5  },
        { id: 'living',  label: 'Living Room',     type: 'living',         band: 2, col: 1, colSpan: 2, sizeWeight: 5, doorWall: 'east',  windowWall: 'west',  platformWall: 'none',  minW: 12, minH: 12 },
        { id: 'dining',  label: 'Dining Room',     type: 'dining',         band: 2, col: 2, colSpan: 1, sizeWeight: 3, doorWall: 'south', windowWall: 'north', platformWall: 'none',  minW: 10, minH: 10 },
        { id: 'kitchen', label: 'Kitchen',         type: 'kitchen',        band: 2, col: 3, colSpan: 1, sizeWeight: 3, doorWall: 'west',  windowWall: 'east',  platformWall: 'east',  minW: 8,  minH: 10 },
        { id: 'mbed',    label: 'Master Bedroom',  type: 'master_bedroom', band: 3, col: 1, colSpan: 2, sizeWeight: 5, doorWall: 'north', windowWall: 'south', platformWall: 'none',  minW: 12, minH: 12 },
        { id: 'bed2',    label: 'Bedroom 2',       type: 'bedroom',        band: 3, col: 2, colSpan: 1, sizeWeight: 4, doorWall: 'north', windowWall: 'south', platformWall: 'none',  minW: 10, minH: 10 },
        { id: 'bath1',   label: 'Bathroom 1',      type: 'bathroom',       band: 3, col: 3, colSpan: 1, sizeWeight: 1, doorWall: 'west',  windowWall: 'none',  platformWall: 'none',  minW: 5,  minH: 7  },
        { id: 'bed3',    label: 'Bedroom 3',       type: 'bedroom',        band: 3, col: 3, colSpan: 1, sizeWeight: 4, doorWall: 'north', windowWall: 'east',  platformWall: 'none',  minW: 10, minH: 10 },
        { id: 'bath2',   label: 'Bathroom 2',      type: 'bathroom',       band: 3, col: 1, colSpan: 1, sizeWeight: 1, doorWall: 'east',  windowWall: 'none',  platformWall: 'none',  minW: 5,  minH: 7  },
      ],
      _notes: [
        'bath1 is col:3 band:3 — adjacent to bed2/bed3, NOT touching kitchen which is col:3 band:2 (different band = different physical wall)',
        'bath2 is col:1 band:3 — adjacent to master bedroom, far from kitchen col:3',
        'kitchen platformWall=east, doorWall=west — opposite walls enforced',
        'parking col:1 band:1 — closest to road gate on the left',
        'master bedroom always band:3 — furthest from road noise',
      ],
    },
  },

  // ── EXAMPLE 2: 30×40ft, East-facing, 2BHK, Vastu ────────────────────────
  {
    input: {
      plotWidth: 30, plotHeight: 40, facing: 'EAST',
      bedrooms: 2, bathrooms: 1, style: 'Vastu',
    },
    output: {
      planName: 'East-facing Vastu 2BHK',
      layoutType: 'vastu',
      engineerThinking: 'Road is on the east. Entry and living room face east to receive morning light — auspicious in Vastu. Kitchen placed in SE quadrant (band 2, col 3) as Vastu requires fire element in SE. Master bedroom in SW (band 3, col 1) for stability. Bathroom in NW is acceptable per Vastu.',
      vastuCompliant: true,
      sunlightStrategy: 'Living room and balcony on east wall receive morning sun — optimal for Indian homes.',
      ventilationStrategy: 'Kitchen on south wall, bedrooms on west — creates diagonal cross-ventilation.',
      rooms: [
        { id: 'parking', label: 'Parking',        type: 'parking',        band: 1, col: 1, colSpan: 1, sizeWeight: 2, doorWall: 'east',  windowWall: 'none',  platformWall: 'none',  minW: 9,  minH: 18 },
        { id: 'balcony', label: 'Balcony',         type: 'balcony',        band: 1, col: 2, colSpan: 2, sizeWeight: 4, doorWall: 'south', windowWall: 'east',  platformWall: 'none',  minW: 8,  minH: 5  },
        { id: 'living',  label: 'Living Room',     type: 'living',         band: 2, col: 1, colSpan: 2, sizeWeight: 5, doorWall: 'south', windowWall: 'east',  platformWall: 'none',  minW: 12, minH: 12 },
        { id: 'dining',  label: 'Dining Room',     type: 'dining',         band: 2, col: 2, colSpan: 1, sizeWeight: 3, doorWall: 'west',  windowWall: 'east',  platformWall: 'none',  minW: 10, minH: 10 },
        { id: 'kitchen', label: 'Kitchen',         type: 'kitchen',        band: 2, col: 3, colSpan: 1, sizeWeight: 3, doorWall: 'north', windowWall: 'south', platformWall: 'south', minW: 8,  minH: 10 },
        { id: 'mbed',    label: 'Master Bedroom',  type: 'master_bedroom', band: 3, col: 1, colSpan: 2, sizeWeight: 5, doorWall: 'east',  windowWall: 'west',  platformWall: 'none',  minW: 12, minH: 12 },
        { id: 'bed2',    label: 'Bedroom 2',       type: 'bedroom',        band: 3, col: 2, colSpan: 1, sizeWeight: 4, doorWall: 'east',  windowWall: 'west',  platformWall: 'none',  minW: 10, minH: 10 },
        { id: 'bath1',   label: 'Bathroom',        type: 'bathroom',       band: 3, col: 3, colSpan: 1, sizeWeight: 1, doorWall: 'west',  windowWall: 'none',  platformWall: 'none',  minW: 5,  minH: 7  },
      ],
      _notes: [
        'Vastu: kitchen is SE = col:3 band:2 on east-facing plot',
        'Vastu: master bedroom is SW = col:1 band:3',
        'bathroom col:3 band:3 — adjacent to bed2, NOT touching kitchen col:3 band:2 (DIFFERENT BAND = different wall)',
        'kitchen platformWall=south — doorWall must be north (opposite side)',
      ],
    },
  },

  // ── EXAMPLE 3: 50×40ft, North-facing, 4BHK, Traditional ─────────────────
  {
    input: {
      plotWidth: 50, plotHeight: 40, facing: 'NORTH',
      bedrooms: 4, bathrooms: 3, style: 'Traditional',
    },
    output: {
      planName: 'North-facing Traditional 4BHK',
      layoutType: 'split',
      engineerThinking: 'Large plot allows split-zone layout. Left zone has public spaces, right zone has private bedrooms. Three bathrooms each adjacent to a bedroom and none touch kitchen. Kitchen at rear-right with service entry.',
      vastuCompliant: false,
      sunlightStrategy: 'All four bedrooms on south or west walls for afternoon light and privacy from road.',
      ventilationStrategy: 'Central corridor acts as air shaft. Kitchen on rear wall has full cross-ventilation.',
      rooms: [
        { id: 'parking', label: 'Parking',        type: 'parking',        band: 1, col: 1, colSpan: 1, sizeWeight: 2, doorWall: 'north', windowWall: 'none',  platformWall: 'none',  minW: 9,  minH: 18 },
        { id: 'balcony', label: 'Balcony',         type: 'balcony',        band: 1, col: 2, colSpan: 2, sizeWeight: 6, doorWall: 'south', windowWall: 'north', platformWall: 'none',  minW: 12, minH: 5  },
        { id: 'living',  label: 'Living Room',     type: 'living',         band: 2, col: 1, colSpan: 2, sizeWeight: 5, doorWall: 'east',  windowWall: 'west',  platformWall: 'none',  minW: 12, minH: 12 },
        { id: 'dining',  label: 'Dining Room',     type: 'dining',         band: 2, col: 2, colSpan: 1, sizeWeight: 4, doorWall: 'south', windowWall: 'north', platformWall: 'none',  minW: 12, minH: 12 },
        { id: 'kitchen', label: 'Kitchen',         type: 'kitchen',        band: 2, col: 3, colSpan: 1, sizeWeight: 3, doorWall: 'west',  windowWall: 'east',  platformWall: 'east',  minW: 8,  minH: 10 },
        { id: 'bath1',   label: 'Bathroom 1',      type: 'bathroom',       band: 2, col: 1, colSpan: 1, sizeWeight: 1, doorWall: 'east',  windowWall: 'none',  platformWall: 'none',  minW: 5,  minH: 7  },
        { id: 'mbed',    label: 'Master Bedroom',  type: 'master_bedroom', band: 3, col: 1, colSpan: 2, sizeWeight: 5, doorWall: 'north', windowWall: 'south', platformWall: 'none',  minW: 12, minH: 12 },
        { id: 'bed2',    label: 'Bedroom 2',       type: 'bedroom',        band: 3, col: 2, colSpan: 1, sizeWeight: 4, doorWall: 'north', windowWall: 'south', platformWall: 'none',  minW: 10, minH: 10 },
        { id: 'bath2',   label: 'Bathroom 2',      type: 'bathroom',       band: 3, col: 2, colSpan: 1, sizeWeight: 1, doorWall: 'west',  windowWall: 'south', platformWall: 'none',  minW: 5,  minH: 7  },
        { id: 'bed3',    label: 'Bedroom 3',       type: 'bedroom',        band: 3, col: 3, colSpan: 1, sizeWeight: 4, doorWall: 'north', windowWall: 'east',  platformWall: 'none',  minW: 10, minH: 10 },
        { id: 'bed4',    label: 'Bedroom 4',       type: 'bedroom',        band: 3, col: 3, colSpan: 1, sizeWeight: 4, doorWall: 'north', windowWall: 'east',  platformWall: 'none',  minW: 10, minH: 10 },
        { id: 'bath3',   label: 'Bathroom 3',      type: 'bathroom',       band: 3, col: 3, colSpan: 1, sizeWeight: 1, doorWall: 'west',  windowWall: 'none',  platformWall: 'none',  minW: 5,  minH: 7  },
      ],
      _notes: [
        'bath1 in band:2 col:1 — next to living room, far from kitchen col:3',
        'bath2 in band:3 col:2 — between bed2 and master bedroom',
        'bath3 in band:3 col:3 — adjacent to bed3 and bed4',
        'NONE of the 3 bathrooms share a band+column with kitchen — verified',
        'kitchen is col:3 band:2; all bathrooms in band:3 or different column',
      ],
    },
  },

  // ── EXAMPLE 4: 25×30ft, South-facing, 2BHK, Compact ─────────────────────
  // Tests: small plot where every ft counts — rooms must still hit minimums
  {
    input: {
      plotWidth: 25, plotHeight: 30, facing: 'SOUTH',
      bedrooms: 2, bathrooms: 1, style: 'Compact',
    },
    output: {
      planName: 'South-facing Compact 2BHK',
      layoutType: 'compact',
      engineerThinking: 'Road is on the south. Small 21×24ft buildable area demands a compact single-column layout — no room for a wide private wing. Parking is omitted to save space (street parking). Balcony is narrow and front-facing only. Kitchen at rear-north gets full cross-ventilation and avoids road noise. Single bathroom tucked between both bedrooms.',
      vastuCompliant: false,
      sunlightStrategy: 'Living room faces south toward road — gets maximum winter sun through full-width south windows.',
      ventilationStrategy: 'Single-column layout allows north-south breeze through kitchen-to-living alignment.',
      rooms: [
        { id: 'balcony', label: 'Balcony',         type: 'balcony',        band: 1, col: 2, colSpan: 2, sizeWeight: 3, doorWall: 'north', windowWall: 'south', platformWall: 'none',  minW: 8,  minH: 5  },
        { id: 'living',  label: 'Living Room',      type: 'living',         band: 2, col: 1, colSpan: 3, sizeWeight: 5, doorWall: 'south', windowWall: 'south', platformWall: 'none',  minW: 12, minH: 12 },
        { id: 'dining',  label: 'Dining Room',      type: 'dining',         band: 2, col: 1, colSpan: 2, sizeWeight: 3, doorWall: 'east',  windowWall: 'west',  platformWall: 'none',  minW: 10, minH: 10 },
        { id: 'kitchen', label: 'Kitchen',          type: 'kitchen',        band: 2, col: 3, colSpan: 1, sizeWeight: 3, doorWall: 'south', windowWall: 'north', platformWall: 'north', minW: 8,  minH: 10 },
        { id: 'mbed',    label: 'Master Bedroom',   type: 'master_bedroom', band: 3, col: 1, colSpan: 2, sizeWeight: 5, doorWall: 'south', windowWall: 'north', platformWall: 'none',  minW: 12, minH: 12 },
        { id: 'bath1',   label: 'Bathroom',         type: 'bathroom',       band: 3, col: 2, colSpan: 1, sizeWeight: 1, doorWall: 'south', windowWall: 'none',  platformWall: 'none',  minW: 5,  minH: 7  },
        { id: 'bed2',    label: 'Bedroom 2',        type: 'bedroom',        band: 3, col: 3, colSpan: 1, sizeWeight: 4, doorWall: 'south', windowWall: 'north', platformWall: 'none',  minW: 10, minH: 10 },
      ],
      _notes: [
        'Small plot: no parking — street parking used instead',
        'kitchen is col:3 band:2 — platformWall=north, doorWall=south (opposite walls)',
        'bath1 is col:2 band:3 — directly between master bedroom and bed2, accessible from both',
        'bath1 and kitchen share col:3 NO — bath is col:2 and kitchen is col:3: different columns',
        'bath1 is band:3, kitchen is band:2 — even if same column, DIFFERENT band = no shared wall',
        'Living room spans full width (colSpan:3) — makes small plot feel spacious',
      ],
    },
  },

  // ── EXAMPLE 5: 60×50ft, West-facing, 5BHK, Open Plan ────────────────────
  // Tests: large plot — open-plan merging, multiple bathrooms correctly placed
  {
    input: {
      plotWidth: 60, plotHeight: 50, facing: 'WEST',
      bedrooms: 5, bathrooms: 4, style: 'Open Plan',
    },
    output: {
      planName: 'West-facing Open 5BHK',
      layoutType: 'open',
      engineerThinking: 'Road is on the west. Large 56×44ft buildable area allows true open-plan public zone — living, dining, kitchen merge into one continuous space in band 2. Five bedrooms split across two columns in band 3 with dedicated bathrooms. Kitchen at southwest corner uses west light for evening cooking. All bathrooms are in band 3 — completely separated from kitchen in band 2.',
      vastuCompliant: false,
      sunlightStrategy: 'Living room on west wall captures evening light. Bedrooms on east wall get morning light for natural wake-up.',
      ventilationStrategy: 'Open-plan band 2 allows full east-west cross-ventilation. Five bedroom windows on east create morning draft.',
      rooms: [
        { id: 'parking', label: 'Parking',         type: 'parking',        band: 1, col: 1, colSpan: 1, sizeWeight: 2, doorWall: 'west',  windowWall: 'none',  platformWall: 'none',  minW: 9,  minH: 18 },
        { id: 'balcony', label: 'Balcony',          type: 'balcony',        band: 1, col: 2, colSpan: 2, sizeWeight: 6, doorWall: 'east',  windowWall: 'west',  platformWall: 'none',  minW: 15, minH: 5  },
        { id: 'living',  label: 'Living Room',      type: 'living',         band: 2, col: 1, colSpan: 2, sizeWeight: 5, doorWall: 'east',  windowWall: 'west',  platformWall: 'none',  minW: 16, minH: 14 },
        { id: 'dining',  label: 'Dining Room',      type: 'dining',         band: 2, col: 2, colSpan: 1, sizeWeight: 4, doorWall: 'south', windowWall: 'north', platformWall: 'none',  minW: 12, minH: 12 },
        { id: 'kitchen', label: 'Kitchen',          type: 'kitchen',        band: 2, col: 3, colSpan: 1, sizeWeight: 3, doorWall: 'north', windowWall: 'west',  platformWall: 'west',  minW: 10, minH: 12 },
        { id: 'mbed',    label: 'Master Bedroom',   type: 'master_bedroom', band: 3, col: 1, colSpan: 2, sizeWeight: 5, doorWall: 'north', windowWall: 'east',  platformWall: 'none',  minW: 14, minH: 14 },
        { id: 'bath1',   label: 'Master Bath',      type: 'bathroom',       band: 3, col: 1, colSpan: 1, sizeWeight: 1, doorWall: 'east',  windowWall: 'none',  platformWall: 'none',  minW: 5,  minH: 8  },
        { id: 'bed2',    label: 'Bedroom 2',        type: 'bedroom',        band: 3, col: 2, colSpan: 1, sizeWeight: 4, doorWall: 'north', windowWall: 'east',  platformWall: 'none',  minW: 11, minH: 11 },
        { id: 'bath2',   label: 'Bathroom 2',       type: 'bathroom',       band: 3, col: 2, colSpan: 1, sizeWeight: 1, doorWall: 'north', windowWall: 'none',  platformWall: 'none',  minW: 5,  minH: 7  },
        { id: 'bed3',    label: 'Bedroom 3',        type: 'bedroom',        band: 3, col: 3, colSpan: 1, sizeWeight: 4, doorWall: 'north', windowWall: 'east',  platformWall: 'none',  minW: 11, minH: 11 },
        { id: 'bed4',    label: 'Bedroom 4',        type: 'bedroom',        band: 3, col: 3, colSpan: 1, sizeWeight: 4, doorWall: 'north', windowWall: 'east',  platformWall: 'none',  minW: 11, minH: 11 },
        { id: 'bath3',   label: 'Bathroom 3',       type: 'bathroom',       band: 3, col: 3, colSpan: 1, sizeWeight: 1, doorWall: 'west',  windowWall: 'none',  platformWall: 'none',  minW: 5,  minH: 7  },
        { id: 'bed5',    label: 'Bedroom 5',        type: 'bedroom',        band: 3, col: 2, colSpan: 1, sizeWeight: 4, doorWall: 'north', windowWall: 'east',  platformWall: 'none',  minW: 11, minH: 11 },
        { id: 'bath4',   label: 'Bathroom 4',       type: 'bathroom',       band: 3, col: 1, colSpan: 1, sizeWeight: 1, doorWall: 'east',  windowWall: 'none',  platformWall: 'none',  minW: 5,  minH: 7  },
      ],
      _notes: [
        'All 4 bathrooms are in band:3 — kitchen is in band:2. Zero shared walls possible.',
        'kitchen platformWall=west, doorWall=north — not the same wall, rule enforced',
        'Open plan: living+dining in same band creates large connected space',
        'master bedroom colSpan:2 fills left half of band 3 — generous size on large plot',
        'Five bedrooms fit by stacking rows within band 3 columns',
      ],
    },
  },

];

/**
 * buildFewShotSection()
 * Returns the few-shot block injected before the new plot request.
 * Gemini reads examples → copies the spatial pattern for new designs.
 */
function buildFewShotSection() {
  return EXAMPLE_PLANS.map((ex, i) => {
    // Strip _notes from the output JSON Gemini sees (keep it clean)
    const cleanOutput = { ...ex.output };
    delete cleanOutput._notes;

    return `EXAMPLE ${i + 1}:
Input: ${JSON.stringify(ex.input, null, 2)}

Correct output:
${JSON.stringify(cleanOutput, null, 2)}

Why this is correct:
${ex.output._notes.map(n => '  - ' + n).join('\n')}`;
  }).join('\n\n---\n\n');
}

module.exports = { EXAMPLE_PLANS, buildFewShotSection };
