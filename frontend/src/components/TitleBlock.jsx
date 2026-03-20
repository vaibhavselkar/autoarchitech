/**
 * TitleBlock.jsx — Professional architectural title block
 * Renders as SVG group positioned at bottom-right of drawing sheet.
 */

import React from 'react';

const TB_WIDTH = 180;
const TB_HEIGHT = 90;
const LINE = '#222';
const FONT = 'Arial';

/**
 * @param {object} props
 * @param {number} props.x - left x of title block (px)
 * @param {number} props.y - top y of title block (px)
 * @param {string} props.projectName
 * @param {string} props.drawingTitle  e.g. "FLOOR PLAN - GROUND FLOOR"
 * @param {string} props.drawingNumber e.g. "A-101"
 * @param {string} props.scale        e.g. "1:100"
 * @param {string} props.date
 * @param {string} props.revision     e.g. "Rev A"
 * @param {string} props.drawnBy
 * @param {string} props.checkedBy
 * @param {string} props.firmName
 * @param {string[]} props.notes      array of note strings
 */
export default function TitleBlock({
  x = 0, y = 0,
  projectName = 'AutoArchitect Project',
  drawingTitle = 'FLOOR PLAN',
  drawingNumber = 'A-101',
  scale = '1:100',
  date = new Date().toLocaleDateString(),
  revision = 'Rev A',
  drawnBy = 'AI Generated',
  checkedBy = '—',
  firmName = 'AutoArchitect',
  notes = [],
}) {
  const W = TB_WIDTH;
  const H = TB_HEIGHT;
  const row = H / 5;

  const cell = (cx, cy, w, h, label, value, labelSize = 5.5, valueSize = 7) => (
    <g key={`${cx}-${cy}`}>
      <rect x={cx} y={cy} width={w} height={h} fill="none" stroke={LINE} strokeWidth={0.5} />
      <text x={cx + 2} y={cy + labelSize + 1} fontSize={labelSize} fontFamily={FONT} fill="#666">{label}</text>
      <text x={cx + w / 2} y={cy + h * 0.7} fontSize={valueSize} fontFamily={FONT} fill={LINE} textAnchor="middle" fontWeight="bold">{value}</text>
    </g>
  );

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Outer border */}
      <rect x={0} y={0} width={W} height={H} fill="#fff" stroke={LINE} strokeWidth={1.2} />

      {/* Firm name header */}
      <rect x={0} y={0} width={W} height={row} fill="#1a1a2e" />
      <text x={W / 2} y={row * 0.68} fontSize={9} fontFamily={FONT} fill="#fff" textAnchor="middle" fontWeight="bold">{firmName}</text>

      {/* Project name row */}
      <rect x={0} y={row} width={W} height={row * 0.8} fill="none" stroke={LINE} strokeWidth={0.5} />
      <text x={4} y={row + 5} fontSize={5} fontFamily={FONT} fill="#666">PROJECT</text>
      <text x={W / 2} y={row + row * 0.62} fontSize={7.5} fontFamily={FONT} fill={LINE} textAnchor="middle" fontWeight="bold">{projectName}</text>

      {/* Drawing title row */}
      <rect x={0} y={row * 1.8} width={W * 0.65} height={row * 1.0} fill="none" stroke={LINE} strokeWidth={0.5} />
      <text x={4} y={row * 1.8 + 5} fontSize={5} fontFamily={FONT} fill="#666">DRAWING TITLE</text>
      <text x={W * 0.325} y={row * 1.8 + row * 0.7} fontSize={7} fontFamily={FONT} fill={LINE} textAnchor="middle" fontWeight="bold">{drawingTitle}</text>

      {/* Scale cell */}
      {cell(W * 0.65, row * 1.8, W * 0.35, row * 0.5, 'SCALE', scale)}
      {cell(W * 0.65, row * 1.8 + row * 0.5, W * 0.35, row * 0.5, 'DATE', date)}

      {/* Bottom metadata row */}
      {cell(0,        row * 2.8, W * 0.25, row * 0.8, 'DWG NO.', drawingNumber, 5, 7)}
      {cell(W * 0.25, row * 2.8, W * 0.25, row * 0.8, 'REVISION', revision, 5, 7)}
      {cell(W * 0.5,  row * 2.8, W * 0.25, row * 0.8, 'DRAWN BY', drawnBy, 5, 6)}
      {cell(W * 0.75, row * 2.8, W * 0.25, row * 0.8, 'CHECKED', checkedBy, 5, 7)}

      {/* Notes area */}
      {notes.length > 0 && (
        <g>
          <rect x={0} y={row * 3.6} width={W} height={H - row * 3.6} fill="none" stroke={LINE} strokeWidth={0.5} />
          <text x={3} y={row * 3.6 + 7} fontSize={5} fontFamily={FONT} fill="#666" fontWeight="bold">GENERAL NOTES:</text>
          {notes.slice(0, 4).map((note, i) => (
            <text key={i} x={3} y={row * 3.6 + 14 + i * 7} fontSize={5} fontFamily={FONT} fill={LINE}>
              {i + 1}. {note}
            </text>
          ))}
        </g>
      )}
    </g>
  );
}
