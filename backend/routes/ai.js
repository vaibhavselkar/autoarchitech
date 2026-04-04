const express = require('express');
const jwt = require('jsonwebtoken');
const Plan = require('../models/Plan');
const geminiService = require('../services/geminiService');
const modelService = require('../services/modelService');
const axios = require('axios');

const router = express.Router();

// Middleware to verify JWT token
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'Banayengakyaghartoiskojaldistemaalkr');
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

// Generate AI design suggestions
router.post('/generate-suggestions', authMiddleware, async (req, res) => {
  try {
    const { layout, requirements } = req.body;

    if (!layout) {
      return res.status(400).json({
        success: false,
        message: 'Layout data is required'
      });
    }

    // Generate design concepts using Gemini AI
    const concepts = await geminiService.generateDesignConcepts(
      requirements || {},
      layout.metadata?.preferences || {}
    );

    res.json({
      success: true,
      message: 'AI design suggestions generated successfully',
      data: {
        concepts
      }
    });

  } catch (error) {
    console.error('Generate AI suggestions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate AI suggestions',
      error: error.message
    });
  }
});

// Analyze layout quality
router.post('/analyze-quality', authMiddleware, async (req, res) => {
  try {
    const { layout } = req.body;

    if (!layout) {
      return res.status(400).json({
        success: false,
        message: 'Layout data is required'
      });
    }

    // Analyze layout quality using Gemini AI
    const analysis = await geminiService.analyzeLayoutQuality(layout);

    res.json({
      success: true,
      message: 'Layout quality analysis complete',
      data: analysis
    });

  } catch (error) {
    console.error('Analyze quality error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze layout quality',
      error: error.message
    });
  }
});

// Apply AI suggestion to a plan
router.post('/apply-suggestion', authMiddleware, async (req, res) => {
  try {
    const { planId, suggestion } = req.body;

    if (!planId || !suggestion) {
      return res.status(400).json({
        success: false,
        message: 'Plan ID and suggestion are required'
      });
    }

    // Get the plan
    const plan = await Plan.findOne({
      _id: planId,
      userId: req.userId
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    // Apply AI suggestion to the layout
    const refinedLayout = await geminiService.refineLayoutWithGemini(
      plan.layoutJson,
      plan.requirements || {}
    );

    // Update the plan with the refined layout
    plan.layoutJson = refinedLayout;
    plan.title = `${plan.title} (AI-Enhanced)`;
    plan.description = 'Layout refined with AI suggestions';
    plan.updatedAt = new Date();

    await plan.save();

    res.json({
      success: true,
      message: 'AI suggestion applied successfully',
      data: {
        plan
      }
    });

  } catch (error) {
    console.error('Apply AI suggestion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to apply AI suggestion',
      error: error.message
    });
  }
});

// Get AI enhancement status for a plan
router.get('/enhancement-status/:planId', authMiddleware, async (req, res) => {
  try {
    const { planId } = req.params;

    const plan = await Plan.findOne({
      _id: planId,
      userId: req.userId
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    const metadata = plan.layoutJson.metadata || {};
    const status = {
      enhanced: metadata.geminiEnhanced || metadata.aiEnhanced || false,
      method: metadata.generator || 'rule-based',
      enhancementDate: metadata.enhancementDate || null,
      suggestionsApplied: metadata.geminiSuggestions ? true : false
    };

    res.json({
      success: true,
      data: {
        status
      }
    });

  } catch (error) {
    console.error('Get enhancement status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get enhancement status',
      error: error.message
    });
  }
});

// Get AI-powered layout comparison
router.post('/compare-layouts', authMiddleware, async (req, res) => {
  try {
    const { layouts } = req.body;

    if (!layouts || !Array.isArray(layouts) || layouts.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'At least 2 layouts are required for comparison'
      });
    }

    // Use Gemini AI to compare layouts and provide recommendations
    const comparison = {
      totalLayouts: layouts.length,
      comparisons: [],
      recommendations: []
    };

    // Compare each layout against the first one
    for (let i = 1; i < layouts.length; i++) {
      const comparisonResult = {
        layoutIndex: i,
        scoreDifference: 0,
        strengths: [],
        weaknesses: [],
        suggestions: []
      };

      // Simple comparison logic - in production, this would use AI analysis
      const layout1 = layouts[0];
      const layout2 = layouts[i];

      const score1 = layout1.metadata?.qualityScore || 75;
      const score2 = layout2.metadata?.qualityScore || 75;
      
      comparisonResult.scoreDifference = score2 - score1;
      comparison.comparisons.push(comparisonResult);
    }

    // Generate overall recommendations
    comparison.recommendations = [
      'Consider the layout with the highest space utilization',
      'Evaluate natural light optimization in each design',
      'Check room adjacency and flow patterns',
      'Review structural efficiency and construction costs'
    ];

    res.json({
      success: true,
      message: 'Layout comparison complete',
      data: comparison
    });

  } catch (error) {
    console.error('Compare layouts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to compare layouts',
      error: error.message
    });
  }
});

