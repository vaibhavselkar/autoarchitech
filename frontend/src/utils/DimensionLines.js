/**
 * DimensionLines.js — Architectural dimension chains
 * Produces React SVG elements for linear and chain dimensions.
 * All coordinates in px (already scaled from real units).
 */

import React from 'react';
import { mmToFeetInches } from './units';

const TICK_H = 5;       // half-length of tick mark (px)
const TEXT_OFFSET = 4;  // gap between dim line and text (px)
const FONT_SIZE = 7;    // dimension text font size (px)

/**
 * LinearDimension — a single dimension line between two points
 *
 * @param {number} x1 - start x (px)
 * @param {number} y1 - start y (px)
 * @param {number} x2 - end x (px)
 * @param {number} y2 - end y (px)
 * @param {number} realMm - actual real-world measurement in mm
 * @param {'above'|'below'|'left'|'right'} textPos - where to put label
 * @param {string} color
 * @param {boolean} dualUnit - show both metric and imperial
 */
export function LinearDimension({
  x1, y1, x2, y2,
  realMm,
  offset = 18,
  textPos = 'above',
  color = '#555',
  dualUnit = true,
}) {
  const isH = Math.abs(y2 - y1) < Math.abs(x2 - x1);
  const label = dualUnit
    ? `${(realMm / 1000).toFixed(2)}m  (${mmToFeetInches(realMm)})`
    : `${(realMm / 1000).toFixed(2)}m`;

  if (isH) {
    // Horizontal dimension line
    const dy = textPos === 'above' ? -offset : offset;
    const dmY = y1 + dy;
    const midX = (x1 + x2) / 2;
    return (
      <g>
        {/* Extension lines */}
        <line x1={x1} y1={y1} x2={x1} y2={dmY} stroke={color} strokeWidth={0.6} strokeDasharray="2,1" />
        <line x1={x2} y1={y2} x2={x2} y2={dmY} stroke={color} strokeWidth={0.6} strokeDasharray="2,1" />
        {/* Dimension line */}
        <line x1={x1} y1={dmY} x2={x2} y2={dmY} stroke={color} strokeWidth={0.7} />
        {/* Ticks */}
        <line x1={x1} y1={dmY - TICK_H} x2={x1} y2={dmY + TICK_H} stroke={color} strokeWidth={0.8} />
        <line x1={x2} y1={dmY - TICK_H} x2={x2} y2={dmY + TICK_H} stroke={color} strokeWidth={0.8} />
        {/* Label */}
        <text
          x={midX} y={dmY - TEXT_OFFSET}
          fontSize={FONT_SIZE} fontFamily="Arial" fill={color} textAnchor="middle"
        >{label}</text>
      </g>
    );
  }

  // Vertical dimension line
  const dx = textPos === 'left' ? -offset : offset;
  const dmX = x1 + dx;
  const midY = (y1 + y2) / 2;
  return (
    <g>
      <line x1={x1} y1={y1} x2={dmX} y2={y1} stroke={color} strokeWidth={0.6} strokeDasharray="2,1" />
      <line x1={x2} y1={y2} x2={dmX} y2={y2} stroke={color} strokeWidth={0.6} strokeDasharray="2,1" />
      <line x1={dmX} y1={y1} x2={dmX} y2={y2} stroke={color} strokeWidth={0.7} />
      <line x1={dmX - TICK_H} y1={y1} x2={dmX + TICK_H} y2={y1} stroke={color} strokeWidth={0.8} />
      <line x1={dmX - TICK_H} y1={y2} x2={dmX + TICK_H} y2={y2} stroke={color} strokeWidth={0.8} />
      <text
        x={dmX + TEXT_OFFSET} y={midY + 3}
        fontSize={FONT_SIZE} fontFamily="Arial" fill={color}
        transform={`rotate(-90, ${dmX + TEXT_OFFSET}, ${midY + 3})`}
        textAnchor="middle"
      >{label}</text>
    </g>
  );
}

/**
 * ChainDimension — a sequence of linear dimensions along a baseline
 * Automatically stacks multiple dimensions without overlap.
 *
 * @param {Array} points - array of px positions along axis e.g. [0, 50, 120, 200]
 * @param {Array} realMms - array of mm values for each segment (length = points.length - 1)
 * @param {number} baseY - y position of the reference baseline (for H chain)
 * @param {number} offset - initial offset from baseline
 * @param {'h'|'v'} axis
 * @param {string} color
 */
export function ChainDimension({ points, realMms, baseY, baseX, offset = 18, axis = 'h', color = '#555', dualUnit = true }) {
  if (!points || points.length < 2) return null;

  const dims = [];

  for (let i = 0; i < points.length - 1; i++) {
    const mm = realMms ? realMms[i] : null;
    const label = mm
      ? (dualUnit ? `${(mm / 1000).toFixed(2)}m  (${mmToFeetInches(mm)})` : `${(mm / 1000).toFixed(2)}m`)
      : '';

    if (axis === 'h') {
      const x1 = points[i], x2 = points[i + 1];
      const dmY = baseY - offset;
      const midX = (x1 + x2) / 2;
      dims.push(
        <g key={i}>
          <line x1={x1} y1={baseY} x2={x1} y2={dmY} stroke={color} strokeWidth={0.6} strokeDasharray="2,1" />
          {i === points.length - 2 && (
            <line x1={x2} y1={baseY} x2={x2} y2={dmY} stroke={color} strokeWidth={0.6} strokeDasharray="2,1" />
          )}
          <line x1={x1} y1={dmY} x2={x2} y2={dmY} stroke={color} strokeWidth={0.7} />
          <line x1={x1} y1={dmY - TICK_H} x2={x1} y2={dmY + TICK_H} stroke={color} strokeWidth={0.8} />
          <line x1={x2} y1={dmY - TICK_H} x2={x2} y2={dmY + TICK_H} stroke={color} strokeWidth={0.8} />
          <text x={midX} y={dmY - TEXT_OFFSET} fontSize={FONT_SIZE} fontFamily="Arial" fill={color} textAnchor="middle">{label}</text>
        </g>
      );
    } else {
      const y1 = points[i], y2 = points[i + 1];
      const dmX = baseX - offset;
      const midY = (y1 + y2) / 2;
      dims.push(
        <g key={i}>
          <line x1={baseX} y1={y1} x2={dmX} y2={y1} stroke={color} strokeWidth={0.6} strokeDasharray="2,1" />
          {i === points.length - 2 && (
            <line x1={baseX} y1={y2} x2={dmX} y2={y2} stroke={color} strokeWidth={0.6} strokeDasharray="2,1" />
          )}
          <line x1={dmX} y1={y1} x2={dmX} y2={y2} stroke={color} strokeWidth={0.7} />
          <line x1={dmX - TICK_H} y1={y1} x2={dmX + TICK_H} y2={y1} stroke={color} strokeWidth={0.8} />
          <line x1={dmX - TICK_H} y1={y2} x2={dmX + TICK_H} y2={y2} stroke={color} strokeWidth={0.8} />
          <text
            x={dmX - TEXT_OFFSET} y={midY + 3}
            fontSize={FONT_SIZE} fontFamily="Arial" fill={color}
            transform={`rotate(-90, ${dmX - TEXT_OFFSET}, ${midY + 3})`}
            textAnchor="middle"
          >{label}</text>
        </g>
      );
    }
  }

  return <g>{dims}</g>;
}

/**
 * OverallDimension — a single dim line spanning the full extent of a chain
 * Typically placed further out than the chain dims.
 */
export function OverallDimension({ x1, y1, x2, y2, realMm, offset = 32, axis = 'h', color = '#333', dualUnit = true }) {
  return (
    <LinearDimension
      x1={x1} y1={y1} x2={x2} y2={y2}
      realMm={realMm}
      offset={offset}
      textPos={axis === 'h' ? 'above' : 'left'}
      color={color}
      dualUnit={dualUnit}
    />
  );
}
