import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';

const Home = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate plot data
      if (!plotData.width || !plotData.length) {
        toast.error('Please enter plot dimensions');
        return;
      }

      const payload = {
        plot: plotData,
        requirements,
        preferences,
        variations: 5
      };

      const response = await api.post('/plans/generate', payload);
      
      toast.success('Floor plans generated successfully!');
      navigate('/results', { 
        state: { plans: response.data.data.plans }
      });
      
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to generate plans');
    } finally {
      setLoading(false);
    }
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
    setPreferences(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
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

          {/* Submit */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-md text-lg font-medium transition-colors duration-200"
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Generating Plans...
                </div>
              ) : (
                'Generate Floor Plans'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Home;