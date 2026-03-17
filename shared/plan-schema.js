// Plan Schema Definition for AutoArchitect
// This defines the structure for floor plan data

const planSchema = {
  plot: {
    type: 'object',
    required: ['width', 'length', 'facing'],
    properties: {
      width: { type: 'number', minimum: 10, maximum: 200 },
      length: { type: 'number', minimum: 10, maximum: 300 },
      facing: { 
        type: 'string', 
        enum: ['north', 'south', 'east', 'west'] 
      },
      setback: {
        type: 'object',
        properties: {
          front: { type: 'number', default: 6 },
          back: { type: 'number', default: 4 },
          left: { type: 'number', default: 4 },
          right: { type: 'number', default: 4 }
        }
      }
    }
  },

  rooms: {
    type: 'array',
    items: {
      type: 'object',
      required: ['type', 'x', 'y', 'width', 'height'],
      properties: {
        type: {
          type: 'string',
          enum: [
            'living_room', 'bedroom', 'kitchen', 'dining', 'bathroom',
            'master_bedroom', 'guest_room', 'study', 'balcony', 'terrace'
          ]
        },
        x: { type: 'number' },
        y: { type: 'number' },
        width: { type: 'number', minimum: 5 },
        height: { type: 'number', minimum: 5 },
        label: { type: 'string' },
        floor: { type: 'number', default: 1 }
      }
    }
  },

  walls: {
    type: 'array',
    items: {
      type: 'object',
      required: ['x1', 'y1', 'x2', 'y2'],
      properties: {
        x1: { type: 'number' },
        y1: { type: 'number' },
        x2: { type: 'number' },
        y2: { type: 'number' },
        thickness: { type: 'number', default: 0.3 },
        type: {
          type: 'string',
          enum: ['exterior', 'interior', 'partition']
        }
      }
    }
  },

  doors: {
    type: 'array',
    items: {
      type: 'object',
      required: ['x', 'y', 'width', 'height'],
      properties: {
        x: { type: 'number' },
        y: { type: 'number' },
        width: { type: 'number', default: 3 },
        height: { type: 'number', default: 7 },
        orientation: {
          type: 'string',
          enum: ['horizontal', 'vertical']
        },
        type: {
          type: 'string',
          enum: ['main', 'room', 'bathroom', 'sliding']
        }
      }
    }
  },

  windows: {
    type: 'array',
    items: {
      type: 'object',
      required: ['x', 'y', 'width', 'height'],
      properties: {
        x: { type: 'number' },
        y: { type: 'number' },
        width: { type: 'number', minimum: 2 },
        height: { type: 'number', minimum: 2 },
        orientation: {
          type: 'string',
          enum: ['horizontal', 'vertical']
        }
      }
    }
  },

  staircase: {
    type: 'object',
    properties: {
      x: { type: 'number' },
      y: { type: 'number' },
      width: { type: 'number', minimum: 3 },
      height: { type: 'number', minimum: 6 },
      direction: {
        type: 'string',
        enum: ['up', 'down', 'both']
      },
      type: {
        type: 'string',
        enum: ['straight', 'L-shaped', 'spiral', 'U-shaped']
      }
    }
  },

  parking: {
    type: 'object',
    properties: {
      x: { type: 'number' },
      y: { type: 'number' },
      width: { type: 'number', minimum: 8 },
      height: { type: 'number', minimum: 16 },
      cars: { type: 'number', minimum: 1 },
      type: {
        type: 'string',
        enum: ['open', 'covered', 'basement']
      }
    }
  },

  dimensions: {
    type: 'array',
    items: {
      type: 'object',
      required: ['type', 'value', 'position'],
      properties: {
        type: {
          type: 'string',
          enum: ['length', 'width', 'height', 'room']
        },
        value: { type: 'number' },
        position: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' }
          }
        }
      }
    }
  },

  metadata: {
    type: 'object',
    properties: {
      version: { type: 'number', default: 1 },
      generatedAt: { type: 'string', format: 'date-time' },
      generator: { type: 'string' },
      constraints: {
        type: 'object',
        properties: {
          minRoomSize: { type: 'object' },
          maxRooms: { type: 'number' },
          setbacks: { type: 'object' }
        }
      }
    }
  }
};

// Validation function for plan data
function validatePlan(planData) {
  const errors = [];
  
  // Check required properties
  if (!planData.plot) errors.push('Plot information is required');
  if (!planData.rooms || !Array.isArray(planData.rooms)) errors.push('Rooms array is required');
  if (!planData.walls || !Array.isArray(planData.walls)) errors.push('Walls array is required');
  
  // Validate plot
  if (planData.plot) {
    if (!planData.plot.width || planData.plot.width < 10) errors.push('Plot width must be at least 10 feet');
    if (!planData.plot.length || planData.plot.length < 10) errors.push('Plot length must be at least 10 feet');
    if (!['north', 'south', 'east', 'west'].includes(planData.plot.facing)) errors.push('Invalid plot facing direction');
  }
  
  // Validate rooms
  if (planData.rooms) {
    planData.rooms.forEach((room, index) => {
      if (!room.type) errors.push(`Room ${index}: Type is required`);
      if (!room.x || !room.y) errors.push(`Room ${index}: Position (x, y) is required`);
      if (!room.width || room.width < 5) errors.push(`Room ${index}: Width must be at least 5 feet`);
      if (!room.height || room.height < 5) errors.push(`Room ${index}: Height must be at least 5 feet`);
    });
  }
  
  // Validate walls
  if (planData.walls) {
    planData.walls.forEach((wall, index) => {
      if (typeof wall.x1 !== 'number' || typeof wall.y1 !== 'number' || 
          typeof wall.x2 !== 'number' || typeof wall.y2 !== 'number') {
        errors.push(`Wall ${index}: Invalid coordinates`);
      }
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Utility functions for plan manipulation
const planUtils = {
  // Calculate total built-up area
  calculateBuiltUpArea(planData) {
    if (!planData.rooms) return 0;
    return planData.rooms.reduce((total, room) => total + (room.width * room.height), 0);
  },
  
  // Calculate plot utilization percentage
  calculateUtilization(planData) {
    if (!planData.plot || !planData.rooms) return 0;
    const plotArea = planData.plot.width * planData.plot.length;
    const builtUpArea = this.calculateBuiltUpArea(planData);
    return (builtUpArea / plotArea) * 100;
  },
  
  // Get room by type
  getRoomsByType(planData, roomType) {
    if (!planData.rooms) return [];
    return planData.rooms.filter(room => room.type === roomType);
  },
  
  // Get total number of rooms
  getTotalRooms(planData) {
    if (!planData.rooms) return 0;
    return planData.rooms.length;
  },
  
  // Check if plan has specific features
  hasFeature(planData, feature) {
    switch (feature) {
      case 'parking':
        return !!planData.parking;
      case 'staircase':
        return !!planData.staircase;
      case 'balcony':
        return planData.rooms && planData.rooms.some(room => room.type === 'balcony');
      default:
        return false;
    }
  }
};

module.exports = {
  planSchema,
  validatePlan,
  planUtils
};