// Get AI design trends and insights
router.get('/design-trends', authMiddleware, async (req, res) => {
  try {
    // This could fetch trending design patterns, user preferences, etc.
    const trends = {
      popularStyles: [
        'Modern Minimalist',
        'Contemporary',
        'Traditional Elegance',
        'Industrial Chic',
        'Scandinavian'
      ],
      trendingFeatures: [
        'Open floor plans',
        'Large windows for natural light',
        'Smart home integration',
        'Sustainable materials',
        'Multi-functional spaces'
      ],
      spaceOptimizationTips: [
        'Use sliding doors to save space',
        'Consider built-in furniture',
        'Maximize vertical storage',
        'Create flexible room layouts',
        'Optimize natural light placement'
      ]
    };

    res.json({
      success: true,
      data: trends
    });

  } catch (error) {
    console.error('Get design trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get design trends',
      error: error.message
    });
  }
});

// ==========================================
// AI Model-Based Floor Plan Generation Endpoints
// ==========================================

// Generate floor plan using AI models (HouseDiffusion, CE2EPlan, Graph2Plan)
router.post('/generate-floorplan', authMiddleware, async (req, res) => {
  try {
    const { 
      plotWidth, 
      plotDepth, 
      rooms, 
      vastuPreferences,
      model = 'ce2eplan' 
    } = req.body;

    if (!plotWidth || !plotDepth) {
      return res.status(400).json({
        success: false,
        message: 'Plot dimensions (width and depth) are required'
      });
    }

    const requirements = {
      plotWidth,
      plotDepth,
      rooms: rooms || [],
      vastuPreferences: vastuPreferences || {}
    };

    // Generate floor plan using the Python Flask service
    const flaskUrl = process.env.PYTHON_MODEL_SERVICE_URL || 'http://localhost:5000';
    
    console.log(`Calling Flask service at: ${flaskUrl}/generate`);
    console.log(`Request body:`, { plot_width: plotWidth, plot_depth: plotDepth, model: model });
    
    let result;
    try {
      const response = await axios.post(`${flaskUrl}/generate`, {
        plot_width: plotWidth,
        plot_depth: plotDepth,
        model: model,
        vastu_preferences: vastuPreferences
      }, {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      });
      console.log(`Flask response:`, response.status, response.data?.metrics);
      result = {
        success: true,
        data: response.data,
        model: model,
        generation_time: response.data.metrics?.generation_time_seconds || 0
      };
    } catch (error) {
      console.error('Flask service error:', error.message);
      if (error.response) {
        console.error('Error response:', error.response.status, error.response.data);
      }
      return res.status(500).json({
        success: false,
        message: `AI model service unavailable: ${error.message}. Make sure Flask is running on port 5000.`,
        error: error.message
      });
    }

    // Analyze Vastu compliance
    const vastuAnalysis = modelService.analyzeVastuCompliance(result.data);

    res.json({
      success: true,
      message: `Floor plan generated using ${model}`,
      data: {
        floorplan: result.data,
        model: model,
        generation_time: result.generation_time,
        vastu_compliance: vastuAnalysis,
        fallback_used: result.fallback || false
      }
    });

  } catch (error) {
    console.error('Generate floor plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate floor plan',
      error: error.message
    });
  }
});

