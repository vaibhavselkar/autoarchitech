'use strict';
/**
 * Sandbox test — tests the REAL layout generator end-to-end.
 * Run from project root:  node backend/sandbox_test.js
 * Run with AI enabled:    GEMINI_API_KEY=your_key node backend/sandbox_test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const { generateLayoutVariations } = require('./services/layoutGenerator');
const { validatePlan }             = require('./services/planValidator');

// ── Test cases ────────────────────────────────────────────────────────────────
const TESTS = [
  {
    label: '3BHK standard — 40×60 north-facing (good plot)',
    plot: { width: 40, length: 60, facing: 'north',
            setback: { front: 6, back: 4, left: 4, right: 4 } },
    requirements: { bedrooms: 3, bathrooms: 2, kitchen: true, dining: true },
    preferences:  {},
  },
  {
    label: '2BHK compact — 30×50 north-facing',
    plot: { width: 30, length: 50, facing: 'north',
            setback: { front: 5, back: 4, left: 3, right: 3 } },
    requirements: { bedrooms: 2, bathrooms: 2, kitchen: true, dining: true },
    preferences:  {},
  },
];

const VARIATIONS = 3;  // generate 3 plans per test (faster than 5)

// ── Helpers ───────────────────────────────────────────────────────────────────
function sep(ch = '─', n = 70) { return ch.repeat(n); }

function printRooms(rooms) {
  console.log('  ' + 'TYPE'.padEnd(20) + 'X'.padEnd(7) + 'Y'.padEnd(7) +
              'W'.padEnd(7) + 'H'.padEnd(7) + 'AREA');
  rooms.forEach(r => {
    const area = Math.round(r.width * r.height);
    console.log('  ' +
      r.type.padEnd(20) +
      String(r.x).padEnd(7) +
      String(r.y).padEnd(7) +
      String(r.width).padEnd(7) +
      String(r.height).padEnd(7) +
      area + ' sq.ft'
    );
  });
}

function printValidation(v) {
  const scoreBar = '█'.repeat(Math.round(v.score / 5)).padEnd(20, '░');
  console.log(`  Score: ${scoreBar} ${v.score}/100  |  Coverage: ${v.coverage}%  |  Valid: ${v.isValid}`);
  if (v.errors.length) {
    console.log('  ERRORS:');
    v.errors.forEach(e => console.log('    ✗ ' + e.message));
  }
  if (v.warnings.length) {
    console.log('  WARNINGS:');
    v.warnings.forEach(w => console.log('    ⚠ ' + w.message));
  }
  if (!v.errors.length && !v.warnings.length) {
    console.log('  ✓ No issues detected');
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const usingAI = !!process.env.GEMINI_API_KEY;
  console.log(sep('='));
  console.log('AUTOARCHITECT SANDBOX TEST');
  console.log(`AI mode: ${usingAI ? 'ON (GEMINI_API_KEY set)' : 'OFF — using rule-based fallback'}`);
  console.log(sep('='));

  let totalPlans = 0, totalPassed = 0;

  for (const tc of TESTS) {
    console.log('\n' + sep());
    console.log(`TEST: ${tc.label}`);
    const bW = tc.plot.width  - (tc.plot.setback.left + tc.plot.setback.right);
    const bL = tc.plot.length - (tc.plot.setback.front + tc.plot.setback.back);
    console.log(`Plot: ${tc.plot.width}×${tc.plot.length}ft  |  Buildable: ${bW}×${bL}ft (${bW*bL} sq.ft)`);
    console.log(sep());

    let layouts;
    try {
      layouts = await generateLayoutVariations(tc.plot, tc.requirements, tc.preferences, VARIATIONS);
    } catch (err) {
      console.error('  GENERATION FAILED:', err.message);
      continue;
    }

    layouts.forEach((layout, i) => {
      totalPlans++;
      const theme = layout.metadata?.designTheme || 'Unknown';
      const style = layout.metadata?.layoutStyle || 'unknown';
      const gen   = layout.metadata?.generatorType || 'fallback';
      console.log(`\n  Plan ${i + 1}: ${theme} (${style}) [${gen}]`);
      printRooms(layout.rooms || []);
      const v = validatePlan(layout);
      printValidation(v);
      if (v.isValid) totalPassed++;
    });
  }

  console.log('\n' + sep('='));
  console.log(`SUMMARY: ${totalPassed}/${totalPlans} plans passed validation`);
  if (totalPassed < totalPlans) {
    console.log('⚠  Some plans have issues — review ERRORS above.');
  } else {
    console.log('✓  All generated plans are valid!');
  }
  console.log(sep('='));
}

main().catch(err => {
  console.error('Sandbox crashed:', err);
  process.exit(1);
});
