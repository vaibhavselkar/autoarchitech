'use strict';
/**
 * exampleCollector.js — Self-growing few-shot learning feedback loop.
 *
 * Every time the validator scores a Gemini-designed plan ≥ 85/100,
 * this module saves it to examplePlans.js.
 *
 * Over time the example library grows to cover more plot configurations,
 * and Gemini makes fewer basic errors on each subsequent request.
 * This is the closest thing to training without access to model weights.
 *
 * Limits:
 *   - Only saves plans where aiSource === 'gemini-room-design'
 *     (not smart-builder plans — they aren't Gemini's work)
 *   - Max 15 examples (beyond that, oldest is removed to save tokens)
 *   - No duplicates (same plotWidth × plotHeight × facing × bedrooms)
 *   - Score threshold: ≥ 85/100
 */

const fs   = require('fs');
const path = require('path');

const EXAMPLES_PATH = path.join(__dirname, 'examplePlans.js');
const MAX_EXAMPLES  = 15;
const MIN_SCORE     = 85;

/**
 * saveGoodPlan(input, geminiPlan, score)
 *
 * input:      { plotWidth, plotHeight, facing, bedrooms, bathrooms, style }
 * geminiPlan: the raw object Gemini returned (rooms[], planName, engineerThinking, ...)
 * score:      validator score 0-100
 */
async function saveGoodPlan(input, geminiPlan, score) {
  if (score < MIN_SCORE) return;
  if (!geminiPlan?.rooms?.length) return;

  // Load current examples
  let currentExamples;
  try {
    // Clear require cache so we always get the latest file
    delete require.cache[require.resolve('./examplePlans')];
    currentExamples = require('./examplePlans').EXAMPLE_PLANS;
  } catch {
    currentExamples = [];
  }

  // Skip duplicates — same plot dimensions + facing + bedrooms
  const isDuplicate = currentExamples.some(ex =>
    ex.input.plotWidth  === input.plotWidth  &&
    ex.input.plotHeight === input.plotHeight &&
    ex.input.facing     === input.facing     &&
    ex.input.bedrooms   === input.bedrooms
  );
  if (isDuplicate) {
    console.log(`  [exampleCollector] Skipped duplicate (${input.plotWidth}×${input.plotHeight} ${input.facing} ${input.bedrooms}BHK)`);
    return;
  }

  // Build the new example entry
  const newExample = {
    input: {
      plotWidth:  input.plotWidth,
      plotHeight: input.plotHeight,
      facing:     (input.facing || 'NORTH').toUpperCase(),
      bedrooms:   input.bedrooms,
      bathrooms:  input.bathrooms,
      style:      input.style || 'Modern Indian',
    },
    output: {
      planName:            geminiPlan.planName            || `${input.bedrooms}BHK Auto`,
      layoutType:          geminiPlan.layoutType          || 'linear',
      engineerThinking:    geminiPlan.engineerThinking    || '',
      vastuCompliant:      geminiPlan.vastuCompliant      ?? false,
      sunlightStrategy:    geminiPlan.sunlightStrategy    || '',
      ventilationStrategy: geminiPlan.ventilationStrategy || '',
      rooms:               geminiPlan.rooms,
      _score:   score,
      _savedAt: new Date().toISOString(),
      _notes: [
        `Auto-saved by exampleCollector — validator score ${score}/100`,
        `Plot: ${input.plotWidth}×${input.plotHeight}ft, ${input.facing}-facing, ${input.bedrooms}BHK`,
      ],
    },
  };

  // Cap at MAX_EXAMPLES — remove oldest if over limit
  const updated = [...currentExamples];
  if (updated.length >= MAX_EXAMPLES) {
    const removed = updated.shift();
    console.log(`  [exampleCollector] Removed oldest example (${removed?.input?.plotWidth}×${removed?.input?.plotHeight}) to stay within ${MAX_EXAMPLES} limit`);
  }
  updated.push(newExample);

  // Serialize back to examplePlans.js
  // We write the full module so it stays importable via require()
  const serialized = serializeExamples(updated);
  fs.writeFileSync(EXAMPLES_PATH, serialized, 'utf8');

  console.log(
    `  [exampleCollector] Saved new example (score ${score}/100). ` +
    `Library now has ${updated.length} examples. ` +
    `Plot: ${input.plotWidth}×${input.plotHeight}ft ${input.facing}-facing ${input.bedrooms}BHK`
  );
}

/**
 * Serialize an array of examples back to a valid CommonJS module string.
 */
function serializeExamples(examples) {
  return `'use strict';
/**
 * examplePlans.js — Few-shot learning library for Gemini.
 * Auto-managed by exampleCollector.js — do not edit manually.
 * Last updated: ${new Date().toISOString()}
 * Examples: ${examples.length}
 */

const EXAMPLE_PLANS = ${JSON.stringify(examples, null, 2)};

function buildFewShotSection() {
  return EXAMPLE_PLANS.map((ex, i) => {
    const cleanOutput = { ...ex.output };
    delete cleanOutput._notes;
    delete cleanOutput._score;
    delete cleanOutput._savedAt;

    return \`EXAMPLE \${i + 1}:
Input: \${JSON.stringify(ex.input, null, 2)}

Correct output:
\${JSON.stringify(cleanOutput, null, 2)}

Why this is correct:
\${(ex.output._notes || []).map(n => '  - ' + n).join('\\n')}\`;
  }).join('\\n\\n---\\n\\n');
}

module.exports = { EXAMPLE_PLANS, buildFewShotSection };
`;
}

module.exports = { saveGoodPlan };
