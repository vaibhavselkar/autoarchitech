'use strict';
/**
 * geminiPrompt.js
 * Gemini acts as a licensed civil engineer.
 * It outputs band/col/sizeWeight decisions — no pixel coordinates.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

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
  STEP 6: Verify every room meets NBC minimum size
  STEP 7: Apply Vastu corrections if requested

You respond ONLY with a valid JSON object.
No markdown. No explanation outside the JSON.
No code blocks. Pure JSON starting with { and ending with }.
`.trim();

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

  return `
Design a floor plan for this plot:

PLOT:
- Total size: ${plotWidth}ft wide × ${plotHeight}ft deep
- Buildable area: ${buildableW}ft × ${buildableH}ft (after setbacks)
- Road facing: ${facing}
- City/region: ${city}
- Setbacks: front ${setbacks.front}ft, rear ${setbacks.rear}ft,
            left ${setbacks.left}ft, right ${setbacks.right}ft

REQUIREMENTS:
- Bedrooms: ${bedrooms} (always include 1 master bedroom)
- Bathrooms: ${bathrooms}
- Always include: living room, kitchen, dining room, balcony, parking
- Style: ${style}
- Priorities: ${priorities.join(', ')}

YOUR TASK:
Design the room layout and return a JSON plan.
For each room, decide:
  1. Which BAND it belongs to:
     band 1 = front zone (near road) — for parking, balcony, entry
     band 2 = middle zone — for living, dining, kitchen
     band 3 = rear zone (away from road) — for bedrooms, bathrooms
  2. Which COLUMN within its band:
     col 1 = left side, col 2 = center, col 3 = right side
     (a room can span multiple columns using colSpan)
  3. SIZE WEIGHT — relative size compared to other rooms in same band:
     living=5, bedroom=4, kitchen=3, dining=3, bathroom=1, corridor=1
  4. Which wall gets the WINDOW
  5. Which wall gets the DOOR (must not be same as platform wall for kitchen)
  6. Which wall has the PLATFORM (kitchen only)

CRITICAL RULES:
- Bathroom NEVER shares a wall with kitchen — place in different bands/cols
- Kitchen MUST be adjacent to dining room (same band, neighboring cols)
- Master bedroom MUST be in band 3 — away from road noise
- Parking MUST be in band 1 — near gate
- Bathroom must be adjacent to at least one bedroom
- Kitchen window wall = also the platform wall (light while cooking)
- Kitchen door wall = opposite to platform wall
- Every bedroom must have a window
- Bathroom can have 1 door only
- If Vastu style: kitchen in SE, master bed in SW, living in NW

Return ONLY this JSON structure (no markdown, no explanation):

{
  "planName": "short descriptive name e.g. 'Compact Vastu 3BHK'",
  "layoutType": "linear|split|compact|open|courtyard",
  "engineerThinking": "3-4 sentences explaining key design decisions and why",
  "vastuCompliant": true or false,
  "sunlightStrategy": "one sentence about natural light maximization",
  "ventilationStrategy": "one sentence about cross-ventilation approach",
  "rooms": [
    {
      "id": "unique_id e.g. living, kitchen, mbed, bed2, bath1",
      "label": "display name e.g. Living Room",
      "type": "living|dining|kitchen|master_bedroom|bedroom|bathroom|balcony|parking|corridor|entry",
      "band": 1,
      "col": 1,
      "colSpan": 1,
      "sizeWeight": 5,
      "windowWall": "north|south|east|west|none",
      "doorWall": "north|south|east|west",
      "platformWall": "north|south|east|west|none",
      "notes": "any special note about this room placement"
    }
  ]
}

Include ALL rooms. Do not skip any room type requested.
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
 * handled by the proven smart builders — Gemini provides the DESIGN BRAIN.
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
2. A creative, unique plan name (be specific, not generic — e.g. "Sunlit Vastu 2BHK" not "Plan A")
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
