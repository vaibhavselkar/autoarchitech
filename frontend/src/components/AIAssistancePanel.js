import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api from '../services/api';

/**
 * AI Assistance Panel Component
 * Provides AI-powered design suggestions and quality analysis
 */
const AIAssistancePanel = ({ 
  plan, 
  onSuggestionApplied, 
  onQualityAnalysis, 
  isLoading 
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [activeTab, setActiveTab] = useState('suggestions');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Generate AI design suggestions
  const generateSuggestions = async () => {
    if (!plan) return;

    try {
      setIsAnalyzing(true);
      const { data } = await api.post('/plans/generate-suggestions', {
        layout: plan.layoutJson,
        requirements: plan.requirements || {}
      });
      if (data.success) {
        setSuggestions(data.data.concepts || []);
        toast.success('AI design suggestions generated!');
      } else {
        toast.error('Failed to generate suggestions');
      }
    } catch (error) {
      console.error('Error generating suggestions:', error);
      toast.error('Error generating AI suggestions');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Analyze layout quality
  const analyzeQuality = async () => {
    if (!plan) return;

    try {
      setIsAnalyzing(true);
      const { data } = await api.post('/plans/analyze-quality', {
        layout: plan.layoutJson
      });
      if (data.success) {
        setAnalysis(data.data);
        toast.success('Quality analysis complete!');
        if (onQualityAnalysis) onQualityAnalysis(data.data);
      } else {
        toast.error('Failed to analyze quality');
      }
    } catch (error) {
      console.error('Error analyzing quality:', error);
      toast.error('Error analyzing layout quality');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Apply AI suggestion to layout
  const applySuggestion = async (suggestion) => {
    if (!plan) return;

    try {
      const { data } = await api.post('/plans/apply-suggestion', {
        planId: plan._id,
        suggestion
      });
      if (data.success) {
        toast.success('Suggestion applied successfully!');
        if (onSuggestionApplied) onSuggestionApplied(data.data.plan);
      } else {
        toast.error('Failed to apply suggestion');
      }
    } catch (error) {
      console.error('Error applying suggestion:', error);
      toast.error('Error applying AI suggestion');
    }
  };

  // Get AI enhancement status
  const getEnhancementStatus = () => {
    if (!plan?.layoutJson?.metadata) {
      return { enhanced: false, method: 'Rule-based' };
    }
    
    const metadata = plan.layoutJson.metadata;
    return {
      enhanced: metadata.geminiEnhanced || metadata.aiEnhanced,
      method: metadata.generator || 'Unknown'
    };
  };

  const enhancementStatus = getEnhancementStatus();

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center">
          <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
          AI Design Assistant
        </h3>
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            enhancementStatus.enhanced 
              ? 'bg-green-100 text-green-800' 
              : 'bg-gray-100 text-gray-800'
          }`}>
            {enhancementStatus.enhanced ? 'AI-Enhanced' : 'Standard'}
          </span>
          <span className="text-xs text-gray-500">
            {enhancementStatus.method}
          </span>
        </div>
      </div>

      {/* Enhancement Status */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-gray-900">Layout Enhancement</h4>
            <p className="text-sm text-gray-600">
              {enhancementStatus.enhanced 
                ? 'This layout was enhanced with AI intelligence for optimal design'
                : 'Consider AI enhancement for improved layout optimization'
              }
            </p>
          </div>
          {!enhancementStatus.enhanced && (
            <button
              onClick={generateSuggestions}
              disabled={isAnalyzing || isLoading}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isAnalyzing ? 'Enhancing...' : 'Enhance with AI'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-4">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('suggestions')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'suggestions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Design Suggestions
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'analysis'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Quality Analysis
          </button>
        </nav>
      </div>

      {/* Suggestions Tab */}
      {activeTab === 'suggestions' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-medium text-gray-900">AI Design Concepts</h4>
            <button
              onClick={generateSuggestions}
              disabled={isAnalyzing || isLoading}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              {isAnalyzing ? 'Generating...' : 'Generate New Suggestions'}
            </button>
          </div>

          {suggestions.length > 0 ? (
            <div className="space-y-3">
              {suggestions.map((concept, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <h5 className="font-semibold text-gray-900">{concept.title}</h5>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {concept.style}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{concept.description}</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {concept.features.map((feature, featureIndex) => (
                      <span key={featureIndex} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                        {feature}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => applySuggestion(concept)}
                    disabled={isLoading}
                    className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Apply This Concept
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="mb-4">
                <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <p>No design suggestions available yet.</p>
              <p className="text-sm">Generate AI suggestions to get started.</p>
            </div>
          )}
        </div>
      )}

      {/* Analysis Tab */}
      {activeTab === 'analysis' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-medium text-gray-900">Layout Quality Analysis</h4>
            <button
              onClick={analyzeQuality}
              disabled={isAnalyzing || isLoading}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              {isAnalyzing ? 'Analyzing...' : 'Run Quality Analysis'}
            </button>
          </div>

          {analysis ? (
            <div className="space-y-4">
              {/* Overall Score */}
              <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h5 className="font-semibold text-gray-900">Overall Quality Score</h5>
                    <p className="text-sm text-gray-600">Based on architectural standards and best practices</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-green-600">{analysis.overallScore}/100</div>
                    <div className="text-xs text-gray-500">Excellent</div>
                  </div>
                </div>
              </div>

              {/* Strengths */}
              {analysis.strengths && analysis.strengths.length > 0 && (
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Strengths</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {analysis.strengths.map((strength, index) => (
                      <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <span className="text-green-800 text-sm">{strength}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Areas for Improvement */}
              {analysis.weaknesses && analysis.weaknesses.length > 0 && (
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Areas for Improvement</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {analysis.weaknesses.map((weakness, index) => (
                      <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <span className="text-yellow-800 text-sm">{weakness}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {analysis.recommendations && analysis.recommendations.length > 0 && (
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">AI Recommendations</h5>
                  <div className="space-y-2">
                    {analysis.recommendations.map((recommendation, index) => (
                      <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <span className="text-blue-800 text-sm">{recommendation}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="mb-4">
                <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p>No quality analysis available yet.</p>
              <p className="text-sm">Run quality analysis to get detailed feedback.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIAssistancePanel;