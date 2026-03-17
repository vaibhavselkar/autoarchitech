const { validatePlan, planUtils } = require('../../shared/plan-schema');
const geminiService = require('./geminiService');

// Minimum room size standards (in feet)
const MIN_ROOM_SIZES = {
  bedroom: { width: 10, height: 10 },
  master_bedroom: { width: 12, height: 14 },
  guest_room: { width: 10, height: 10 },
  living_room: { width: 12, height: 14 },
  kitchen: { width: 8, height: 10 },
  dining: { width: 10, height: 10 },
  bathroom: { width: 5, height: 7 },
  study: { width: 8, height: 10 },
  balcony: { width: 4, height: 6 },
  terrace: { width: 8, height: 8 }
};

// Room adjacency rules
const ROOM_ADJACENCY_RULES = {
  kitchen: ['dining'],
  bathroom: ['bedroom', 'master_bedroom'],
  dining: ['kitchen', 'living_room'],
  living_room: ['entrance'],
  master_bedroom: ['bathroom'],
  guest_room: ['bathroom']
};

// Corridor and clearance standards
const STANDARDS = {
  corridor_width: 3,
  wall_thickness: 0.3,
  door_width: 3,
  door_height: 7,
  window_min_width: 2,
  window_min_height: 2,
  parking_width: 8,
  parking_length: 16
};

/**
 * Generate a floor plan layout based on plot constraints and requirements
 * @param {Object} plot - Plot dimensions and facing
 * @param {Object} requirements - Room requirements
 * @param {Object} preferences - User preferences
 * @param {number} variations - Number of layout variations to generate
 * @returns {Object} Generated layout
 */
async function generateLayout(plot, requirements, preferences = {}, variations = 5) {
  try {
    // First, try to generate AI-enhanced layouts using Gemini
    if (geminiService.isConfigured()) {
      console.log('Using Gemini AI for enhanced floor plan generation...');
      const aiLayouts = await geminiService.generateAIFloorPlans(plot, requirements, preferences, variations);
      
      if (aiLayouts && aiLayouts.length > 0) {
        console.log(`Generated ${aiLayouts.length} AI-enhanced layouts`);
        return aiLayouts[0]; // Return the first AI-generated layout
      }
    }

    // Fallback to rule-based generation
    console.log('Using rule-based generation as fallback...');
    const plotData = parsePlotData(plot);
    const roomRequirements = parseRoomRequirements(requirements);
    
    // Calculate buildable area after setbacks
    const buildableArea = calculateBuildableArea(plotData);
    
    // Generate initial room layout
    const rooms = generateRoomsLayout(roomRequirements, buildableArea, plotData);
    
    // Generate walls based on room layout
    const walls = generateWalls(rooms, plotData);
    
    // Place doors and windows
    const { doors, windows } = placeDoorsAndWindows(rooms, walls, plotData);
    
    // Place staircase
    const staircase = placeStaircase(plotData, rooms);
    
    // Place parking
    const parking = placeParking(plotData, preferences.parking);
    
    // Generate dimensions
    const dimensions = generateDimensions(rooms, walls, plotData);
    
    // Create final layout
    const layout = {
      plot: plotData,
      rooms,
      walls,
      doors,
      windows,
      staircase,
      parking,
      dimensions,
      metadata: {
        version: 1,
        generatedAt: new Date().toISOString(),
        generator: geminiService.isConfigured() ? 'ai-enhanced' : 'constraint-based',
        constraints: {
          minRoomSize: MIN_ROOM_SIZES,
          setbacks: plotData.setback
        }
      }
    };
    
    // Validate the generated layout
    const validation = validatePlan(layout);
    if (!validation.isValid) {
      console.warn('Generated layout validation warnings:', validation.errors);
    }
    
    return layout;
    
  } catch (error) {
    console.error('Layout generation error:', error);
    throw new Error('Failed to generate layout: ' + error.message);
  }
}

/**
 * Generate multiple layout variations using AI and rule-based methods
 * @param {Object} plot - Plot dimensions and facing
 * @param {Object} requirements - Room requirements
 * @param {Object} preferences - User preferences
 * @param {number} variations - Number of variations to generate
 * @returns {Array} Array of generated layouts
 */
