'use strict';
/**
 * geminiPrompt.js  v3.0
 *
 * Step 1 — getDesignRecommendations():
 *   Gemini sees ALL 50 layout styles, scores every one against the client's
 *   requirements, and returns the TOP 3 best-fit styles with reasoning.
 *
 * Step 2 — callGemini():
 *   For each of the 3 chosen styles, Gemini designs the actual room layout
 *   with exact coordinates, satisfying EVERY user requirement.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { buildFewShotSection } = require('./examplePlans');
const { buildRulebookPrompt } = require('../knowledge/RULEBOOK');

// ─── System persona ───────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `
You are a senior licensed civil engineer and residential architect with 30 years
of experience designing Indian homes. Your expertise covers:

1. NBC 2016 (National Building Code India) — minimum room sizes, ventilation,
   fire safety, staircase standards, corridor widths
2. Vastu Shastra — compass quadrant rules, sacred room placement, entry direction
3. Indian family lifestyle — joint families, pooja rooms, servant entry, open
   kitchen trends, study rooms, utility/store rooms
4. Climate design — cross-ventilation, sun path for each city, monsoon drainage
5. Municipal bylaws — setbacks, FAR/FSI, ground coverage limits
6. Budget-conscious design — space efficiency for medium/low budgets
7. Modern amenities — smart home readiness, earthquake zones, energy efficiency

Your design process (always in this order):
  1. Read EVERY requirement — miss nothing
  2. Note the plot facing — which wall gets morning sun, which faces road noise
  3. Place service zones away from road noise
  4. Ensure every habitable room has an exterior window
  5. Check adjacency rules — bathroom NEVER touches kitchen or dining
  6. Verify every room meets NBC minimum dimensions
  7. Apply Vastu if requested
  8. Confirm ALL special features and extra rooms are included

You respond ONLY with valid JSON. No markdown, no code blocks, no explanation.
Pure JSON starting with { and ending with }.
`.trim();

// ─── 50 layout styles — Gemini picks the best 3 for each client ──────────────
const LAYOUT_STYLES_50 = `
AVAILABLE LAYOUT STYLES (50 options):
Gemini must evaluate ALL 50 against the client's requirements and pick the TOP 3.
Map your choice to one of our 6 builder keys: linear | private-wing | service-front | open-social | spine | vastu-corner

LINEAR FAMILY (rooms arranged in clear horizontal bands):
  1.  classic-linear       → linear        | 3 clear bands: entry/balcony front, living+service middle, bedrooms rear. Most practical Indian layout.
  2.  linear-offset        → linear        | Offset balcony (right 60%), staggered service zone. Creates visual interest in a simple format.
  3.  linear-compact       → linear        | Minimalist bands, no wasted space. Best for budget builds and smaller plots.
  4.  linear-garden        → linear        | Living room at rear opens to garden. Service zone near road.
  5.  linear-courtyard     → linear        | Internal open courtyard carved into middle band. Light well for interior rooms.
  6.  linear-duplex        → linear        | Ground floor: public zone. First floor: all bedrooms. Clear stair placement.
  7.  linear-studio        → linear        | Studio-style open front zone. Single bedroom block at rear.
  8.  linear-joint         → linear        | Wider version for joint families. Two master bedrooms on opposite sides.

PRIVATE WING FAMILY (rooms split into public/private columns):
  9.  private-wing-left    → private-wing  | Bedrooms LEFT column, living+kitchen RIGHT column. Standard split.
  10. private-wing-right   → private-wing  | Bedrooms RIGHT column, living+kitchen LEFT column. Mirrored for east-facing plots.
  11. private-wing-deep    → private-wing  | Deep bedroom wing (60% width), narrow public column. For tall narrow plots.
  12. private-wing-wide    → private-wing  | Balanced columns (50/50 split). Generous public zone.
  13. private-wing-duplex  → private-wing  | Column layout on two floors. Staircase in private wing.
  14. private-wing-court   → private-wing  | Small internal court between public and private columns for ventilation.

SERVICE-FRONT FAMILY (service zone near road, living opens to rear garden):
  15. service-front-std    → service-front | Kitchen+dining at front, living+bedrooms at rear. Classic garden-living concept.
  16. service-front-entry  → service-front | Prominent entry foyer at front, service tucked behind entry, living rear.
  17. service-front-shop   → service-front | Ground floor front for shop/office use. Living above or behind.
  18. service-front-duplex → service-front | Service ground floor near road. Living and bedrooms on first floor.

OPEN PLAN FAMILY (merged living spaces, fewer internal walls):
  19. open-social-std      → open-social   | Merged living+dining (no partition). Compact kitchen corner. Bedrooms cluster rear.
  20. open-social-island   → open-social   | Open kitchen island connects to dining. Great room concept.
  21. open-social-loft     → open-social   | Loft-style open plan. Double-height living zone with mezzanine.
  22. open-social-studio   → open-social   | Studio apartment open plan. Single multi-use social zone.
  23. open-social-wide     → open-social   | Wide plot open plan. Social zone spans full width.
  24. open-social-court    → open-social   | Open plan wraps around a small courtyard. Light in middle of plan.
  25. open-social-balcony  → open-social   | Large wrap-around balcony connected to open social zone.

SPINE / CORRIDOR FAMILY (central passage connects all rooms):
  26. spine-central        → spine         | Central corridor divides plan. Public rooms front, private rear.
  27. spine-side           → spine         | Side corridor spine. Rooms on one side only. Good for narrow plots.
  28. spine-double         → spine         | Double-loaded corridor. Rooms on BOTH sides of passage. Efficient.
  29. spine-L              → spine         | L-shaped corridor. Public wing one arm, private wing other arm.
  30. spine-courtyard      → spine         | Corridor wraps around small courtyard. Interior rooms get light.
  31. spine-duplex         → spine         | Spine layout on two floors. Staircase in spine at centre.
  32. spine-compact        → spine         | Narrow spine for small plots. Corridor only 3.5ft wide.

VASTU FAMILY (strict compass quadrant placement):
  33. vastu-north-facing   → vastu-corner  | North-facing plot Vastu: entry NE, kitchen SE, master bed SW, living NW.
  34. vastu-south-facing   → vastu-corner  | South-facing plot Vastu: entry SW, kitchen NW, master bed NE, living SE.
  35. vastu-east-facing    → vastu-corner  | East-facing plot Vastu: entry E/NE, kitchen SE, master bed SW.
  36. vastu-west-facing    → vastu-corner  | West-facing plot Vastu: entry W/NW, kitchen SW or SE, master bed SW.
  37. vastu-joint-family   → vastu-corner  | Vastu for joint family: elder master in SW, son's master in NW, kitchen SE.
  38. vastu-pooja-focus    → vastu-corner  | Dedicated NE pooja room is the centrepiece. All other rooms oriented to it.
  39. vastu-water-element  → vastu-corner  | Borewell NE, overhead tank SW, kitchen SE. Full Vastu element compliance.

CONTEMPORARY / MODERN FAMILY:
  40. contemporary-box     → open-social   | Clean box design. No unnecessary corridors. Every sqft used.
  41. contemporary-minimal → linear        | Minimalist interior. Large windows, open kitchen, hidden storage walls.
  42. contemporary-luxury  → private-wing  | Luxury layout. Master suite with walk-in and en-suite. Grand entry foyer.
  43. contemporary-smart   → spine         | Smart home layout. Central hub room for server/controls. Cable routes planned.
  44. contemporary-green   → open-social   | Energy-efficient. Cross-ventilation maximised. Solar panel roof zone clear.

BUDGET / COMPACT FAMILY:
  45. budget-compact       → linear        | Minimum room sizes per NBC. No wasted space. Every room serves a function.
  46. budget-corner-plot   → vastu-corner  | Corner plot optimisation. Two road frontages used for entry and parking.
  47. budget-row-house     → spine         | Row house layout. Single-wall neighbours on both sides. Only front/rear light.
  48. budget-studio-1bhk   → open-social   | 1BHK studio-style. Open plan + single bedroom + compact bathroom.

SPECIAL PURPOSE:
  49. farmhouse-open       → open-social   | Farmhouse concept. Large open social zone with verandah wrap.
  50. heritage-courtyard   → vastu-corner  | Heritage/traditional. Central courtyard with rooms on all 4 sides.
`;

// ─── Build full requirements string from all client inputs ────────────────────
function buildRequirementsSummary(params) {
  const {
    plotWidth, plotHeight, facing, city,
    bedrooms, bathrooms,
    study, prayer_room, guest_room, utility_room,
    floors, staircase_type, staircase_position,
    vastu, parking,
    style, budget,
    special_features,
    earthquake_resistant, energy_efficient, smart_home_ready,
    customIdea,
    setbacks,
  } = params;

  const buildableW = plotWidth  - (setbacks?.left  || 4) - (setbacks?.right || 4);
  const buildableH = plotHeight - (setbacks?.front || 6) - (setbacks?.rear  || 4);

  const extras = [];
  if (study        > 0)  extras.push(`${study} study room(s)`);
  if (prayer_room)        extras.push('1 pooja/prayer room');
  if (guest_room   > 0)  extras.push(`${guest_room} guest room(s)`);
  if (utility_room > 0)  extras.push(`${utility_room} utility/store room(s)`);

  const features = [];
  if (earthquake_resistant)        features.push('earthquake resistant construction');
  if (energy_efficient)            features.push('energy efficient / passive cooling');
  if (smart_home_ready)            features.push('smart home wiring');
  if (special_features?.length)    features.push(...special_features);

  return `
CLIENT REQUIREMENTS — every single item MUST appear in the final plan:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PLOT:
  Total size:     ${plotWidth}ft wide × ${plotHeight}ft deep
  Buildable area: ${buildableW}ft wide × ${buildableH}ft deep
  Road facing:    ${facing.toUpperCase()} (road is on the ${facing} side)
  City/Location:  ${city || 'Central India'}
  Setbacks:       Front=${setbacks?.front || 6}ft, Rear=${setbacks?.rear || 4}ft, Left=${setbacks?.left || 4}ft, Right=${setbacks?.right || 4}ft

ROOMS (mandatory — do not omit any):
  Bedrooms:       ${bedrooms} (1 must be master_bedroom)
  Bathrooms:      ${bathrooms}
  Living room:    1
  Dining room:    1
  Kitchen:        1
  Balcony:        1${extras.length ? '\n  Extra rooms:    ' + extras.join(', ') : ''}

BUILDING:
  Floors:         ${floors || 1}${floors > 1 ? `\n  Staircase:      ${staircase_type || 'dog-leg'} type, ${staircase_position || 'center'} position` : ''}

PREFERENCES:
  Design style:   ${style || 'modern'}
  Budget:         ${budget || 'medium'}
  Vastu:          ${vastu ? 'YES — full Vastu compliance required' : 'no specific Vastu requirement'}
  Parking:        ${parking?.enabled !== false ? `${parking?.cars || 1} car(s), gate ${parking?.gate_direction || 'front'}` : 'no parking required'}${features.length ? '\n  Special:        ' + features.join(', ') : ''}${customIdea ? '\n\n  AI REQUEST FROM CLIENT (highest priority):\n  "' + customIdea + '"' : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`.trim();
}

// ─── Step 1: Gemini picks best 3 from 50 styles ───────────────────────────────
async function getDesignRecommendations(params) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const reqSummary = buildRequirementsSummary(params);

  const prompt = `
${reqSummary}

${LAYOUT_STYLES_50}

YOUR TASK:
Evaluate ALL 50 layout styles above against this client's requirements.
Score each style (0–100) based on how well it fits:
  - Plot dimensions and aspect ratio (${params.plotWidth}×${params.plotHeight}ft)
  - Road facing direction (${(params.facing || 'north').toUpperCase()})
  - Number of rooms (${params.bedrooms}BR/${params.bathrooms}BA)
  - Vastu requirement: ${params.vastu ? 'YES' : 'no'}
  - Budget: ${params.budget || 'medium'}
  - Floors: ${params.floors || 1}
  - Any special features / AI request from client

Then return the TOP 3 highest-scoring styles — each MUST map to a DIFFERENT builder key.
Builder keys available: linear | private-wing | service-front | open-social | spine | vastu-corner
No two plans may share the same builder key.

For each of the 3 chosen styles:
1. style_name: the style name from the list (e.g. "vastu-north-facing")
2. builderKey: the mapped builder key (e.g. "vastu-corner")
3. score: your 0-100 fit score
4. planName: a creative unique plan name specific to this client (NOT generic — include facing, bedrooms, city)
5. theme: design theme in 3-4 words
6. engineerThinking: 3-4 sentences explaining WHY this style suits THIS client's exact plot+requirements
7. vastuCompliant: true/false
8. sunlightStrategy: one sentence specific to ${(params.facing || 'north').toUpperCase()}-facing plot
9. ventilationStrategy: one sentence for cross-ventilation on this plot
10. requirementNotes: one sentence confirming which client requirements drove this choice

Return ONLY this JSON (no markdown, no explanation, no code blocks):
{
  "selectionRationale": "1-2 sentences: overall strategy for this client",
  "plans": [
    {
      "style_name": "vastu-north-facing",
      "builderKey": "vastu-corner",
      "score": 94,
      "planName": "Sunlit Vastu ${params.bedrooms}BHK — ${(params.facing || 'North').charAt(0).toUpperCase() + (params.facing || 'north').slice(1)}-Facing",
      "theme": "Traditional Vastu Compliant",
      "engineerThinking": "3-4 sentences why this fits this specific client",
      "vastuCompliant": ${params.vastu ? 'true' : 'false'},
      "sunlightStrategy": "specific to ${(params.facing || 'north').toUpperCase()} facing",
      "ventilationStrategy": "cross-ventilation strategy",
      "requirementNotes": "all ${params.bedrooms} bedrooms, ${params.bathrooms} bathrooms, and extra rooms included"
    },
    { "style_name": "...", "builderKey": "linear", "score": 91, "planName": "...", "theme": "...", "engineerThinking": "...", "vastuCompliant": false, "sunlightStrategy": "...", "ventilationStrategy": "...", "requirementNotes": "..." },
    { "style_name": "...", "builderKey": "open-social", "score": 88, "planName": "...", "theme": "...", "engineerThinking": "...", "vastuCompliant": false, "sunlightStrategy": "...", "ventilationStrategy": "...", "requirementNotes": "..." }
  ]
}
`.trim();

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
  });

  const result = await model.generateContent(prompt);
  const text   = result.response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
  }

  // Normalize to the format the generator expects
  if (parsed?.plans?.length) {
    parsed.plans = parsed.plans.map(p => ({
      style:               p.builderKey || p.style || 'linear',
      style_name:          p.style_name || p.style,
      score:               p.score,
      planName:            p.planName,
      theme:               p.theme,
      engineerThinking:    p.engineerThinking,
      vastuCompliant:      p.vastuCompliant ?? false,
      sunlightStrategy:    p.sunlightStrategy,
      ventilationStrategy: p.ventilationStrategy,
      requirementNotes:    p.requirementNotes,
    }));
    console.log(`  Gemini style scores: ${parsed.plans.map(p => `${p.style_name}(${p.score})`).join(', ')}`);
    console.log(`  Selected builders:   ${parsed.plans.map(p => p.style).join(', ')}`);
  }

  return parsed;
}

// ─── Step 2: Gemini designs the actual room layout with all requirements ───────
function buildPrompt(params) {
  const {
    plotWidth, plotHeight, facing,
    bedrooms  = 3, bathrooms = 2,
    style     = 'Modern Indian',
    setbacks  = { front: 6, rear: 4, left: 4, right: 4 },
  } = params;

  const buildableW = plotWidth  - (setbacks.left  || 4) - (setbacks.right || 4);
  const buildableH = plotHeight - (setbacks.front || 6) - (setbacks.rear  || 4);

  const reqSummary = buildRequirementsSummary({
    ...params,
    buildableW, buildableH,
  });

  const fewShot = buildFewShotSection();

  return `
You are designing a floor plan. Study these verified correct examples first, then design a NEW plan.

═══════════════════════════════════════════════
VERIFIED CORRECT EXAMPLES — study the coordinate system
═══════════════════════════════════════════════
${fewShot}

═══════════════════════════════════════════════
NOW DESIGN THIS SPECIFIC FLOOR PLAN
═══════════════════════════════════════════════

${reqSummary}

LAYOUT STYLE FOR THIS PLAN: ${style}
(Design a floor plan that matches this style while satisfying EVERY requirement above)

${buildRulebookPrompt()}

COORDINATE RULES:
  - Origin (0,0) = FRONT-LEFT corner of the buildable area
  - x grows RIGHT, y grows DOWN away from the road
  - y=0 = road side, y=${buildableH} = rear/garden side
  - Every room: 0 ≤ x ≤ ${buildableW}-width, 0 ≤ y ≤ ${buildableH}-height
  - Rooms MUST NOT overlap (max 0.2ft tolerance for walls)
  - Rooms MUST cover the FULL ${buildableW}×${buildableH}ft buildable area (zero gaps)
  - Parking: placed at y=-(parking_height) — in front of buildable area near gate
  - Kitchen: platformWall = windowWall; doorWall = the OPPOSITE wall

REQUIREMENT CHECKLIST — every item must have a corresponding room:
  ✓ ${bedrooms} bedroom(s): first must be master_bedroom, rest are bedroom
  ✓ ${bathrooms} bathroom(s): each adjacent to a bedroom
  ✓ 1 living_room
  ✓ 1 dining room
  ✓ 1 kitchen (adjacent to dining)
  ✓ 1 balcony (front zone, y < ${Math.round(buildableH * 0.3)}ft)
  ${params.study        > 0 ? `✓ ${params.study} study room(s)` : ''}
  ${params.prayer_room      ? '✓ 1 pooja/prayer room' : ''}
  ${params.guest_room   > 0 ? `✓ ${params.guest_room} guest room(s)` : ''}
  ${params.utility_room > 0 ? `✓ ${params.utility_room} utility room(s)` : ''}
  ${params.floors       > 1 ? `✓ 1 staircase (${params.staircase_type} type)` : ''}
  ${params.vastu            ? '✓ VASTU COMPLIANT placement required' : ''}
  ${params.customIdea       ? `✓ AI REQUEST: "${params.customIdea}"` : ''}

Return ONLY this JSON (no markdown, no explanation, no code blocks):
{
  "planName": "unique descriptive name — include facing, bedrooms, style",
  "layoutType": "linear|split|compact|open|vastu|spine|open-social",
  "engineerThinking": "4-5 sentences: every major spatial decision, why rooms placed where, how requirements are met",
  "vastuCompliant": ${params.vastu ? 'true' : 'false'},
  "sunlightStrategy": "one sentence specific to ${facing.toUpperCase()} facing",
  "ventilationStrategy": "one sentence cross-ventilation approach",
  "requirementsMet": "confirm all rooms, special features, AI request are included",
  "rooms": [
    {
      "type": "living_room|dining|kitchen|master_bedroom|bedroom|bathroom|balcony|parking|corridor|entry|staircase|study|prayer_room|guest_room|utility_room",
      "label": "e.g. Living Room",
      "x": 0,
      "y": 5,
      "width": 20,
      "height": 14,
      "windowWall": "north|south|east|west|none",
      "doorWall": "north|south|east|west",
      "platformWall": "north|south|east|west|none"
    }
  ]
}

IMPORTANT:
  - Design a GENUINELY unique layout matching the "${style}" style
  - Include ALL rooms from the checklist above — do not omit any
  - All coordinates in FEET
  - Use the FULL ${buildableW}×${buildableH}ft buildable area — no gaps
`.trim();
}

async function callGemini(params) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const genAI  = new GoogleGenerativeAI(apiKey);
  const model  = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
  });

  const prompt = buildPrompt(params);
  const result = await model.generateContent(prompt);
  const text   = result.response.text();

  try {
    return JSON.parse(text);
  } catch {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  }
}

module.exports = { callGemini, buildPrompt, SYSTEM_PROMPT, getDesignRecommendations };
