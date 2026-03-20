/**
 * FloorSheetManager.jsx — Multi-floor sheet management
 * Provides tab-based navigation between floor sheets.
 * Each sheet renders a ProfessionalFloorPlan for one floor.
 */

import React, { useState } from 'react';

const FLOOR_LABELS = {
  basement: 'Basement',
  ground: 'Ground Floor',
  first: 'First Floor',
  second: 'Second Floor',
  third: 'Third Floor',
  terrace: 'Terrace / Roof',
};

/**
 * @param {object} props
 * @param {Array} props.floors - array of { key, label, layoutJson }
 * @param {React.Component} props.SheetRenderer - component to render each floor (receives { layout, floorKey, floorLabel })
 * @param {string} props.scaleName - current scale
 * @param {object} props.layers - layer visibility state
 * @param {function} props.onScaleChange
 * @param {function} props.onExportAll - called when user wants to export all floors
 */
export default function FloorSheetManager({
  floors = [],
  SheetRenderer,
  scaleName = '1:100',
  layers = {},
  onScaleChange,
  onExportAll,
}) {
  const [activeIdx, setActiveIdx] = useState(0);

  if (!floors || floors.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        No floor data available.
      </div>
    );
  }

  const activeFloor = floors[activeIdx];

  return (
    <div className="flex flex-col h-full">
      {/* Sheet tabs */}
      <div className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 border-b border-gray-700 overflow-x-auto shrink-0">
        {floors.map((floor, i) => (
          <button
            key={floor.key || i}
            onClick={() => setActiveIdx(i)}
            className={`px-3 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
              i === activeIdx
                ? 'bg-violet-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {floor.label || FLOOR_LABELS[floor.key] || `Floor ${i + 1}`}
          </button>
        ))}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Scale selector */}
        {onScaleChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 text-xs">Scale:</span>
            {['1:50', '1:100', '1:200'].map(s => (
              <button
                key={s}
                onClick={() => onScaleChange(s)}
                className={`px-2 py-0.5 rounded text-xs transition-colors ${
                  s === scaleName
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Export All */}
        {onExportAll && (
          <button
            onClick={onExportAll}
            className="ml-2 px-3 py-1 bg-green-700 hover:bg-green-600 text-white rounded text-xs font-medium"
          >
            Export All Sheets
          </button>
        )}
      </div>

      {/* Active sheet renderer */}
      <div className="flex-1 min-h-0 overflow-auto bg-gray-100">
        {SheetRenderer && (
          <SheetRenderer
            layout={activeFloor.layoutJson || activeFloor.layout}
            floorKey={activeFloor.key}
            floorLabel={activeFloor.label || FLOOR_LABELS[activeFloor.key] || `Floor ${activeIdx + 1}`}
            scaleName={scaleName}
            layers={layers}
          />
        )}
      </div>

      {/* Sheet info bar */}
      <div className="shrink-0 px-3 py-1 bg-gray-800 border-t border-gray-700 text-xs text-gray-400 flex items-center gap-4">
        <span>Sheet: {activeIdx + 1} / {floors.length}</span>
        <span>{activeFloor.label || FLOOR_LABELS[activeFloor.key] || 'Floor Plan'}</span>
        <span>Scale: {scaleName}</span>
      </div>
    </div>
  );
}

/**
 * Helper: convert a single layoutJson (which may have multiple floors) into floors array
 * layoutJson structure: { rooms: [], floors: [...] } OR just { rooms: [] } (ground floor only)
 */
export function layoutToFloors(layoutJson) {
  if (!layoutJson) return [];

  // Multi-floor: layoutJson.floors is array
  if (layoutJson.floors && Array.isArray(layoutJson.floors)) {
    return layoutJson.floors.map((f, i) => ({
      key: f.key || ['basement', 'ground', 'first', 'second', 'third'][i] || `floor_${i}`,
      label: f.label || FLOOR_LABELS[f.key] || `Floor ${i + 1}`,
      layoutJson: f,
    }));
  }

  // Single floor
  return [{
    key: 'ground',
    label: 'Ground Floor',
    layoutJson,
  }];
}
