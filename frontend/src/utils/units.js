/**
 * Unit Transform System for Architectural Drawings
 * Supports 1:50, 1:100, 1:200 scales
 * Base unit: mm (all internal calculations in mm)
 */

// Scale definitions: key = name, value = ratio (real mm per drawing mm)
export const SCALES = {
  '1:50':  { ratio: 50,  label: '1:50',  pxPerMm: 3.78 / 50  * 50  },  // ~3.78px per mm at 96dpi
  '1:100': { ratio: 100, label: '1:100', pxPerMm: 3.78 / 100 * 50  },
  '1:200': { ratio: 200, label: '1:200', pxPerMm: 3.78 / 200 * 50  },
};

// Screen: 96 dpi → 1 inch = 96px → 1mm = 96/25.4 ≈ 3.7795px
const PX_PER_MM_SCREEN = 96 / 25.4;

/**
 * Convert real-world mm to screen pixels at given scale
 * @param {number} mm - real-world millimetres
 * @param {string} scaleName - '1:50' | '1:100' | '1:200'
 * @returns {number} pixels
 */
export function mmToPx(mm, scaleName = '1:100') {
  const scale = SCALES[scaleName];
  if (!scale) throw new Error(`Unknown scale: ${scaleName}`);
  // drawing mm = real mm / ratio; screen px = drawing mm × PX_PER_MM_SCREEN
  return (mm / scale.ratio) * PX_PER_MM_SCREEN;
}

/**
 * Convert screen pixels to real-world mm at given scale
 * @param {number} px
 * @param {string} scaleName
 * @returns {number} real-world mm
 */
export function pxToMm(px, scaleName = '1:100') {
  const scale = SCALES[scaleName];
  if (!scale) throw new Error(`Unknown scale: ${scaleName}`);
  return (px / PX_PER_MM_SCREEN) * scale.ratio;
}

/**
 * Convert feet to millimetres
 * @param {number} feet
 * @returns {number} mm
 */
export function feetToMm(feet) {
  return feet * 304.8;
}

/**
 * Convert feet and decimal fraction to mm
 * @param {number} feetDecimal e.g. 10.5 = 10ft 6in
 */
export function feetDecimalToMm(feetDecimal) {
  return feetDecimal * 304.8;
}

/**
 * Convert mm to feet + inches string
 * @param {number} mm
 * @returns {string} e.g. "10'-6\""
 */
export function mmToFeetInches(mm) {
  const totalInches = mm / 25.4;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  if (inches === 0) return `${feet}'`;
  return `${feet}'-${inches}"`;
}

/**
 * Convert mm to a formatted string showing both metric and imperial
 * @param {number} mm
 * @returns {string} e.g. "3048mm (10'-0\")"
 */
export function mmDualLabel(mm) {
  return `${Math.round(mm)}mm (${mmToFeetInches(mm)})`;
}

/**
 * Convert feet to screen pixels at given scale
 * Convenience wrapper: feetToMm → mmToPx
 */
export function feetToPx(feet, scaleName = '1:100') {
  return mmToPx(feetToMm(feet), scaleName);
}

/**
 * Generate a scale bar SVG string
 * @param {string} scaleName - '1:50' | '1:100' | '1:200'
 * @param {object} opts
 * @param {number} opts.segments - number of major segments (default 5)
 * @param {number} opts.segmentMm - real-world mm per segment (default 1000 = 1m)
 * @param {number} opts.height - bar height in px (default 8)
 * @param {string} opts.color - bar color (default '#222')
 * @returns {string} SVG markup string
 */
export function scaleBarSVG(scaleName = '1:100', opts = {}) {
  const {
    segments = 5,
    segmentMm = 1000,
    height = 8,
    color = '#222',
  } = opts;

  const segPx = mmToPx(segmentMm, scaleName);
  const totalPx = segPx * segments;
  const svgW = totalPx + 4;
  const svgH = height + 20;
  const y = 10;

  let rects = '';
  let labels = '';

  for (let i = 0; i < segments; i++) {
    const x = 2 + i * segPx;
    const fill = i % 2 === 0 ? color : '#fff';
    const stroke = color;
    rects += `<rect x="${x.toFixed(1)}" y="${y}" width="${segPx.toFixed(1)}" height="${height}" fill="${fill}" stroke="${stroke}" stroke-width="0.5"/>`;
    labels += `<text x="${x.toFixed(1)}" y="${y + height + 9}" font-size="7" font-family="Arial" fill="${color}" text-anchor="middle">${(i * segmentMm / 1000).toFixed(0)}m</text>`;
  }
  // last label
  labels += `<text x="${(2 + totalPx).toFixed(1)}" y="${y + height + 9}" font-size="7" font-family="Arial" fill="${color}" text-anchor="middle">${(segments * segmentMm / 1000).toFixed(0)}m</text>`;

  const scaleLabel = `<text x="${(svgW / 2).toFixed(1)}" y="${y - 3}" font-size="7" font-family="Arial" fill="${color}" text-anchor="middle">SCALE ${scaleName}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW.toFixed(1)}" height="${svgH}">${scaleLabel}${rects}${labels}</svg>`;
}

/**
 * React component version of scale bar (returns JSX-compatible object for inline use)
 * Use scaleBarSVG() for string injection, or this for React SVG embedding.
 */
export function ScaleBar({ scaleName = '1:100', segments = 5, segmentMm = 1000, height = 8, color = '#222' }) {
  const segPx = mmToPx(segmentMm, scaleName);
  const totalPx = segPx * segments;
  const svgW = totalPx + 4;
  const svgH = height + 22;
  const y = 12;

  const rects = [];
  const labels = [];

  for (let i = 0; i <= segments; i++) {
    const x = 2 + i * segPx;
    if (i < segments) {
      rects.push(
        <rect
          key={i}
          x={x}
          y={y}
          width={segPx}
          height={height}
          fill={i % 2 === 0 ? color : '#fff'}
          stroke={color}
          strokeWidth={0.5}
        />
      );
    }
    labels.push(
      <text
        key={`l${i}`}
        x={x}
        y={y + height + 9}
        fontSize={7}
        fontFamily="Arial"
        fill={color}
        textAnchor="middle"
      >
        {(i * segmentMm / 1000).toFixed(0)}m
      </text>
    );
  }

  return (
    <svg width={svgW} height={svgH}>
      <text x={svgW / 2} y={y - 2} fontSize={7} fontFamily="Arial" fill={color} textAnchor="middle">
        SCALE {scaleName}
      </text>
      {rects}
      {labels}
    </svg>
  );
}
