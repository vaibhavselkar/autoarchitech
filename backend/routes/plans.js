const express = require('express');
const Plan = require('../models/Plan');
const Plot = require('../models/Plot');
const { generateLayout, generateLayoutVariations } = require('../services/layoutGenerator');
const { exportToSVG, exportToPDF, exportToDXF } = require('../services/exporter');

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

// Generate floor plans
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const {
      plot,
      requirements,
      preferences,
      variations = 5
    } = req.body;

    // Validate input
    if (!plot || !requirements) {
      return res.status(400).json({
        success: false,
        message: 'Plot and requirements are required'
      });
    }

    // Generate multiple layout variations using enhanced AI and rule-based methods
    const layouts = await generateLayoutVariations(plot, requirements, preferences, variations);

    // Save layouts to database
    const savedPlans = [];
    for (let i = 0; i < layouts.length; i++) {
      const layout = layouts[i];
      const plan = new Plan({
        userId: req.userId,
        plotId: null, // Will be set if plot is saved
        layoutJson: layout,
        title: `AI-Enhanced Plan ${i + 1}`,
        description: layout.metadata?.generator === 'ai-enhanced' 
          ? 'AI-generated with Gemini architectural intelligence' 
          : 'Rule-based generation with architectural standards'
      });
      
      await plan.save();
      savedPlans.push(plan);
    }

    res.json({
      success: true,
      message: `${layouts.length} floor plans generated successfully`,
      data: {
        plans: savedPlans,
        generationMethod: layouts[0]?.metadata?.generator || 'rule-based'
      }
    });

  } catch (error) {
    console.error('Generate plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate floor plans',
      error: error.message
    });
  }
});

// Save a plot
router.post('/plots', authMiddleware, async (req, res) => {
  try {
    const plotData = req.body;
    const plot = new Plot({
      ...plotData,
      userId: req.userId
    });

    await plot.save();

    res.status(201).json({
      success: true,
      message: 'Plot saved successfully',
      data: {
        plot
      }
    });

  } catch (error) {
    console.error('Save plot error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save plot',
      error: error.message
    });
  }
});

// Get user's plots
router.get('/plots', authMiddleware, async (req, res) => {
  try {
    const plots = await Plot.find({ userId: req.userId }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        plots
      }
    });

  } catch (error) {
    console.error('Get plots error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve plots',
      error: error.message
    });
  }
});

// Get user's plans
router.get('/', authMiddleware, async (req, res) => {
  try {
    const plans = await Plan.find({ userId: req.userId })
      .populate('plotId')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        plans
      }
    });

  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve plans',
      error: error.message
    });
  }
});

// Get a specific plan
router.get('/:planId', authMiddleware, async (req, res) => {
  try {
    const { planId } = req.params;
    const plan = await Plan.findOne({
      _id: planId,
      userId: req.userId
    }).populate('plotId');

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    res.json({
      success: true,
      data: {
        plan
      }
    });

  } catch (error) {
    console.error('Get plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve plan',
      error: error.message
    });
  }
});

// Export plan to different formats
router.get('/:planId/export/:format', authMiddleware, async (req, res) => {
  try {
    const { planId, format } = req.params;
    const { scale = 1 } = req.query;

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

    let exportResult;
    let contentType;
    let filename;

    switch (format.toLowerCase()) {
      case 'svg':
        exportResult = await exportToSVG(plan.layoutJson, scale);
        contentType = 'image/svg+xml';
        filename = `plan-${planId}.svg`;
        break;
      
      case 'pdf':
        exportResult = await exportToPDF(plan.layoutJson, scale);
        contentType = 'application/pdf';
        filename = `plan-${planId}.pdf`;
        break;
      
      case 'dxf':
        exportResult = await exportToDXF(plan.layoutJson, scale);
        contentType = 'application/dxf';
        filename = `plan-${planId}.dxf`;
        break;
      
      case 'json':
        exportResult = JSON.stringify(plan.layoutJson, null, 2);
        contentType = 'application/json';
        filename = `plan-${planId}.json`;
        break;
      
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid export format. Supported formats: svg, pdf, dxf, json'
        });
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(exportResult);

  } catch (error) {
    console.error('Export plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export plan',
      error: error.message
    });
  }
});

// Update a plan
router.put('/:planId', authMiddleware, async (req, res) => {
  try {
    const { planId } = req.params;
    const updateData = req.body;

    const plan = await Plan.findOneAndUpdate(
      { _id: planId, userId: req.userId },
      { ...updateData, updatedAt: new Date() },
      { new: true }
    );

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    res.json({
      success: true,
      message: 'Plan updated successfully',
      data: {
        plan
      }
    });

  } catch (error) {
    console.error('Update plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update plan',
      error: error.message
    });
  }
});

// Delete a plan
router.delete('/:planId', authMiddleware, async (req, res) => {
  try {
    const { planId } = req.params;

    const plan = await Plan.findOneAndDelete({
      _id: planId,
      userId: req.userId
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    res.json({
      success: true,
      message: 'Plan deleted successfully'
    });

  } catch (error) {
    console.error('Delete plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete plan',
      error: error.message
    });
  }
});

module.exports = router;