async function generateLayoutVariations(plot, requirements, preferences = {}, variations = 5) {
  try {
    const layouts = [];
    
    // Try AI generation first
    if (geminiService.isConfigured()) {
      console.log(`Generating ${variations} AI-enhanced layout variations...`);
      const aiLayouts = await geminiService.generateAIFloorPlans(plot, requirements, preferences, variations);
      
      if (aiLayouts && aiLayouts.length > 0) {
        layouts.push(...aiLayouts);
        console.log(`Generated ${aiLayouts.length} AI layouts`);
      }
    }

    // Fill remaining variations with rule-based generation
    const remainingVariations = variations - layouts.length;
    if (remainingVariations > 0) {
      console.log(`Generating ${remainingVariations} rule-based layout variations...`);
      
      for (let i = 0; i < remainingVariations; i++) {
        // Add slight variations to the rule-based generation
        const variedPreferences = {
          ...preferences,
          // Add some randomness to create variations
          balcony: Math.random() > 0.5,
          study: Math.random() > 0.7 ? 0 : preferences.study || 0
        };
        
        const layout = await generateLayout(plot, requirements, variedPreferences);
        layouts.push(layout);
      }
    }

    // Ensure we have the requested number of variations
    while (layouts.length < variations) {
      const layout = await generateLayout(plot, requirements, preferences);
      layouts.push(layout);
    }

    return layouts.slice(0, variations);
    
  } catch (error) {
    console.error('Layout variations generation error:', error);
    throw new Error('Failed to generate layout variations: ' + error.message);
  }
}

/**
 * Parse plot data and apply defaults
 */
function parsePlotData(plot) {
  return {
    width: parseFloat(plot.width),
    length: parseFloat(plot.length),
    facing: plot.facing.toLowerCase(),
    setback: {
      front: parseFloat(plot.setback?.front || 6),
      back: parseFloat(plot.setback?.back || 4),
      left: parseFloat(plot.setback?.left || 4),
      right: parseFloat(plot.setback?.right || 4)
    }
  };
}

/**
 * Parse room requirements and apply defaults
 */
function parseRoomRequirements(requirements) {
  return {
    bedrooms: parseInt(requirements.bedrooms || 2),
    master_bedroom: requirements.master_bedroom !== false,
    kitchen: parseInt(requirements.kitchen || 1),
    dining: parseInt(requirements.dining || 1),
    living_room: parseInt(requirements.living_room || 1),
    bathrooms: parseInt(requirements.bathrooms || 2),
    study: parseInt(requirements.study || 0),
    balcony: requirements.balcony !== false,
    terrace: requirements.terrace || false
  };
}

/**
 * Calculate buildable area after applying setbacks
 */
function calculateBuildableArea(plot) {
  const buildableWidth = plot.width - plot.setback.left - plot.setback.right;
  const buildableLength = plot.length - plot.setback.front - plot.setback.back;
  
  return {
    x: plot.setback.left,
    y: plot.setback.back,
    width: Math.max(0, buildableWidth),
    length: Math.max(0, buildableLength)
  };
}

/**
 * Generate room layout using constraint-based algorithm
 */
function generateRoomsLayout(requirements, buildableArea, plot) {
  const rooms = [];
  let currentX = buildableArea.x;
  let currentY = buildableArea.y;
  
  // Calculate total required area
  const totalArea = calculateTotalRequiredArea(requirements);
  const buildableAreaTotal = buildableArea.width * buildableArea.length;
  
  if (totalArea > buildableAreaTotal * 0.8) {
    throw new Error('Requirements exceed available buildable area');
  }
  
  // Place living room (near entrance)
  if (requirements.living_room > 0) {
    const livingRoom = createRoom('living_room', currentX, currentY, 14, 16);
    rooms.push(livingRoom);
    currentX += livingRoom.width + STANDARDS.corridor_width;
  }
  
  // Place dining room (adjacent to kitchen)
  if (requirements.dining > 0) {
    const dining = createRoom('dining', currentX, currentY, 12, 10);
    rooms.push(dining);
    currentX += dining.width + STANDARDS.corridor_width;
  }
  
  // Place kitchen (adjacent to dining)
  if (requirements.kitchen > 0) {
    const kitchen = createRoom('kitchen', currentX, currentY, 10, 10);
    rooms.push(kitchen);
    currentX += kitchen.width + STANDARDS.corridor_width;
  }
  
  // Place bedrooms
  let bedroomY = currentY + 18; // Below main rooms
  for (let i = 0; i < requirements.bedrooms; i++) {
    const isMaster = i === 0 && requirements.master_bedroom;
    const roomType = isMaster ? 'master_bedroom' : 'bedroom';
    const roomSize = MIN_ROOM_SIZES[roomType];
    
    const bedroom = createRoom(roomType, currentX, bedroomY, roomSize.width, roomSize.height);
    rooms.push(bedroom);
    currentX += bedroom.width + STANDARDS.corridor_width;
    
    // Add bathroom adjacent to bedroom
    if (i < requirements.bathrooms) {
      const bathroom = createRoom('bathroom', currentX, bedroomY, 7, 8);
      rooms.push(bathroom);
      currentX += bathroom.width + STANDARDS.corridor_width;
    }
  }
  
  // Place study if required
  if (requirements.study > 0) {
    const study = createRoom('study', currentX, currentY, 10, 10);
    rooms.push(study);
    currentX += study.width + STANDARDS.corridor_width;
  }
  
  // Place balcony if required
  if (requirements.balcony) {
    const balcony = createRoom('balcony', buildableArea.x, buildableArea.y - 6, 12, 6);
    rooms.push(balcony);
  }
  
  // Adjust positions to fit within buildable area
  return adjustRoomPositions(rooms, buildableArea, plot);
}

/**
 * Create a room object
 */
function createRoom(type, x, y, width, height) {
  return {
    type,
    x,
    y,
    width,
    height,
    label: getRoomLabel(type),
    floor: 1
  };
}

/**
 * Get room label based on type
 */
function getRoomLabel(type) {
  const labels = {
    living_room: 'Living Room',
    bedroom: 'Bedroom',
    master_bedroom: 'Master Bedroom',
    kitchen: 'Kitchen',
    dining: 'Dining',
    bathroom: 'Bathroom',
    study: 'Study',
    balcony: 'Balcony',
    terrace: 'Terrace'
  };
  return labels[type] || type;
}

/**
 * Calculate total required area for all rooms
 */
function calculateTotalRequiredArea(requirements) {
  let totalArea = 0;
  
  // Living room
  totalArea += MIN_ROOM_SIZES.living_room.width * MIN_ROOM_SIZES.living_room.height;
  
  // Dining
  totalArea += MIN_ROOM_SIZES.dining.width * MIN_ROOM_SIZES.dining.height;
  
  // Kitchen
  totalArea += MIN_ROOM_SIZES.kitchen.width * MIN_ROOM_SIZES.kitchen.height;
  
  // Bedrooms
  const bedroomArea = MIN_ROOM_SIZES.bedroom.width * MIN_ROOM_SIZES.bedroom.height;
  const masterBedroomArea = MIN_ROOM_SIZES.master_bedroom.width * MIN_ROOM_SIZES.master_bedroom.height;
  totalArea += requirements.bedrooms * bedroomArea;
  if (requirements.master_bedroom) {
    totalArea += masterBedroomArea - bedroomArea; // Additional area for master
  }
  
  // Bathrooms
  const bathroomArea = MIN_ROOM_SIZES.bathroom.width * MIN_ROOM_SIZES.bathroom.height;
  totalArea += requirements.bathrooms * bathroomArea;
  
  // Study
  if (requirements.study > 0) {
    totalArea += MIN_ROOM_SIZES.study.width * MIN_ROOM_SIZES.study.height;
  }
  
  // Balcony
  if (requirements.balcony) {
    totalArea += MIN_ROOM_SIZES.balcony.width * MIN_ROOM_SIZES.balcony.height;
  }
  
  return totalArea;
}

/**
 * Adjust room positions to fit within buildable area
 */
function adjustRoomPositions(rooms, buildableArea, plot) {
  // Simple adjustment - ensure rooms don't exceed buildable area
  return rooms.map(room => {
    // Ensure room fits within buildable area
    const maxX = buildableArea.x + buildableArea.width - room.width;
    const maxY = buildableArea.y + buildableArea.length - room.height;
    
    return {
      ...room,
      x: Math.max(buildableArea.x, Math.min(room.x, maxX)),
      y: Math.max(buildableArea.y, Math.min(room.y, maxY))
    };
  });
}

