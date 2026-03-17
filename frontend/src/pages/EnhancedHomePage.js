import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Stage, Layer, Rect, Text, Group } from 'react-konva';
import api from '../services/api';

const EnhancedHomePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [previewLayout, setPreviewLayout] = useState(null);
  const [step, setStep] = useState(1);

  // Form data with default values
  const [formData, setFormData] = useState({
    // Plot Information
    plot: {
      width: 40,
      length: 60,
      facing: 'north',
      setback: {
        front: 6,
        back: 4,
        left: 4,
        right: 4
      }
    },
    // Room Requirements
    requirements: {
      bedrooms: 3,
      master_bedroom: true,
      kitchen: 1,
      dining: 1,
      living_room: 1,
      bathrooms: 2,
      study: 1,
      balcony: true,
      terrace: false
    },
    // User Preferences
    preferences: {
      style: 'modern',
      parking: {
        enabled: true,
        cars: 2,
        type: 'covered'
      },
      budget: 'medium',
      special_features: []
    }
  });

  // Handle form changes
  const handlePlotChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      plot: {
        ...prev.plot,
        [field]: value
      }
    }));
  };

  const handleRequirementChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      requirements: {
        ...prev.requirements,
        [field]: value
      }
    }));
  };

  const handlePreferenceChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [field]: value
      }
    }));
  };

  // Generate preview layout
  const generatePreview = async () => {
    try {
      setLoading(true);
      const response = await api.post('/plans/generate', {
        ...formData,
        variations: 1
      });

      if (response.data.success && response.data.data.plans.length > 0) {
        setPreviewLayout(response.data.data.plans[0].layoutJson);
      }
    } catch (error) {
      console.error('Preview generation failed:', error);
      toast.error('Failed to generate preview');
    } finally {
      setLoading(false);
    }
  };

  // Debounced preview generation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (step === 3) {
        generatePreview();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [formData, step]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const response = await api.post('/plans/generate', {
        ...formData,
        variations: 5
      });

      if (response.data.success) {
        toast.success('Floor plans generated successfully!');
        navigate('/results', { 
          state: { 
            plans: response.data.data.plans,
            generationMethod: response.data.data.generationMethod 
          } 
        });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to generate plans');
    } finally {
      setLoading(false);
    }
  };

  const renderPreviewCanvas = () => {
    if (!previewLayout) return null;

    const scale = Math.min(400 / (previewLayout.plot.width + 10), 300 / (previewLayout.plot.length + 10));
    const offsetX = 20;
    const offsetY = 20;

    return (
      <Stage width={500} height={400}>
        <Layer>
          {/* Plot boundary */}
          <Rect
            x={offsetX}
            y={offsetY}
            width={previewLayout.plot.width * scale}
            height={previewLayout.plot.length * scale}
            stroke="#333"
            strokeWidth={3}
            fill="none"
            dash={[5, 5]}
          />
          
          {/* Plot dimensions label */}
          <Text
            x={offsetX + (previewLayout.plot.width * scale / 2) - 40}
            y={offsetY - 20}
            text={`${previewLayout.plot.width}' x ${previewLayout.plot.length}'`}
            fontSize={14}
            fill="#666"
            fontStyle="bold"
          />

          {/* Rooms */}
          {previewLayout.rooms.map((room, index) => (
            <Group key={index}>
              <Rect
                x={offsetX + (room.x * scale)}
                y={offsetY + (room.y * scale)}
                width={room.width * scale}
                height={room.height * scale}
                fill="#e3f2fd"
                stroke="#1976d2"
                strokeWidth={2}
                cornerRadius={4}
              />
              <Text
                x={offsetX + (room.x * scale) + 5}
                y={offsetY + (room.y * scale) + 5}
                text={room.label}
                fontSize={10 * scale}
                fill="#1976d2"
                fontStyle="bold"
              />
              <Text
                x={offsetX + (room.x * scale) + 5}
                y={offsetY + (room.y * scale) + 20}
                text={`${room.width}' x ${room.height}'`}
                fontSize={8 * scale}
                fill="#666"
              />
            </Group>
          ))}

          {/* Walls */}
          {previewLayout.walls.map((wall, index) => (
            <Rect
              key={index}
              x={offsetX + (wall.x1 * scale)}
              y={offsetY + (wall.y1 * scale)}
              width={Math.abs(wall.x2 - wall.x1) * scale}
              height={Math.abs(wall.y2 - wall.y1) * scale}
              fill="#333"
            />
          ))}
        </Layer>
      </Stage>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">AutoArchitect AI</h1>
          <p className="text-lg text-gray-600">Design your dream home with intelligent floor plan generation</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Configuration Panel */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-lg p-6">
            {/* Progress Steps */}
            <div className="flex items-center justify-center mb-8">
              <div className="flex items-center space-x-4">
                {[1, 2, 3].map((stepNum) => (
                  <div key={stepNum} className="flex items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                      step === stepNum 
                        ? 'bg-blue-500 text-white' 
                        : step > stepNum 
                          ? 'bg-green-500 text-white' 
                          : 'bg-gray-300 text-gray-600'
                    }`}>
                      {step > stepNum ? '✓' : stepNum}
                    </div>
                    {stepNum < 3 && (
                      <div className={`w-16 h-1 ${step > stepNum ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Step 1: Plot Information */}
            {step === 1 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Step 1: Plot Information</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Plot Width (feet)</label>
                    <input
                      type="number"
                      value={formData.plot.width}
                      onChange={(e) => handlePlotChange('width', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Plot Length (feet)</label>
                    <input
                      type="number"
                      value={formData.plot.length}
                      onChange={(e) => handlePlotChange('length', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Facing Direction</label>
                    <select
                      value={formData.plot.facing}
                      onChange={(e) => handlePlotChange('facing', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="north">North</option>
                      <option value="south">South</option>
                      <option value="east">East</option>
                      <option value="west">West</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Budget Level</label>
                    <select
                      value={formData.preferences.budget}
                      onChange={(e) => handlePreferenceChange('budget', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Front Setback</label>
                    <input
                      type="number"
                      value={formData.plot.setback.front}
                      onChange={(e) => handlePlotChange('setback', { ...formData.plot.setback, front: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Back Setback</label>
                    <input
                      type="number"
                      value={formData.plot.setback.back}
                      onChange={(e) => handlePlotChange('setback', { ...formData.plot.setback, back: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Left Setback</label>
                    <input
                      type="number"
                      value={formData.plot.setback.left}
                      onChange={(e) => handlePlotChange('setback', { ...formData.plot.setback, left: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Right Setback</label>
                    <input
                      type="number"
                      value={formData.plot.setback.right}
                      onChange={(e) => handlePlotChange('setback', { ...formData.plot.setback, right: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => navigate('/')}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setStep(2)}
                    className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                  >
                    Next: Rooms
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Room Requirements */}
            {step === 2 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Step 2: Room Requirements</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-medium text-gray-900">Basic Rooms</h3>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-sm text-gray-700">Bedrooms</label>
                        <input
                          type="number"
                          value={formData.requirements.bedrooms}
                          onChange={(e) => handleRequirementChange('bedrooms', parseInt(e.target.value))}
                          className="w-20 px-2 py-1 border border-gray-300 rounded"
                        />
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <label className="text-sm text-gray-700">Master Bedroom</label>
                        <input
                          type="checkbox"
                          checked={formData.requirements.master_bedroom}
                          onChange={(e) => handleRequirementChange('master_bedroom', e.target.checked)}
                          className="w-4 h-4"
                        />
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <label className="text-sm text-gray-700">Kitchens</label>
                        <input
                          type="number"
                          value={formData.requirements.kitchen}
                          onChange={(e) => handleRequirementChange('kitchen', parseInt(e.target.value))}
                          className="w-20 px-2 py-1 border border-gray-300 rounded"
                        />
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <label className="text-sm text-gray-700">Dining</label>
                        <input
                          type="number"
                          value={formData.requirements.dining}
                          onChange={(e) => handleRequirementChange('dining', parseInt(e.target.value))}
                          className="w-20 px-2 py-1 border border-gray-300 rounded"
                        />
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <label className="text-sm text-gray-700">Living Room</label>
                        <input
                          type="number"
                          value={formData.requirements.living_room}
                          onChange={(e) => handleRequirementChange('living_room', parseInt(e.target.value))}
                          className="w-20 px-2 py-1 border border-gray-300 rounded"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-medium text-gray-900">Additional Rooms</h3>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-sm text-gray-700">Bathrooms</label>
                        <input
                          type="number"
                          value={formData.requirements.bathrooms}
                          onChange={(e) => handleRequirementChange('bathrooms', parseInt(e.target.value))}
                          className="w-20 px-2 py-1 border border-gray-300 rounded"
                        />
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <label className="text-sm text-gray-700">Study</label>
                        <input
                          type="number"
                          value={formData.requirements.study}
                          onChange={(e) => handleRequirementChange('study', parseInt(e.target.value))}
                          className="w-20 px-2 py-1 border border-gray-300 rounded"
                        />
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <label className="text-sm text-gray-700">Balcony</label>
                        <input
                          type="checkbox"
                          checked={formData.requirements.balcony}
                          onChange={(e) => handleRequirementChange('balcony', e.target.checked)}
                          className="w-4 h-4"
                        />
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <label className="text-sm text-gray-700">Terrace</label>
                        <input
                          type="checkbox"
                          checked={formData.requirements.terrace}
                          onChange={(e) => handleRequirementChange('terrace', e.target.checked)}
                          className="w-4 h-4"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setStep(1)}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                  >
                    Next: Preferences
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Preferences */}
            {step === 3 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Step 3: Design Preferences</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Architectural Style</label>
                    <select
                      value={formData.preferences.style}
                      onChange={(e) => handlePreferenceChange('style', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="modern">Modern Minimalist</option>
                      <option value="traditional">Traditional</option>
                      <option value="contemporary">Contemporary</option>
                      <option value="industrial">Industrial</option>
                      <option value="scandinavian">Scandinavian</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Parking</label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.preferences.parking.enabled}
                          onChange={(e) => handlePreferenceChange('parking', { 
                            ...formData.preferences.parking, 
                            enabled: e.target.checked 
                          })}
                          className="mr-2"
                        />
                        Include Parking
                      </label>
                      
                      {formData.preferences.parking.enabled && (
                        <div className="ml-4 space-y-2">
                          <div>
                            <label className="text-xs text-gray-600">Number of Cars</label>
                            <input
                              type="number"
                              value={formData.preferences.parking.cars}
                              onChange={(e) => handlePreferenceChange('parking', { 
                                ...formData.preferences.parking, 
                                cars: parseInt(e.target.value) 
                              })}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-600">Type</label>
                            <select
                              value={formData.preferences.parking.type}
                              onChange={(e) => handlePreferenceChange('parking', { 
                                ...formData.preferences.parking, 
                                type: e.target.value 
                              })}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            >
                              <option value="open">Open</option>
                              <option value="covered">Covered</option>
                              <option value="underground">Underground</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-medium text-gray-700">Special Features</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      'Solar Panels',
                      'Rainwater Harvesting',
                      'Green Roof',
                      'Smart Home',
                      'Wheelchair Accessible',
                      'Pet Friendly',
                      'Home Theater',
                      'Gym'
                    ].map(feature => (
                      <label key={feature} className="flex items-center text-sm">
                        <input
                          type="checkbox"
                          checked={formData.preferences.special_features.includes(feature)}
                          onChange={(e) => {
                            const currentFeatures = formData.preferences.special_features;
                            const newFeatures = e.target.checked
                              ? [...currentFeatures, feature]
                              : currentFeatures.filter(f => f !== feature);
                            handlePreferenceChange('special_features', newFeatures);
                          }}
                          className="mr-2"
                        />
                        {feature}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setStep(2)}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="px-6 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? 'Generating...' : 'Generate Plans'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Preview Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-6 sticky top-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Live Preview</h2>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                {loading && step === 3 ? (
                  <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                  </div>
                ) : (
                  renderPreviewCanvas()
                )}
              </div>

              {/* Summary */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Plot Size:</span>
                  <span className="font-medium">{formData.plot.width}' x {formData.plot.length}'</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Facing:</span>
                  <span className="font-medium capitalize">{formData.plot.facing}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Rooms:</span>
                  <span className="font-medium">
                    {formData.requirements.bedrooms + (formData.requirements.master_bedroom ? 1 : 0)} BR, 
                    {formData.requirements.bathrooms} BA
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Style:</span>
                  <span className="font-medium capitalize">{formData.preferences.style}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Parking:</span>
                  <span className="font-medium">
                    {formData.preferences.parking.enabled ? `${formData.preferences.parking.cars} cars` : 'None'}
                  </span>
                </div>
              </div>

              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  🎨 <strong>AI Enhancement:</strong> Your design will be enhanced with Gemini AI for optimal space utilization and architectural beauty.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedHomePage;