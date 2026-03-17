import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Stage, Layer, Rect, Text, Group, Line } from 'react-konva';
import toast from 'react-hot-toast';
import PlanCanvas from '../components/PlanCanvas';
import PlanCard from '../components/PlanCard';
import AIAssistancePanel from '../components/AIAssistancePanel';
import api from '../services/api';

const EnhancedPlanResults = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [showAIAssistance, setShowAIAssistance] = useState(false);

  useEffect(() => {
    // Get plans from location state or fetch from API
    if (location.state?.plans) {
      setPlans(location.state.plans);
      if (location.state.plans.length > 0) {
        setSelectedPlan(location.state.plans[0]);
      }
    } else {
      fetchPlans();
    }
  }, [location.state]);

  // AI Enhancement Functions
  const enhanceWithAI = async () => {
    if (!selectedPlan) return;

    try {
      setLoading(true);
      const response = await api.post('/api/ai/generate-suggestions', {
        layout: selectedPlan.layoutJson,
        requirements: selectedPlan.requirements || {}
      });

      if (response.data.success) {
        setAiSuggestions(response.data.data.concepts || []);
        toast.success('AI suggestions generated!');
      }
    } catch (error) {
      toast.error('Failed to generate AI suggestions');
    } finally {
      setLoading(false);
    }
  };

  const analyzeQuality = async () => {
    if (!selectedPlan) return;

    try {
      setLoading(true);
      const response = await api.post('/api/ai/analyze-quality', {
        layout: selectedPlan.layoutJson
      });

      if (response.data.success) {
        setAiAnalysis(response.data.data);
        toast.success('Quality analysis complete!');
      }
    } catch (error) {
      toast.error('Failed to analyze quality');
    } finally {
      setLoading(false);
    }
  };

  const applyAISuggestion = async (suggestion) => {
    if (!selectedPlan) return;

    try {
      setLoading(true);
      const response = await api.post('/api/ai/apply-suggestion', {
        planId: selectedPlan._id,
        suggestion: suggestion
      });

      if (response.data.success) {
        setSelectedPlan(response.data.data.plan);
        toast.success('AI suggestion applied!');
      }
    } catch (error) {
      toast.error('Failed to apply AI suggestion');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const response = await api.get('/plans');
      setPlans(response.data.data.plans);
      if (response.data.data.plans.length > 0) {
        setSelectedPlan(response.data.data.plans[0]);
      }
    } catch (error) {
      toast.error('Failed to fetch plans');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = (plan) => {
    setSelectedPlan(plan);
    setAiAnalysis(null);
    setAiSuggestions([]);
  };

  const handleEditPlan = () => {
    if (selectedPlan) {
      navigate(`/editor/${selectedPlan._id}`);
    }
  };

  const handleExportPlan = () => {
    if (selectedPlan) {
      navigate(`/export/${selectedPlan._id}`);
    }
  };

  const renderPlanCanvas = (layout, width = 800, height = 600) => {
    if (!layout) return null;

    const scale = Math.min(width / (layout.plot.width + 10), height / (layout.plot.length + 10));
    const offsetX = 50;
    const offsetY = 50;

    return (
      <Stage width={width} height={height}>
        <Layer>
          {/* Plot boundary */}
          <Rect
            x={offsetX}
            y={offsetY}
            width={layout.plot.width * scale}
            height={layout.plot.length * scale}
            stroke="#333"
            strokeWidth={4}
            fill="none"
          />

          {/* Rooms */}
          {layout.rooms.map((room, index) => (
            <Group key={index}>
              <Rect
                x={offsetX + (room.x * scale)}
                y={offsetY + (room.y * scale)}
                width={room.width * scale}
                height={room.height * scale}
                fill="#f0f0f0"
                stroke="#666"
                strokeWidth={1}
                cornerRadius={2}
              />
              <Text
                x={offsetX + (room.x * scale) + 5}
                y={offsetY + (room.y * scale) + 5}
                text={room.label}
                fontSize={12 * scale}
                fill="#333"
                fontFamily="Arial"
              />
            </Group>
          ))}

          {/* Walls */}
          {layout.walls.map((wall, index) => (
            <Line
              key={index}
              points={[
                offsetX + (wall.x1 * scale),
                offsetY + (wall.y1 * scale),
                offsetX + (wall.x2 * scale),
                offsetY + (wall.y2 * scale)
              ]}
              stroke="#000"
              strokeWidth={wall.thickness * scale * 10}
              lineCap="round"
              lineJoin="round"
            />
          ))}

          {/* Doors */}
          {layout.doors.map((door, index) => (
            <Line
              key={index}
              points={[
                offsetX + (door.x * scale),
                offsetY + (door.y * scale),
                offsetX + (door.x * scale),
                offsetY + ((door.y + door.height) * scale)
              ]}
              stroke="#888"
              strokeWidth={2}
            />
          ))}

          {/* Windows */}
          {layout.windows.map((window, index) => (
            <Rect
              key={index}
              x={offsetX + (window.x * scale)}
              y={offsetY + (window.y * scale)}
              width={window.width * scale}
              height={window.height * scale}
              stroke="#aaa"
              strokeWidth={1}
              strokeDashArray={[4, 4]}
              fill="none"
            />
          ))}

          {/* Dimensions */}
          {layout.dimensions.map((dimension, index) => (
            <Text
              key={index}
              x={offsetX + (dimension.position.x * scale)}
              y={offsetY + (dimension.position.y * scale)}
              text={dimension.value.toString()}
              fontSize={10 * scale}
              fill="#666"
              fontFamily="Arial"
            />
          ))}
        </Layer>
      </Stage>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">AI-Enhanced Floor Plans</h1>
          <div className="flex space-x-4">
            <button
              onClick={enhanceWithAI}
              disabled={!selectedPlan || loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md"
            >
              🤖 Enhance with AI
            </button>
            <button
              onClick={analyzeQuality}
              disabled={!selectedPlan || loading}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md"
            >
              📊 Analyze Quality
            </button>
            <button
              onClick={handleEditPlan}
              disabled={!selectedPlan}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md"
            >
              Edit Plan
            </button>
            <button
              onClick={handleExportPlan}
              disabled={!selectedPlan}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md"
            >
              Export Plan
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Plan List */}
          <div className="lg:col-span-1">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Available Plans</h2>
            <div className="space-y-4">
              {plans.map((plan, index) => (
                <div
                  key={plan._id}
                  onClick={() => handleSelectPlan(plan)}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedPlan?._id === plan._id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900">{plan.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {plan.layoutJson.rooms?.length || 0} rooms
                      </p>
                      <div className="flex items-center space-x-2 mt-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          plan.layoutJson.metadata?.generator === 'ai-enhanced'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {plan.layoutJson.metadata?.generator === 'ai-enhanced' ? 'AI-Enhanced' : 'Standard'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">
                        {new Date(plan.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Plan Preview */}
          <div className="lg:col-span-2">
            {selectedPlan ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedPlan.title}
                  </h2>
                  <div className="text-sm text-gray-600">
                    Generated: {new Date(selectedPlan.createdAt).toLocaleString()}
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  {renderPlanCanvas(selectedPlan.layoutJson, 800, 600)}
                </div>

                {/* Plan Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-lg border">
                    <h4 className="font-semibold text-gray-900">Plot Size</h4>
                    <p className="text-gray-600 text-sm">
                      {selectedPlan.layoutJson.plot.width}' x {selectedPlan.layoutJson.plot.length}'
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border">
                    <h4 className="font-semibold text-gray-900">Rooms</h4>
                    <p className="text-gray-600 text-sm">
                      {selectedPlan.layoutJson.rooms?.length || 0}
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border">
                    <h4 className="font-semibold text-gray-900">Walls</h4>
                    <p className="text-gray-600 text-sm">
                      {selectedPlan.layoutJson.walls?.length || 0}
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border">
                    <h4 className="font-semibold text-gray-900">Doors</h4>
                    <p className="text-gray-600 text-sm">
                      {selectedPlan.layoutJson.doors?.length || 0}
                    </p>
                  </div>
                </div>

                {/* AI Analysis Results */}
                {aiAnalysis && (
                  <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">AI Quality Analysis</h3>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Overall Score</span>
                      <span className="text-2xl font-bold text-green-600">{aiAnalysis.overallScore}/100</span>
                    </div>
                  </div>
                )}

                {/* AI Suggestions */}
                {aiSuggestions.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">AI Design Suggestions</h3>
                    <div className="grid grid-cols-1 gap-3">
                      {aiSuggestions.map((suggestion, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start mb-2">
                            <h5 className="font-semibold text-gray-900">{suggestion.title}</h5>
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                              {suggestion.style}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-3">{suggestion.description}</p>
                          <div className="flex flex-wrap gap-2 mb-3">
                            {suggestion.features.map((feature, featureIndex) => (
                              <span key={featureIndex} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                {feature}
                              </span>
                            ))}
                          </div>
                          <button
                            onClick={() => applyAISuggestion(suggestion)}
                            disabled={loading}
                            className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Apply This Concept
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">No plans available. Generate some plans first!</p>
              </div>
            )}
          </div>

          {/* AI Assistance Panel */}
          <div className="lg:col-span-1">
            <AIAssistancePanel
              plan={selectedPlan}
              onSuggestionApplied={setSelectedPlan}
              onQualityAnalysis={setAiAnalysis}
              isLoading={loading}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedPlanResults;