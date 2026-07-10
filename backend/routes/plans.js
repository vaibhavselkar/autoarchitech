const express = require('express');
const Plan = require('../models/Plan');
const Plot = require('../models/Plot');
const { generateLayoutVariations, generateLayoutVariationsStream } = require('../services/layoutGenerator');
const { exportToSVG, exportToPDF, exportToDXF } = require('../services/exporter');
const { authMiddleware } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// Generate floor plans
router.post('/generate', authMiddleware, asyncHandler(async (req, res) => {
  const {
    plot,
    requirements,
    preferences,
    variations = 5
  } = req.body;

  if (!plot || !requirements) {
    return res.status(400).json({
      success: false,
      message: 'Plot and requirements are required'
    });
  }

  let plotId = null;
  let existingPlot = await Plot.findOne({
    userId: req.userId,
    width: plot.width,
    length: plot.length,
    facing: plot.facing
  });

  if (!existingPlot) {
    const newPlot = new Plot({ ...plot, userId: req.userId });
    await newPlot.save();
    plotId = newPlot._id;
  } else {
    plotId = existingPlot._id;
  }

  const layouts = await generateLayoutVariations(plot, requirements, preferences, variations);

  const savedPlans = [];
  for (let i = 0; i < layouts.length; i++) {
    const layout = layouts[i];
    const plan = new Plan({
      userId: req.userId,
      plotId: plotId,
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
}));

// Stream floor plan generation — emits each plan via SSE as soon as score > 80
router.post('/generate-stream', authMiddleware, async (req, res) => {
  const { plot, requirements, preferences, building } = req.body;

  if (building) {
    requirements.floors            = building.floors            ?? requirements.floors;
    requirements.staircase_type    = building.staircase_type    ?? requirements.staircase_type;
    requirements.staircase_position= building.staircase_position?? requirements.staircase_position;
  }

  if (!plot || !requirements) {
    return res.status(400).json({ success: false, message: 'Plot and requirements are required' });
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const emit = (data) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Ensure a plot record exists
  let plotId = null;
  try {
    let existing = await Plot.findOne({ userId: req.userId, width: plot.width, length: plot.length, facing: plot.facing });
    if (!existing) {
      const newPlot = new Plot({ ...plot, userId: req.userId });
      await newPlot.save();
      plotId = newPlot._id;
    } else {
      plotId = existing._id;
    }
  } catch (e) { /* non-fatal */ }

  emit({ type: 'status', message: 'AI is designing your floor plans…' });

  try {
    let planIndex = 0;

    await generateLayoutVariationsStream(plot, requirements, preferences, 3, async (layout, index, attempts) => {
      planIndex++;
      const score = layout.validation?.score ?? 0;

      const plan = new Plan({
        userId: req.userId,
        plotId,
        layoutJson: layout,
        title: `Plan ${planIndex}`,
        description: layout.metadata?.designTheme || 'AI-generated floor plan',
      });
      await plan.save();

      emit({ type: 'plan', index, plan: plan.toObject(), score, attempts });
    });

    emit({ type: 'done', total: 3 });
  } catch (err) {
    console.error('generate-stream error:', err);
    emit({ type: 'error', message: 'Floor plan generation failed' });
  }

  res.end();
});

// Save a plot
router.post('/plots', authMiddleware, asyncHandler(async (req, res) => {
  const plotData = req.body;
  const plot = new Plot({ ...plotData, userId: req.userId });

  await plot.save();

  res.status(201).json({
    success: true,
    message: 'Plot saved successfully',
    data: { plot }
  });
}));

// Get user's plots
router.get('/plots', authMiddleware, asyncHandler(async (req, res) => {
  const plots = await Plot.find({ userId: req.userId }).sort({ createdAt: -1 });

  res.json({
    success: true,
    data: { plots }
  });
}));

// Get user's plans
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const plans = await Plan.find({ userId: req.userId })
    .populate('plotId')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: { plans }
  });
}));

// Get a specific plan
router.get('/:planId', authMiddleware, asyncHandler(async (req, res) => {
  const { planId } = req.params;
  const plan = await Plan.findOne({ _id: planId, userId: req.userId }).populate('plotId');

  if (!plan) {
    return res.status(404).json({
      success: false,
      message: 'Plan not found'
    });
  }

  res.json({
    success: true,
    data: { plan }
  });
}));

// Export plan to different formats
router.get('/:planId/export/:format', authMiddleware, asyncHandler(async (req, res) => {
  const { planId, format } = req.params;
  const { scale = 1 } = req.query;

  const plan = await Plan.findOne({ _id: planId, userId: req.userId });

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
}));

// Update a plan
router.put('/:planId', authMiddleware, asyncHandler(async (req, res) => {
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
    data: { plan }
  });
}));

// Delete a plan
router.delete('/:planId', authMiddleware, asyncHandler(async (req, res) => {
  const { planId } = req.params;

  const plan = await Plan.findOneAndDelete({ _id: planId, userId: req.userId });

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
}));

module.exports = router;
