'use strict';

/**
 * Floor plan accuracy benchmark.
 *
 * Generates layouts across a matrix of common Indian residential plot sizes
 * and all four facings, then scores each one against planValidator (Indian
 * residential standards) and vastuService (Vastu Shastra compliance).
 *
 * Run: node scripts/benchmarkAccuracy.js
 * Optional: node scripts/benchmarkAccuracy.js --json report.json
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');

const { generateLayoutVariations } = require('../services/layoutGenerator');
const { validatePlan, PASS_SCORE } = require('../services/planValidator');
const vastuService = require('../services/vastuService');

// Common Indian plot sizes (width x length, in feet) spanning small city
// plots to larger independent-house plots.
const PLOT_SIZES = [
  { width: 20, length: 30 },
  { width: 25, length: 40 },
  { width: 30, length: 40 },
  { width: 30, length: 50 },
  { width: 40, length: 60 },
  { width: 50, length: 80 },
];

const FACINGS = ['north', 'south', 'east', 'west'];

const REQUIREMENTS = { bedrooms: 3, bathrooms: 2, study: 0, prayer_room: false, guest_room: 0, utility_room: 0 };
const VARIATIONS_PER_SITE = 2;

function avg(nums) {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

async function benchmarkSite(width, length, facing) {
  const plot = { width, length, facing, setback: { front: 6, back: 4, left: 4, right: 4 } };

  let layouts;
  try {
    layouts = await generateLayoutVariations(plot, REQUIREMENTS, {}, VARIATIONS_PER_SITE);
  } catch (err) {
    return { plot: `${width}x${length}`, facing, error: err.message, results: [] };
  }

  const results = layouts.map(layout => {
    const validation = layout.validation || validatePlan(layout);
    const vastu = vastuService.analyzeVastuCompliance(layout);
    return {
      score: validation.score,
      isValid: validation.isValid,
      coverage: validation.coverage,
      errorCount: validation.errors.length,
      warningCount: validation.warnings.length,
      errorTypes: validation.errors.map(e => e.type),
      vastuScore: vastu.overallScore,
      vastuViolations: vastu.violations.length,
    };
  });

  return { plot: `${width}x${length}`, facing, results };
}

async function main() {
  const rows = [];

  for (const size of PLOT_SIZES) {
    for (const facing of FACINGS) {
      process.stdout.write(`Generating ${size.width}x${size.length} ${facing}-facing... `);
      const row = await benchmarkSite(size.width, size.length, facing);
      rows.push(row);
      if (row.error) {
        console.log(`FAILED: ${row.error}`);
      } else {
        const scores = row.results.map(r => r.score);
        console.log(`avg score ${Math.round(avg(scores))}, avg vastu ${Math.round(avg(row.results.map(r => r.vastuScore)))}`);
      }
    }
  }

  const allResults = rows.flatMap(r => r.results || []);
  const scores = allResults.map(r => r.score);
  const vastuScores = allResults.map(r => r.vastuScore);
  const passRate = allResults.length ? (allResults.filter(r => r.isValid).length / allResults.length) * 100 : 0;

  const errorFrequency = {};
  allResults.forEach(r => r.errorTypes.forEach(t => { errorFrequency[t] = (errorFrequency[t] || 0) + 1; }));

  const byFacing = {};
  for (const facing of FACINGS) {
    const facingResults = rows.filter(r => r.facing === facing).flatMap(r => r.results || []);
    byFacing[facing] = {
      avgScore: Math.round(avg(facingResults.map(r => r.score))),
      avgVastuScore: Math.round(avg(facingResults.map(r => r.vastuScore))),
      passRate: facingResults.length ? Math.round((facingResults.filter(r => r.isValid).length / facingResults.length) * 100) : 0,
    };
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    sitesTotal: rows.length,
    plansTotal: allResults.length,
    passScoreThreshold: PASS_SCORE,
    overall: {
      avgScore: Math.round(avg(scores)),
      avgVastuScore: Math.round(avg(vastuScores)),
      passRate: Math.round(passRate),
    },
    byFacing,
    mostCommonErrors: Object.entries(errorFrequency).sort((a, b) => b[1] - a[1]),
    sites: rows,
  };

  console.log('\n=== SUMMARY ===');
  console.log(`Sites tested: ${summary.sitesTotal} (${PLOT_SIZES.length} sizes x ${FACINGS.length} facings)`);
  console.log(`Plans generated: ${summary.plansTotal}`);
  console.log(`Average validator score: ${summary.overall.avgScore}/100 (pass >= ${PASS_SCORE})`);
  console.log(`Average Vastu score: ${summary.overall.avgVastuScore}/100`);
  console.log(`Pass rate: ${summary.overall.passRate}%`);
  console.log('By facing:', JSON.stringify(summary.byFacing, null, 2));
  console.log('Most common validator errors:', summary.mostCommonErrors);

  const jsonFlagIndex = process.argv.indexOf('--json');
  if (jsonFlagIndex !== -1) {
    const outPath = path.resolve(process.argv[jsonFlagIndex + 1] || 'benchmark-report.json');
    fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
    console.log(`\nFull report written to ${outPath}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
