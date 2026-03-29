import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const Home = () => {
  const navigate = useNavigate();

  const [plotData, setPlotData] = useState({
    width: '',
    length: '',
    facing: 'north',
    setback: {
      front: 6,
      back: 4,
      left: 4,
      right: 4
    }
  });

  const [requirements, setRequirements] = useState({
    bedrooms: 2,
    master_bedroom: true,
    kitchen: 1,
    dining: 1,
    living_room: 1,
    bathrooms: 2,
    study: 0,
    balcony: true,
    terrace: false
  });

  const [preferences, setPreferences] = useState({
    parking: {
      enabled: true,
      cars: 1,
      type: 'open'
    },
    vastu: false,
    balcony: true,
    garden: false
  });

  const [customIdea, setCustomIdea]     = useState('');
  const [showSetbacks, setShowSetbacks] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!plotData.width || !plotData.length) {
      toast.error('Please enter plot dimensions');
      return;
    }

    const payload = {
      plot: plotData,
      requirements,
      preferences: { ...preferences, customIdea: customIdea.trim() || undefined },
    };

    // Persist params so Results page survives a refresh
    sessionStorage.setItem('lastGenerationParams', JSON.stringify(payload));

    // Navigate immediately — PlanResults handles streaming
    navigate('/results', { state: { generationParams: payload } });
  };

  const updatePlotData = (field, value) => {
    setPlotData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updateRequirements = (field, value) => {
    setRequirements(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updatePreferences = (field, value) => {
    setPreferences(prev => ({ ...prev, [field]: value }));
  };

  const updateSetback = (side, value) => {
    setPlotData(prev => ({
      ...prev,
      setback: { ...prev.setback, [side]: parseFloat(value) || 0 }
    }));
  };

  return (
    <>
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow-md rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">AutoArchitect Floor Plan Generator</h1>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Plot Information */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Plot Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Plot Width (feet)</label>
                <input
                  type="number"
                  value={plotData.width}
                  onChange={(e) => updatePlotData('width', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g., 40"
                  min="10"
                  max="200"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Plot Length (feet)</label>
                <input
                  type="number"
                  value={plotData.length}
                  onChange={(e) => updatePlotData('length', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g., 60"
                  min="10"
                  max="300"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Facing Direction</label>
                <select
                  value={plotData.facing}
                  onChange={(e) => updatePlotData('facing', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="north">North</option>
                  <option value="south">South</option>
                  <option value="east">East</option>
                  <option value="west">West</option>
                </select>
              </div>
            </div>

            {/* Setback toggle */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setShowSetbacks(v => !v)}
                className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                <span style={{
                  display: 'inline-block', width: 16, height: 16, lineHeight: '16px',
                  textAlign: 'center', borderRadius: '50%',
                  background: showSetbacks ? '#4f46e5' : '#e0e7ff', color: showSetbacks ? '#fff' : '#4f46e5',
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                }}>{showSetbacks ? '−' : '+'}</span>
                {showSetbacks ? 'Hide' : 'Customise'} Setbacks
                <span className="text-xs font-normal text-gray-400">(optional — defaults used if skipped)</span>
              </button>

              {showSetbacks && (
                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { side: 'back',  label: 'Front Setback', hint: 'road side' },
                    { side: 'front', label: 'Rear Setback',  hint: 'garden side' },
                    { side: 'left',  label: 'Left Setback',  hint: '' },
                    { side: 'right', label: 'Right Setback', hint: '' },
                  ].map(({ side, label, hint }) => (
                    <div key={side}>
                      <label className="block text-xs font-medium text-gray-600">
                        {label}
                        {hint && <span className="text-gray-400 font-normal ml-1">({hint})</span>}
                      </label>
                      <div className="mt-1 flex items-center gap-1">
                        <input
                          type="number"
                          value={plotData.setback[side]}
                          onChange={e => updateSetback(side, e.target.value)}
                          className="block w-full border-gray-300 rounded-md shadow-sm text-sm focus:ring-indigo-500 focus:border-indigo-500"
                          min="0"
                          max="30"
                          step="0.5"
                        />
                        <span className="text-xs text-gray-400 whitespace-nowrap">ft</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Room Requirements */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Room Requirements</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Bedrooms</label>
                <input
                  type="number"
                  value={requirements.bedrooms}
                  onChange={(e) => updateRequirements('bedrooms', parseInt(e.target.value))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  min="0"
                  max="10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Master Bedroom</label>
                <select
                  value={requirements.master_bedroom}
                  onChange={(e) => updateRequirements('master_bedroom', e.target.value === 'true')}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value={true}>Yes</option>
                  <option value={false}>No</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Kitchens</label>
                <input
                  type="number"
                  value={requirements.kitchen}
                  onChange={(e) => updateRequirements('kitchen', parseInt(e.target.value))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  min="0"
                  max="5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Dining Rooms</label>
                <input
                  type="number"
                  value={requirements.dining}
                  onChange={(e) => updateRequirements('dining', parseInt(e.target.value))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  min="0"
                  max="5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Living Rooms</label>
                <input
                  type="number"
                  value={requirements.living_room}
                  onChange={(e) => updateRequirements('living_room', parseInt(e.target.value))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  min="0"
                  max="5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Bathrooms</label>
                <input
                  type="number"
                  value={requirements.bathrooms}
                  onChange={(e) => updateRequirements('bathrooms', parseInt(e.target.value))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  min="0"
                  max="10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Study Rooms</label>
                <input
                  type="number"
                  value={requirements.study}
                  onChange={(e) => updateRequirements('study', parseInt(e.target.value))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  min="0"
                  max="5"
                />
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Preferences</h2>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferences.balcony}
                    onChange={(e) => updatePreferences('balcony', e.target.checked)}
                    className="mr-2"
                  />
                  Include Balcony
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferences.vastu}
                    onChange={(e) => updatePreferences('vastu', e.target.checked)}
                    className="mr-2"
                  />
                  Vastu Compliant
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferences.garden}
                    onChange={(e) => updatePreferences('garden', e.target.checked)}
                    className="mr-2"
                  />
                  Include Garden
                </label>
              </div>

              {/* Parking */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Parking</label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={preferences.parking.enabled}
                      onChange={(e) => updatePreferences('parking', {
                        ...preferences.parking,
                        enabled: e.target.checked
                      })}
                      className="mr-2"
                    />
                    Include Parking
                  </label>
                  {preferences.parking.enabled && (
                    <>
                      <select
                        value={preferences.parking.type}
                        onChange={(e) => updatePreferences('parking', {
                          ...preferences.parking,
                          type: e.target.value
                        })}
                        className="border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="open">Open</option>
                        <option value="covered">Covered</option>
                        <option value="basement">Basement</option>
                      </select>
                      <input
                        type="number"
                        value={preferences.parking.cars}
                        onChange={(e) => updatePreferences('parking', {
                          ...preferences.parking,
                          cars: parseInt(e.target.value)
                        })}
                        className="w-20 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        min="1"
                        max="5"
                        placeholder="Cars"
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Your Vision */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-lg p-6">
            <div className="flex items-start gap-3 mb-3">
              <div style={{
                width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18,
              }}>✨</div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Your Vision</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Describe any specific ideas, special requirements or layout preferences. The AI will incorporate them.
                </p>
              </div>
            </div>
            <textarea
              value={customIdea}
              onChange={e => setCustomIdea(e.target.value)}
              rows={4}
              maxLength={600}
              placeholder={
                'e.g. "I want an open kitchen that connects directly to the living room with a large island. ' +
                'Master bedroom should have a walk-in wardrobe and attached bathroom. ' +
                'I prefer a Vastu-friendly layout with the prayer room in the north-east corner."'
              }
              className="w-full mt-1 border border-indigo-200 rounded-lg shadow-sm text-sm text-gray-800 placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              style={{ padding: '10px 12px', background: '#fff', lineHeight: 1.6 }}
            />
            <div className="flex justify-between items-center mt-1.5">
              <span className="text-xs text-gray-400 italic">Optional — leave blank to let AI decide freely</span>
              <span className={`text-xs ${customIdea.length > 550 ? 'text-orange-500' : 'text-gray-400'}`}>
                {customIdea.length}/600
              </span>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md text-lg font-medium transition-colors duration-200"
            >
              Generate Floor Plans
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
};

export default Home;