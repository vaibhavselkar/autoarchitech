'use strict';
/**
 * geminiPrompt.js
 * Gemini acts as a licensed civil engineer.
 * Uses few-shot learning: shows Gemini 5 perfect example plans
 * before every request so it learns the correct spatial pattern.
 */

const { GoogleGenerativeAI }         = require('@google/generative-ai');
const { buildFewShotSection }        = require('./examplePlans');

const SYSTEM_PROMPT = `
You are a licensed civil engineer and architect with 25 years of experience
designing Indian residential buildings. You have deep knowledge of:

1. NBC 2016 (National Building Code India) — room sizes, ventilation,
   fire safety, circulation widths
2. Vastu Shastra — compass-based room placement for Indian homes
3. Indian family lifestyle — joint families, servant entry, prayer rooms,
   open kitchen trends
4. Climate — cross-ventilation, sun path, prevailing winds for Indian cities
5. Municipal bylaws — setbacks, FSI, ground coverage

When you design a floor plan you think in this order:
  STEP 1: Where is the sun? (which walls get morning/afternoon light)
  STEP 2: Where is the road? (public zone faces road, private zone is rear)
  STEP 3: Place service zones (kitchen, bath) away from road noise
  STEP 4: Ensure every bedroom has cross-ventilation
  STEP 5: Check all adjacency rules (bath NEVER touches kitchen or dining)
  STEP 6: Verify every room meets NBC minimum size using the minH/minW values
  STEP 7: Apply Vastu corrections if requested

You respond ONLY with a valid JSON object.
No markdown. No explanation outside the JSON.
No code blocks. Pure JSON starting with { and ending with }.
`.trim();

// Minimum dimensions every room must meet — injected into the prompt
const ROOM_MINIMUMS = `
MANDATORY MINIMUM SIZES (never go below these):
  living_room:     minH: 12,  minW: 12
  master_bedroom:  minH: 12,  minW: 12
  bedroom:         minH: 10,  minW: 10
  kitchen:         minH: 10,  minW: 8
  dining:          minH: 10,  minW: 10
  bathroom:        minH: 7,   minW: 5
  balcony:         minH: 5,   minW: 8
  parking:         minH: 18,  minW: 9
  corridor:        minH: 4,   minW: 3
  entry:           minH: 4,   minW: 4

You MUST output minH and minW for EVERY room.
The layout engine uses these values directly to set room sizes.
Never output a room with minH or minW below these values.`.trim();

function buildPrompt(params) {
  const {
    plotWidth, plotHeight, facing,
    bedrooms = 3, bathrooms = 2,
    style = 'Modern Indian',
    priorities = ['natural light', 'privacy', 'ventilation'],
    setbacks = { front: 3, rear: 3, left: 2, right: 2 },
    city = 'Central India',
  } = params;

  const buildableW = plotWidth  - (setbacks.left  || 2) - (setbacks.right || 2);
  const buildableH = plotHeight - (setbacks.front || 3) - (setbacks.rear  || 3);

  const fewShot = buildFewShotSection();

  return `
You are designing a floor plan. Study these verified correct examples first, then design a NEW plan.

═══════════════════════════════════════════════
VERIFIED CORRECT EXAMPLES — study the coordinate system
═══════════════════════════════════════════════
${fewShot}

═══════════════════════════════════════════════
NOW DESIGN THIS NEW FLOOR PLAN
═══════════════════════════════════════════════

PLOT:
- Total plot: ${plotWidth}ft wide × ${plotHeight}ft deep
- BUILDABLE AREA: ${buildableW}ft wide × ${buildableH}ft deep
  (origin x=0,y=0 is the FRONT-LEFT corner of the buildable area)
  (x grows RIGHT, y grows DOWN away from the road)
  (y=0 = road side, y=${buildableH} = rear/garden side)
- Road facing: ${facing} (the road is on the ${facing} side)
- City: ${city}
- Style: ${style}
- Priorities: ${priorities.join(', ')}

REQUIREMENTS:
- ${bedrooms} bedrooms (first must be master_bedroom)
- ${bathrooms} bathrooms
- Must include: living_room, kitchen, dining, balcony
- Must include: parking (placed outside buildable area at y < 0 or beside it — use y=0 as gate line)

${ROOM_MINIMUMS}

COORDINATE RULES:
- Every room's x must be: 0 ≤ x ≤ ${buildableW} - width
- Every room's y must be: 0 ≤ y ≤ ${buildableH} - height
- Rooms must NOT overlap each other
- All rooms together should cover most of the ${buildableW}×${buildableH}ft buildable area
- Parking is placed at y=-(parking_height) (in front of buildable area near the gate)

CRITICAL DESIGN RULES:
- Bathroom must NEVER be directly adjacent to kitchen (no shared wall)
- Kitchen must be adjacent to dining (shared wall)
- Master bedroom must be at the rear (high y values, away from road)
- Balcony must be at the front (low y values, near road)
- Every bedroom must have an exterior wall for a window
- Kitchen: platformWall and windowWall are the same; doorWall is the opposite wall

Return ONLY this JSON (no markdown, no explanation, no code blocks):

{
  "planName": "descriptive unique name e.g. 'Sunlit North 3BHK'",
  "layoutType": "linear|split|compact|open|vastu",
  "engineerThinking": "3-4 sentences: key spatial decisions, why rooms are placed where they are",
  "vastuCompliant": false,
  "sunlightStrategy": "one sentence",
  "ventilationStrategy": "one sentence",
  "rooms": [
    {
      "type": "living_room|dining|kitchen|master_bedroom|bedroom|bathroom|balcony|parking|corridor|entry|staircase",
      "label": "Living Room",
      "x": 0,
      "y": 5,
      "width": 20,
      "height": 14,
      "windowWall": "west",
      "doorWall": "east",
      "platformWall": "none"
    }
  ]
}

Design a genuinely unique layout — do NOT copy the example plans.
Use the full ${buildableW}×${buildableH}ft buildable area creatively.
Include ALL required rooms. All coordinates in FEET.
`.trim();
}

