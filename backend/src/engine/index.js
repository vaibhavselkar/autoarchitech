'use strict';
/**
 * engine/index.js — Wires all 4 stages together.
 *
 * Stage 1: Gemini decides layout (band/col/sizeWeight)
 * Stage 2: resolveLayout  → pixel rectangles
 * Stage 3: enforcePhysics → doors / windows / fixtures
 * Stage 4: renderSVG      → SVG string
 *
 * The core principle: GEMINI decides WHAT and WHERE.
 *                     RULES decide HOW it is drawn.
 */

const { callGemini }      = require('../ai/geminiPrompt');
const { resolveLayout }   = require('./layoutResolver');
const { enforcePhysics }  = require('./physicsEnforcer');
const { renderSVG }       = require('./svgRenderer');
const { TYPE_TO_FRONTEND } = require('../knowledge/physicalRules');

const SCALE = 10; // px per foot

// ─── Fallback plans (when Gemini is unavailable) ──────────────────────────────

/**
 * buildFallbackPlan(style, W, H, req)
 * Returns a Gemini-shaped plan object for one of 3 styles.
 * Used when Gemini API is down or returns bad JSON.
 */
function buildFallbackPlan(style, W, H, req) {
  const beds = req.bedrooms || 3;

  // --- STYLE 1: Classic Linear ---
  if (style === 'linear') {
    const rooms = [
      { id: 'park',    label: 'Parking',      type: 'parking',        band: 1, col: 1, colSpan: 1, sizeWeight: 2, windowWall: 'none',  doorWall: 'north',  platformWall: 'none' },
      { id: 'entry',   label: 'Entry',         type: 'entry',          band: 1, col: 2, colSpan: 1, sizeWeight: 1, windowWall: 'none',  doorWall: 'north',  platformWall: 'none' },
      { id: 'balcony', label: 'Balcony',       type: 'balcony',        band: 1, col: 3, colSpan: 1, sizeWeight: 2, windowWall: 'north', doorWall: 'south',  platformWall: 'none' },
      { id: 'liv',     label: 'Living Room',   type: 'living',         band: 2, col: 1, colSpan: 3, sizeWeight: 5, windowWall: 'west',  doorWall: 'east',   platformWall: 'none' },
      { id: 'din',     label: 'Dining',        type: 'dining',         band: 2, col: 2, colSpan: 1, sizeWeight: 3, windowWall: 'east',  doorWall: 'west',   platformWall: 'none' },
      { id: 'kit',     label: 'Kitchen',       type: 'kitchen',        band: 2, col: 3, colSpan: 1, sizeWeight: 3, windowWall: 'east',  doorWall: 'west',   platformWall: 'east' },
      { id: 'mbed',    label: 'Master Bedroom',type: 'master_bedroom', band: 3, col: 1, colSpan: 2, sizeWeight: 4, windowWall: 'west',  doorWall: 'east',   platformWall: 'none' },
      { id: 'bath1',   label: 'Bathroom',      type: 'bathroom',       band: 3, col: 3, colSpan: 1, sizeWeight: 1, windowWall: 'none',  doorWall: 'west',   platformWall: 'none' },
    ];

    // Add extra bedrooms
    for (let i = 2; i <= beds; i++) {
      rooms.push({
        id: `bed${i}`, label: `Bedroom ${i}`, type: 'bedroom',
        band: 3, col: (i % 3) + 1, colSpan: 1, sizeWeight: 4,
        windowWall: 'west', doorWall: 'east', platformWall: 'none',
      });
    }

    return {
      planName: `Classic Linear ${beds}BHK`,
      layoutType: 'linear',
      engineerThinking: 'Full-width living zone with kitchen and dining side-by-side. All bedrooms in private rear zone with direct bathroom access.',
      vastuCompliant: false,
      sunlightStrategy: 'East-facing kitchen maximizes morning light. North windows for bedrooms.',
      ventilationStrategy: 'Cross ventilation through east-west window alignment.',
      rooms,
    };
  }

  // --- STYLE 2: Private Wing ---
  if (style === 'private-wing') {
    const rooms = [
      { id: 'park',    label: 'Parking',       type: 'parking',        band: 1, col: 1, colSpan: 1, sizeWeight: 2, windowWall: 'none',  doorWall: 'north', platformWall: 'none' },
      { id: 'entry',   label: 'Entry',          type: 'entry',          band: 1, col: 2, colSpan: 1, sizeWeight: 1, windowWall: 'none',  doorWall: 'north', platformWall: 'none' },
      { id: 'balcony', label: 'Balcony',        type: 'balcony',        band: 1, col: 3, colSpan: 1, sizeWeight: 2, windowWall: 'north', doorWall: 'south', platformWall: 'none' },
      { id: 'mbed',    label: 'Master Bedroom', type: 'master_bedroom', band: 2, col: 1, colSpan: 1, sizeWeight: 4, windowWall: 'west',  doorWall: 'east',  platformWall: 'none' },
      { id: 'bath1',   label: 'Bathroom',       type: 'bathroom',       band: 2, col: 1, colSpan: 1, sizeWeight: 1, windowWall: 'none',  doorWall: 'east',  platformWall: 'none' },
      { id: 'liv',     label: 'Living Room',    type: 'living',         band: 2, col: 2, colSpan: 2, sizeWeight: 5, windowWall: 'east',  doorWall: 'west',  platformWall: 'none' },
      { id: 'din',     label: 'Dining',         type: 'dining',         band: 3, col: 2, colSpan: 1, sizeWeight: 3, windowWall: 'east',  doorWall: 'west',  platformWall: 'none' },
      { id: 'kit',     label: 'Kitchen',        type: 'kitchen',        band: 3, col: 3, colSpan: 1, sizeWeight: 3, windowWall: 'east',  doorWall: 'west',  platformWall: 'east' },
    ];

    for (let i = 2; i <= beds; i++) {
      rooms.push({
        id: `bed${i}`, label: `Bedroom ${i}`, type: 'bedroom',
        band: 3, col: 1, colSpan: 1, sizeWeight: 4,
        windowWall: 'west', doorWall: 'east', platformWall: 'none',
      });
    }

    return {
      planName: `Private Wing ${beds}BHK`,
      layoutType: 'split',
      engineerThinking: 'Bedrooms clustered in a dedicated private wing on the left. Public zone on the right for maximum privacy separation.',
      vastuCompliant: false,
      sunlightStrategy: 'West windows in bedroom wing. East orientation for kitchen and dining.',
      ventilationStrategy: 'Bedrooms face west for evening breeze. Kitchen opens east for morning light.',
      rooms,
    };
  }

  // --- STYLE 3: Service Front ---
  {
    const rooms = [
      { id: 'park',    label: 'Parking',       type: 'parking',        band: 1, col: 1, colSpan: 1, sizeWeight: 2, windowWall: 'none',  doorWall: 'north', platformWall: 'none' },
      { id: 'din',     label: 'Dining',         type: 'dining',         band: 1, col: 2, colSpan: 1, sizeWeight: 3, windowWall: 'north', doorWall: 'south', platformWall: 'none' },
      { id: 'kit',     label: 'Kitchen',        type: 'kitchen',        band: 1, col: 3, colSpan: 1, sizeWeight: 3, windowWall: 'north', doorWall: 'south', platformWall: 'north' },
      { id: 'liv',     label: 'Living Room',    type: 'living',         band: 2, col: 1, colSpan: 3, sizeWeight: 5, windowWall: 'east',  doorWall: 'north', platformWall: 'none' },
      { id: 'mbed',    label: 'Master Bedroom', type: 'master_bedroom', band: 3, col: 2, colSpan: 2, sizeWeight: 4, windowWall: 'east',  doorWall: 'west',  platformWall: 'none' },
      { id: 'bath1',   label: 'Bathroom',       type: 'bathroom',       band: 3, col: 1, colSpan: 1, sizeWeight: 1, windowWall: 'none',  doorWall: 'east',  platformWall: 'none' },
    ];

    for (let i = 2; i <= beds; i++) {
      rooms.push({
        id: `bed${i}`, label: `Bedroom ${i}`, type: 'bedroom',
        band: 3, col: ((i - 1) % 3) + 1, colSpan: 1, sizeWeight: 4,
        windowWall: 'west', doorWall: 'east', platformWall: 'none',
      });
    }

    return {
      planName: `Service-Front ${beds}BHK`,
      layoutType: 'compact',
      engineerThinking: 'Kitchen and dining at the front frees the rear for a garden-facing living area. Service noise stays near the road.',
      vastuCompliant: false,
      sunlightStrategy: 'South-facing rear living room gets afternoon sun. Kitchen faces north for cool working conditions.',
      ventilationStrategy: 'Living opens to rear garden for natural draft. Kitchen vents to road side.',
      rooms,
    };
  }
}

