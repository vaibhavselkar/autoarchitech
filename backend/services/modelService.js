const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Python model service configuration - always use Flask service
const PYTHON_SERVICE_URL = process.env.PYTHON_MODEL_SERVICE_URL || 'http://localhost:5000';

/**
 * Service for interacting with Python-based floor plan generation models
 */
class ModelService {
  constructor() {
    this.availableModels = ['housediffusion', 'ce2eplan', 'graph2plan'];
    this.defaultModel = 'ce2eplan'; // Best overall based on testing
  }

  /**
   * Generate a floor plan using specified AI model
   * Always uses the Python Flask service on port 5000
   * @param {Object} requirements - Plot and room requirements
   * @param {string} model - Model to use (housediffusion, ce2eplan, graph2plan)
   * @returns {Object} Generated floor plan
   */
  async generateFloorPlan(requirements, model = this.defaultModel) {
    console.log(`[ModelService] Calling Flask at ${PYTHON_SERVICE_URL}/generate with model=${model}`);
    try {
      const response = await axios.post(`${PYTHON_SERVICE_URL}/generate`, {
        plot_width: requirements.plotWidth || 30,
        plot_depth: requirements.plotDepth || 50,
        model: model,
        vastu_preferences: requirements.vastuPreferences || {}
      }, {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      });
      console.log(`[ModelService] Flask response: ${response.status}`, response.data?.metrics);
      return {
        success: true,
        data: response.data,
        model: model,
        generation_time: response.data.metrics?.generation_time_seconds || 0
      };
    } catch (error) {
      console.error('[ModelService] Flask service error:', error.message);
      if (error.response) {
        console.error('[ModelService] Error response:', error.response.status, error.response.data);
      }
      throw new Error(`Failed to generate floor plan: ${error.message}. Make sure Flask service is running on port 5000.`);
    }
  }

  // Fallback removed - always use Python Flask service for real AI generation

  // adjustForRequirements removed - Flask service handles scaling

  // getSampleOutputs removed - no longer needed

  /**
   * Compare multiple models for the same requirements
   */
  async compareModels(requirements) {
    const results = [];
    
    for (const model of this.availableModels) {
      try {
        const result = await this.generateFloorPlan(requirements, model);
        results.push({
          model: model,
          result: result,
          success: result.success
        });
      } catch (error) {
        results.push({
          model: model,
          error: error.message,
          success: false
        });
      }
    }
    
    return {
      success: true,
      comparisons: results,
      recommendation: this.getBestModel(results)
    };
  }

  /**
   * Determine best model based on comparison results
   */
  getBestModel(results) {
    const successful = results.filter(r => r.success);
    if (successful.length === 0) return null;
    
    // Score based on our testing framework criteria
    const scores = successful.map(r => {
      const data = r.result.data;
      const metrics = data.metrics || {};
      
      // Simple scoring based on our test results
      let score = 0;
      
      // Efficiency score (30%)
      score += (metrics.efficiency || 0.7) * 30;
      
      // Generation time score (20%) - faster is better
      const time = metrics.generation_time_seconds || 3;
      score += Math.max(0, (5 - time) / 5) * 20;
      
      // Vastu compliance (30%)
      score += (metrics.vastu_compliance || 0) * 0.3;
      
      // Room count variety (20%)
      const roomCount = data.output?.rooms?.length || 0;
      score += Math.min(20, roomCount * 3);
      
      return { model: r.model, score };
    });
    
    scores.sort((a, b) => b.score - a.score);
    return scores[0];
  }

  /**
   * Analyze Vastu compliance of a generated plan
   */
  analyzeVastuCompliance(floorplan) {
    const rooms = floorplan.output?.rooms || [];
    const boundary = floorplan.input?.boundary || { width: 30, depth: 50 };
    
    const vastuRules = {
      master_bedroom: { direction: 'southwest', weight: 25 },
      kitchen: { direction: 'southeast', weight: 25 },
      living_room: { direction: ['north', 'east', 'northeast'], weight: 15 },
      bathroom: { direction: ['west', 'northwest'], weight: 15 },
      bedroom: { direction: ['south', 'west'], weight: 10 }
    };
    
    let score = 0;
    let maxScore = 0;
    const details = [];
    
    rooms.forEach(room => {
      const rule = vastuRules[room.type];
      if (!rule) return;
      
      maxScore += rule.weight;
      
      const centerX = (room.bbox.x1 + room.bbox.x2) / 2;
      const centerY = (room.bbox.y1 + room.bbox.y2) / 2;
      const direction = this.getDirection(centerX, centerY, boundary.width, boundary.depth);
      
      const allowedDirections = Array.isArray(rule.direction) ? rule.direction : [rule.direction];
      
      if (allowedDirections.includes(direction)) {
        score += rule.weight;
        details.push({ room: room.type, direction, status: 'pass' });
      } else {
        details.push({ room: room.type, direction, status: 'fail', expected: allowedDirections });
      }
    });
    
    return {
      score: score,
      maxScore: maxScore,
      percentage: maxScore > 0 ? (score / maxScore * 100) : 0,
      details: details
    };
  }

  /**
   * Determine direction based on coordinates
   */
  getDirection(x, y, width, depth) {
    const centerX = width / 2;
    const centerY = depth / 2;
    
    if (x < centerX && y < centerY) return 'northeast';
    if (x > centerX && y < centerY) return 'northwest';
    if (x < centerX && y > centerY) return 'southeast';
    if (x > centerX && y > centerY) return 'southwest';
    if (x < centerX) return 'north';
    if (x > centerX) return 'south';
    if (y < centerY) return 'east';
    return 'west';
  }

  /**
   * Convert model output to standard floor plan format
   */
  convertToStandardFormat(modelOutput) {
    const rooms = modelOutput.output?.rooms || [];
    const doors = modelOutput.output?.doors || [];
    const windows = modelOutput.output?.windows || [];
    
    // Convert to standard format used by the application
    const standardRooms = rooms.map(room => ({
      id: room.id,
      name: room.type,
      type: this.mapRoomType(room.type),
      x: room.bbox.x1,
      y: room.bbox.y1,
      width: room.bbox.x2 - room.bbox.x1,
      depth: room.bbox.y2 - room.bbox.y1,
      area: room.area_sqft,
      polygon: room.polygon
    }));
    
    const standardDoors = doors.map(door => ({
      from: door.from_room,
      to: door.to_room,
      x: door.position[0],
      y: door.position[1],
      width: door.width || 3
    }));
    
    const standardWindows = windows.map(win => ({
      room: win.room,
      wall: win.wall,
      x: win.position[0],
      y: win.position[1]
    }));
    
    return {
      rooms: standardRooms,
      doors: standardDoors,
      windows: standardWindows,
      boundary: modelOutput.input?.boundary,
      metadata: {
        model: modelOutput.model,
        generation_time: modelOutput.metrics?.generation_time_seconds,
        efficiency: modelOutput.metrics?.efficiency
      }
    };
  }

  /**
   * Map model room types to standard types
   */
  mapRoomType(modelType) {
    const typeMap = {
      living_room: 'living',
      kitchen: 'kitchen',
      master_bedroom: 'bedroom',
      bedroom: 'bedroom',
      bathroom: 'bathroom',
      dining_room: 'dining'
    };
    return typeMap[modelType] || modelType;
  }
}

module.exports = new ModelService();