async function callGemini(params) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const genAI     = new GoogleGenerativeAI(apiKey);
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const model     = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      temperature:      0.3,
      responseMimeType: 'application/json',
    },
  });

  const prompt = buildPrompt(params);
  const result = await model.generateContent(prompt);
  const text   = result.response.text();

  try {
    return JSON.parse(text);
  } catch {
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  }
}

/**
 * getDesignRecommendations(params)
 *
 * Asks Gemini to DECIDE which 3 layout strategies work best for this
 * specific plot and requirements. The physical room placement is then
 * handled by callGemini() — Gemini provides the DESIGN BRAIN.
 *
 * Returns: { plans: [{ style, planName, theme, engineerThinking,
 *                       vastuCompliant, sunlightStrategy, ventilationStrategy }, ...] }
 */
async function getDesignRecommendations(params) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const {
    plotWidth, plotHeight, facing,
    bedrooms = 3, bathrooms = 2,
    city = 'Central India',
    setbacks = { front: 3, rear: 3, left: 2, right: 2 },
  } = params;

  const buildableW = plotWidth  - (setbacks.left  || 2) - (setbacks.right || 2);
  const buildableH = plotHeight - (setbacks.front || 3) - (setbacks.rear  || 3);

  const prompt = `
You are a licensed civil engineer. A client needs ${bedrooms} bedrooms and ${bathrooms} bathrooms
on a ${plotWidth}ft × ${plotHeight}ft plot (buildable area: ${buildableW}ft × ${buildableH}ft)
facing ${facing} in ${city}.

Your job: recommend 3 GENUINELY DIFFERENT floor plan strategies for this specific plot.
Each must use a distinct spatial organization. Available strategies:
  "linear"       — horizontal zone bands: front/middle/rear
  "private-wing" — bedrooms in a private left column, public rooms on right
  "service-front"— kitchen/dining at front near road, living opens to rear garden

For each plan, you decide:
1. Which strategy fits best for ONE of the 3 plans (each plan must use a different strategy)
2. A creative, unique plan name (be specific — e.g. "Sunlit Vastu 2BHK" not "Plan A")
3. The design theme (e.g. "Modern Minimalist", "Traditional Vastu", "Compact Contemporary")
4. 2-3 sentences of engineer thinking explaining WHY this strategy suits this plot/orientation
5. Whether it can be Vastu compliant
6. Sunlight and ventilation strategies specific to this plot's orientation

Consider the plot's ${facing} facing carefully — where does morning/evening sun come in?
For a ${buildableH}ft deep × ${buildableW}ft wide buildable area, which layout avoids wasted space?

Return ONLY this JSON (no markdown, no explanation):
{
  "plans": [
    {
      "style": "linear",
      "planName": "unique descriptive name",
      "theme": "design theme",
      "engineerThinking": "2-3 sentences: why this strategy, orientation logic, key trade-offs",
      "vastuCompliant": true,
      "sunlightStrategy": "specific to ${facing} facing and plot dimensions",
      "ventilationStrategy": "cross-ventilation approach for ${buildableW}×${buildableH}ft buildable"
    },
    {
      "style": "private-wing",
      "planName": "...",
      "theme": "...",
      "engineerThinking": "...",
      "vastuCompliant": false,
      "sunlightStrategy": "...",
      "ventilationStrategy": "..."
    },
    {
      "style": "service-front",
      "planName": "...",
      "theme": "...",
      "engineerThinking": "...",
      "vastuCompliant": false,
      "sunlightStrategy": "...",
      "ventilationStrategy": "..."
    }
  ]
}
`.trim();

  const genAI    = new GoogleGenerativeAI(apiKey);
  const model    = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: { temperature: 0.7, responseMimeType: 'application/json' },
  });

  const result = await model.generateContent(prompt);
  const text   = result.response.text();

  try {
    return JSON.parse(text);
  } catch {
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  }
}

module.exports = { callGemini, buildPrompt, SYSTEM_PROMPT, getDesignRecommendations };