// ─── Type normalizer ─────────────────────────────────────────────────────────

/**
 * Normalize Gemini type names to frontend type names.
 * e.g. 'living' → 'living_room'
 */
function normalizeTypes(rooms) {
  return rooms.map(r => ({
    ...r,
    type: TYPE_TO_FRONTEND[r.type] || r.type,
  }));
}

// ─── Main entry ───────────────────────────────────────────────────────────────

/**
 * generatePlan(userParams, style)
 *
 * userParams: { plotWidth, plotHeight, facing, bedrooms, bathrooms,
 *               style, priorities, setbacks, city }
 * style: 'linear' | 'private-wing' | 'service-front'
 *
 * Returns layoutJson-compatible object with added `svg` field.
 */
async function generatePlan(userParams, style = 'linear') {
  const {
    plotWidth,
    plotHeight,
    setbacks = { front: 3, rear: 3, left: 2, right: 2 },
  } = userParams;

  const buildableW = plotWidth  - (setbacks.left  || 2) - (setbacks.right || 2);
  const buildableH = plotHeight - (setbacks.front || 3) - (setbacks.rear  || 3);

  // --- Stage 1: Get AI layout decisions ---
  let geminiPlan;
  try {
    geminiPlan = await callGemini({ ...userParams, style });
  } catch (err) {
    console.warn(`[engine] Gemini call failed (${err.message}), using fallback for style=${style}`);
    geminiPlan = buildFallbackPlan(style, buildableW, buildableH, userParams);
  }

  // Validate gemini returned rooms
  if (!geminiPlan?.rooms?.length) {
    console.warn('[engine] Gemini returned no rooms, using fallback');
    geminiPlan = buildFallbackPlan(style, buildableW, buildableH, userParams);
  }

  // --- Stage 2: Resolve pixel coordinates ---
  let rooms;
  try {
    rooms = resolveLayout(geminiPlan, buildableW, buildableH);
  } catch (err) {
    console.error('[engine] resolveLayout failed:', err.message);
    throw err;
  }

  // Normalize type names for frontend compatibility
  rooms = normalizeTypes(rooms);

  // --- Stage 3: Enforce physical rules ---
  rooms = enforcePhysics(rooms);

  // --- Stage 4: Render SVG ---
  const svg = renderSVG(rooms, {
    buildableW,
    buildableH,
    planName:         geminiPlan.planName,
    layoutType:       geminiPlan.layoutType,
    engineerThinking: geminiPlan.engineerThinking,
    facing:           userParams.facing,
  });

  // --- Return layoutJson-compatible object ---
  return {
    // Core plan metadata
    planName:            geminiPlan.planName,
    layoutType:          geminiPlan.layoutType,
    engineerThinking:    geminiPlan.engineerThinking,
    vastuCompliant:      geminiPlan.vastuCompliant,
    sunlightStrategy:    geminiPlan.sunlightStrategy,
    ventilationStrategy: geminiPlan.ventilationStrategy,

    // Plot dimensions
    plot: {
      width:  plotWidth,
      height: plotHeight,
      buildableW,
      buildableH,
      facing: userParams.facing,
    },

    // Rooms with full coordinates and physics annotations
    rooms,

    // Backend-rendered SVG (ready to display directly)
    svg,

    // Metadata for debugging / UI
    metadata: {
      generator:   'gemini-engine-v2',
      style,
      designTheme: geminiPlan.planName,
      scale:       SCALE,
    },
  };
}

module.exports = { generatePlan, buildFallbackPlan };