// Compare all available AI models for the same requirements
router.post('/compare-models', authMiddleware, async (req, res) => {
  try {
    const { plotWidth, plotDepth, rooms, vastuPreferences } = req.body;

    if (!plotWidth || !plotDepth) {
      return res.status(400).json({
        success: false,
        message: 'Plot dimensions (width and depth) are required'
      });
    }

    const requirements = {
      plotWidth,
      plotDepth,
      rooms: rooms || [],
      vastuPreferences: vastuPreferences || {}
    };

    // Compare all models
    const comparison = await modelService.compareModels(requirements);

    res.json({
      success: true,
      message: 'Model comparison complete',
      data: comparison
    });

  } catch (error) {
    console.error('Compare models error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to compare models',
      error: error.message
    });
  }
});

// Analyze Vastu compliance of a floor plan
router.post('/analyze-vastu', authMiddleware, async (req, res) => {
  try {
    const { floorplan } = req.body;

    if (!floorplan) {
      return res.status(400).json({
        success: false,
        message: 'Floor plan data is required'
      });
    }

    const vastuAnalysis = modelService.analyzeVastuCompliance(floorplan);

    res.json({
      success: true,
      message: 'Vastu compliance analysis complete',
      data: vastuAnalysis
    });

  } catch (error) {
    console.error('Analyze Vastu error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze Vastu compliance',
      error: error.message
    });
  }
});

// Get available AI models and their characteristics
router.get('/available-models', authMiddleware, async (req, res) => {
  try {
    const models = [
      {
        id: 'housediffusion',
        name: 'HouseDiffusion',
        description: 'Vector floorplan generation via diffusion model',
        paper: 'HouseDiffusion: Vector Floorplan Generation via a Diffusion Model (2022)',
        strengths: ['High quality room dimensions', 'Good for varied layouts'],
        weaknesses: ['Lower Vastu compliance', 'Slower generation'],
        best_for: 'High-quality architectural designs'
      },
      {
        id: 'ce2eplan',
        name: 'CE2EPlan (HouseGAN++)',
        description: 'End-to-end floorplan generation using GANs',
        paper: 'HouseGAN++: Probabilistic Typo-Graphical Floorplan Generation',
        strengths: ['Fastest generation', 'Highest space efficiency', 'Best overall score'],
        weaknesses: ['Room sizes can be larger than ideal'],
        best_for: 'Quick iterations and space-efficient designs'
      },
      {
        id: 'graph2plan',
        name: 'Graph2Plan',
        description: 'Floorplan generation from layout graphs',
        paper: 'Graph2Plan: Learning Floorplan Generation from Layout Graphs (SIGGRAPH 2020)',
        strengths: ['Graph-based constraints', 'Good for structured layouts'],
        weaknesses: ['Slowest generation', 'Requires more input specification'],
        best_for: 'Constraint-based design exploration'
      }
    ];

    res.json({
      success: true,
      data: {
        models,
        recommended: 'ce2eplan',
        note: 'All models benefit from Vastu-compliant fine-tuning for Indian requirements'
      }
    });

  } catch (error) {
    console.error('Get available models error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get available models',
      error: error.message
    });
  }
});

// Save generated floor plan as a new plan
router.post('/save-generated-plan', authMiddleware, async (req, res) => {
  try {
    const { 
      title, 
      description, 
      floorplan, 
      requirements,
      model 
    } = req.body;

    if (!floorplan) {
      return res.status(400).json({
        success: false,
        message: 'Floor plan data is required'
      });
    }

    // Convert to standard format
    const standardFormat = modelService.convertToStandardFormat(floorplan);

    // Create new plan
    const plan = new Plan({
      userId: req.userId,
      title: title || `AI Generated Plan (${model})`,
      description: description || `Generated using ${model} AI model`,
      plotDimensions: {
        width: floorplan.input?.boundary?.width || 30,
        depth: floorplan.input?.boundary?.depth || 50,
        unit: 'feet'
      },
      requirements: requirements || {},
      layoutJson: {
        rooms: standardFormat.rooms,
        doors: standardFormat.doors,
        windows: standardFormat.windows,
        metadata: {
          ...standardFormat.metadata,
          generator: model,
          aiGenerated: true,
          generationDate: new Date().toISOString()
        }
      },
      status: 'draft'
    });

    await plan.save();

    res.json({
      success: true,
      message: 'Floor plan saved successfully',
      data: { plan }
    });

  } catch (error) {
    console.error('Save generated plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save floor plan',
      error: error.message
    });
  }
});

module.exports = router;
