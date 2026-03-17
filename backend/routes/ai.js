const express = require('express');
const Plan = require('../models/Plan');
const geminiService = require('../services/geminiService');

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

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
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

module.exports = router;