/**
 * Generate walls based on room layout
 */
function generateWalls(rooms, plot) {
  const walls = [];
  
  // Generate exterior walls (plot boundary)
  walls.push(
    // Front wall
    { x1: 0, y1: 0, x2: plot.width, y2: 0, thickness: 0.5, type: 'exterior' },
    // Back wall
    { x1: 0, y1: plot.length, x2: plot.width, y2: plot.length, thickness: 0.5, type: 'exterior' },
    // Left wall
    { x1: 0, y1: 0, x2: 0, y2: plot.length, thickness: 0.5, type: 'exterior' },
    // Right wall
    { x1: plot.width, y1: 0, x2: plot.width, y2: plot.length, thickness: 0.5, type: 'exterior' }
  );
  
  // Generate interior walls based on room boundaries
  rooms.forEach(room => {
    // Top wall
    walls.push({
      x1: room.x, y1: room.y, x2: room.x + room.width, y2: room.y,
      thickness: STANDARDS.wall_thickness, type: 'interior'
    });
    
    // Bottom wall
    walls.push({
      x1: room.x, y1: room.y + room.height, x2: room.x + room.width, y2: room.y + room.height,
      thickness: STANDARDS.wall_thickness, type: 'interior'
    });
    
    // Left wall
    walls.push({
      x1: room.x, y1: room.y, x2: room.x, y2: room.y + room.height,
      thickness: STANDARDS.wall_thickness, type: 'interior'
    });
    
    // Right wall
    walls.push({
      x1: room.x + room.width, y1: room.y, x2: room.x + room.width, y2: room.y + room.height,
      thickness: STANDARDS.wall_thickness, type: 'interior'
    });
  });
  
  return walls;
}

/**
 * Place doors and windows
 */
function placeDoorsAndWindows(rooms, walls, plot) {
  const doors = [];
  const windows = [];
  
  // Place main entrance door
  doors.push({
    x: plot.width / 2 - 1.5,
    y: 0,
    width: 3,
    height: 7,
    orientation: 'vertical',
    type: 'main'
  });
  
  // Place room doors
  rooms.forEach(room => {
    // Place door at center of left wall
    doors.push({
      x: room.x - 1.5,
      y: room.y + room.height / 2 - 1.5,
      width: 3,
      height: 6,
      orientation: 'horizontal',
      type: 'room'
    });
  });
  
  // Place windows
  rooms.forEach(room => {
    // Place window on exterior walls
    if (room.x === 0 || room.x + room.width === plot.width) {
      windows.push({
        x: room.x + room.width / 2 - 2,
        y: room.y + 2,
        width: 4,
        height: 4,
        orientation: 'vertical'
      });
    }
  });
  
  return { doors, windows };
}

/**
 * Place staircase
 */
function placeStaircase(plot, rooms) {
  // Place staircase near entrance or in a corner
  return {
    x: plot.width - 6,
    y: plot.length - 8,
    width: 4,
    height: 8,
    direction: 'up',
    type: 'straight'
  };
}

/**
 * Place parking
 */
function placeParking(plot, parkingPrefs) {
  if (!parkingPrefs || !parkingPrefs.enabled) return null;
  
  return {
    x: 0,
    y: plot.length,
    width: STANDARDS.parking_width,
    height: STANDARDS.parking_length,
    cars: parkingPrefs.cars || 1,
    type: parkingPrefs.type || 'open'
  };
}

/**
 * Generate dimension labels
 */
function generateDimensions(rooms, walls, plot) {
  const dimensions = [];
  
  // Plot dimensions
  dimensions.push({
    type: 'length',
    value: plot.length,
    position: { x: plot.width + 2, y: plot.length / 2 }
  });
  
  dimensions.push({
    type: 'width',
    value: plot.width,
    position: { x: plot.width / 2, y: -2 }
  });
  
  // Room dimensions
  rooms.forEach(room => {
    dimensions.push({
      type: 'room',
      value: `${room.width}' x ${room.height}'`,
      position: { x: room.x + room.width / 2, y: room.y + room.height / 2 }
    });
  });
  
  return dimensions;
}

module.exports = {
  generateLayout,
  MIN_ROOM_SIZES,
  ROOM_ADJACENCY_RULES,
  STANDARDS
};