const { validatePlan, planUtils } = require('../../shared/plan-schema');
const geminiService = require('./geminiService');

/**
 * Multi-Floor Layout Generator
 * Creates complete multi-story building designs with floor coordination
 */
class MultiFloorGenerator {
  constructor() {
    this.floorTypes = {
      'ground': {
        name: 'Ground Floor',
        typicalRooms: ['living_room', 'dining', 'kitchen', 'guest_room', 'parking', 'staircase'],
        height: 10,
        loadBearing: true
      },
      'first': {
        name: 'First Floor',
        typicalRooms: ['bedrooms', 'master_bedroom', 'bathrooms', 'study', 'balcony'],
        height: 10,
        loadBearing: false
      },
      'second': {
        name: 'Second Floor',
        typicalRooms: ['bedrooms', 'terrace', 'prayer_room', 'additional_spaces'],
        height: 10,
        loadBearing: false
      },
      'basement': {
        name: 'Basement',
        typicalRooms: ['parking', 'storage', 'gym', 'entertainment'],
        height: 9,
        loadBearing: true
      }
    };
  }

  /**
   * Generate multi-floor layout
   */
  async generateMultiFloorLayout(plot, requirements, preferences = {}) {
    try {
      const floors = preferences.floors || 2;
      const buildingType = preferences.buildingType || 'residential';
      
      const multiFloorLayout = {
        plot: plot,
        floors: [],
        staircase: null,
        parking: null,
        metadata: {
          totalFloors: floors,
          buildingType: buildingType,
          totalHeight: 0,
          generatedAt: new Date().toISOString(),
          generator: 'multi-floor'
        }
      };

      // Generate each floor
      for (let i = 0; i < floors; i++) {
        const floorType = this.getFloorType(i, floors);
        const floorRequirements = this.getFloorRequirements(requirements, floorType, i);
        const floorPreferences = {
          ...preferences,
          floorNumber: i,
          floorType: floorType.type
        };

        const floorLayout = await this.generateSingleFloor(
          plot, 
          floorRequirements, 
          floorPreferences
        );

        floorLayout.floorNumber = i;
        floorLayout.floorType = floorType.type;
        floorLayout.floorName = floorType.name;
        floorLayout.height = floorType.height;

        multiFloorLayout.floors.push(floorLayout);
        multiFloorLayout.metadata.totalHeight += floorType.height;
      }

      // Generate staircase connecting all floors
      multiFloorLayout.staircase = this.generateStaircase(plot, floors);
      
      // Generate parking (typically ground floor or basement)
      if (preferences.parking?.enabled) {
        multiFloorLayout.parking = this.generateParking(plot, preferences.parking);
      }

      // Validate the complete multi-floor layout
      const validation = this.validateMultiFloorLayout(multiFloorLayout);
      
      return {
        layout: multiFloorLayout,
        validation: validation
      };

    } catch (error) {
      console.error('Multi-floor generation error:', error);
      throw new Error('Failed to generate multi-floor layout: ' + error.message);
    }
  }

  /**
   * Get floor type based on floor number and total floors
   */
  getFloorType(floorNumber, totalFloors) {
    if (floorNumber === 0) {
      return { type: 'ground', ...this.floorTypes.ground };
    } else if (floorNumber === totalFloors - 1) {
      return { type: 'top', ...this.floorTypes.second };
    } else {
      return { type: 'first', ...this.floorTypes.first };
    }
  }

  /**
   * Get requirements specific to each floor
   */
  getFloorRequirements(requirements, floorType, floorNumber) {
    const floorRequirements = { ...requirements };

    // Distribute rooms across floors based on typical usage
    if (floorType.type === 'ground') {
      // Ground floor: common areas and guest rooms
      floorRequirements.bedrooms = 0;
      floorRequirements.master_bedroom = false;
      floorRequirements.bathrooms = Math.min(1, requirements.bathrooms || 1);
      floorRequirements.study = 0;
      floorRequirements.balcony = false;
      floorRequirements.terrace = false;
    } else if (floorType.type === 'first') {
      // First floor: bedrooms and private areas
      floorRequirements.kitchen = 0;
      floorRequirements.dining = 0;
      floorRequirements.living_room = 0;
      floorRequirements.guest_room = 0;
      floorRequirements.balcony = requirements.balcony;
      floorRequirements.terrace = false;
    } else if (floorType.type === 'top') {
      // Top floor: terrace and additional spaces
      floorRequirements.kitchen = 0;
      floorRequirements.dining = 0;
      floorRequirements.living_room = 0;
      floorRequirements.balcony = false;
      floorRequirements.terrace = requirements.terrace;
    }

    return floorRequirements;
  }

  /**
   * Generate single floor layout
   */
  async generateSingleFloor(plot, requirements, preferences) {
    try {
      // Try AI generation first
      if (geminiService.isConfigured()) {
        const aiLayout = await geminiService.generateAIFloorPlans(
          plot, 
          requirements, 
          preferences, 
          1
        );
        
        if (aiLayout && aiLayout.length > 0) {
          return aiLayout[0];
        }
      }

      // Fallback to rule-based generation
      return this.generateRuleBasedFloor(plot, requirements, preferences);

    } catch (error) {
      console.error('Single floor generation error:', error);
      return this.generateRuleBasedFloor(plot, requirements, preferences);
    }
  }

  /**
   * Generate rule-based single floor
   */
  generateRuleBasedFloor(plot, requirements, preferences) {
    const floorLayout = {
      rooms: [],
      walls: [],
      doors: [],
      windows: [],
      dimensions: [],
      metadata: {
        floorNumber: preferences.floorNumber,
        floorType: preferences.floorType,
        generator: 'rule-based'
      }
    };

    // Generate rooms based on floor type and requirements
    const rooms = this.generateFloorRooms(plot, requirements, preferences);
    floorLayout.rooms = rooms;

    // Generate structural elements
    floorLayout.walls = this.generateFloorWalls(rooms, plot);
    floorLayout.doors = this.generateFloorDoors(rooms, plot);
    floorLayout.windows = this.generateFloorWindows(rooms, plot);
    floorLayout.dimensions = this.generateFloorDimensions(rooms, plot);

    return floorLayout;
  }

  /**
   * Generate rooms for a specific floor
   */
  generateFloorRooms(plot, requirements, preferences) {
    const rooms = [];
    let currentX = plot.setback.left;
    let currentY = plot.setback.back;

    // Generate rooms based on floor type
    if (preferences.floorType === 'ground') {
      // Ground floor layout
      if (requirements.living_room > 0) {
        rooms.push(this.createRoom('living_room', currentX, currentY, 14, 16, preferences.floorNumber));
        currentX += 16;
      }
      
      if (requirements.dining > 0) {
        rooms.push(this.createRoom('dining', currentX, currentY, 12, 10, preferences.floorNumber));
        currentX += 12;
      }
      
      if (requirements.kitchen > 0) {
        rooms.push(this.createRoom('kitchen', currentX, currentY, 10, 10, preferences.floorNumber));
      }

    } else if (preferences.floorType === 'first') {
      // First floor layout (bedrooms)
      let bedroomY = currentY;
      for (let i = 0; i < requirements.bedrooms; i++) {
        const isMaster = i === 0 && requirements.master_bedroom;
        const roomType = isMaster ? 'master_bedroom' : 'bedroom';
        const roomSize = isMaster ? { width: 12, height: 14 } : { width: 10, height: 10 };
        
        rooms.push(this.createRoom(roomType, currentX, bedroomY, roomSize.width, roomSize.height, preferences.floorNumber));
        bedroomY += roomSize.height + 2; // Corridor space
      }

      if (requirements.balcony) {
        rooms.push(this.createRoom('balcony', plot.setback.left, plot.setback.back - 6, 12, 6, preferences.floorNumber));
      }

    } else if (preferences.floorType === 'top') {
      // Top floor layout
      if (requirements.terrace) {
        rooms.push(this.createRoom('terrace', plot.setback.left, plot.setback.back, 20, 15, preferences.floorNumber));
      }
      
      if (requirements.prayer_room) {
        rooms.push(this.createRoom('prayer_room', currentX, currentY, 8, 8, preferences.floorNumber));
      }
    }

    return rooms;
  }

  /**
   * Create a room object for multi-floor layout
   */
  createRoom(type, x, y, width, height, floorNumber) {
    return {
      type: type,
      x: x,
      y: y,
      width: width,
      height: height,
      label: this.getRoomLabel(type),
      floor: floorNumber,
      elevation: floorNumber * 10 // 10 feet per floor
    };
  }

  /**
   * Generate floor-specific walls
   */
  generateFloorWalls(rooms, plot) {
    const walls = [];

    // Exterior walls
    walls.push(
      { x1: 0, y1: 0, x2: plot.width, y2: 0, thickness: 0.5, type: 'exterior' },
      { x1: 0, y1: plot.length, x2: plot.width, y2: plot.length, thickness: 0.5, type: 'exterior' },
      { x1: 0, y1: 0, x2: 0, y2: plot.length, thickness: 0.5, type: 'exterior' },
      { x1: plot.width, y1: 0, x2: plot.width, y2: plot.length, thickness: 0.5, type: 'exterior' }
    );

    // Interior walls
    rooms.forEach(room => {
      walls.push(
        { x1: room.x, y1: room.y, x2: room.x + room.width, y2: room.y, thickness: 0.3, type: 'interior' },
        { x1: room.x, y1: room.y + room.height, x2: room.x + room.width, y2: room.y + room.height, thickness: 0.3, type: 'interior' },
        { x1: room.x, y1: room.y, x2: room.x, y2: room.y + room.height, thickness: 0.3, type: 'interior' },
        { x1: room.x + room.width, y1: room.y, x2: room.x + room.width, y2: room.y + room.height, thickness: 0.3, type: 'interior' }
      );
    });

    return walls;
  }

  /**
   * Generate floor-specific doors
   */
  generateFloorDoors(rooms, plot) {
    const doors = [];

    // Main entrance
    doors.push({
      x: plot.width / 2 - 1.5,
      y: 0,
      width: 3,
      height: 7,
      orientation: 'vertical',
      type: 'main',
      floor: 0
    });

    // Room doors
    rooms.forEach(room => {
      doors.push({
        x: room.x - 1.5,
        y: room.y + room.height / 2 - 1.5,
        width: 3,
        height: 6,
        orientation: 'horizontal',
        type: 'room',
        floor: room.floor
      });
    });

    return doors;
  }

  /**
   * Generate floor-specific windows
   */
  generateFloorWindows(rooms, plot) {
    const windows = [];

    rooms.forEach(room => {
      if (room.x === 0 || room.x + room.width === plot.width) {
        windows.push({
          x: room.x + room.width / 2 - 2,
          y: room.y + 2,
          width: 4,
          height: 4,
          orientation: 'vertical',
          floor: room.floor
        });
      }
    });

    return windows;
  }

  /**
   * Generate floor-specific dimensions
   */
  generateFloorDimensions(rooms, plot) {
    const dimensions = [];

    // Plot dimensions
    dimensions.push({
      type: 'length',
      value: `${plot.length}'`,
      position: { x: plot.width + 2, y: plot.length / 2 }
    });

    dimensions.push({
      type: 'width',
      value: `${plot.width}'`,
      position: { x: plot.width / 2, y: -2 }
    });

    // Room dimensions
    rooms.forEach(room => {
      dimensions.push({
        type: 'room',
        value: `${room.width}' x ${room.height}'`,
        position: { x: room.x + room.width / 2, y: room.y + room.height / 2 },
        floor: room.floor
      });
    });

    return dimensions;
  }

  /**
   * Generate staircase connecting all floors
   */
  generateStaircase(plot, totalFloors) {
    return {
      x: plot.width - 8,
      y: plot.length - 12,
      width: 4,
      height: 8,
      direction: 'up',
      type: 'straight',
      totalFloors: totalFloors,
      risers: totalFloors * 12, // 12 risers per floor
      treadWidth: 1,
      totalRise: totalFloors * 10 // 10 feet per floor
    };
  }

  /**
   * Generate parking structure
   */
  generateParking(plot, parkingPrefs) {
    return {
      x: 0,
      y: plot.length,
      width: 8 * (parkingPrefs.cars || 2),
      height: 16,
      cars: parkingPrefs.cars || 2,
      type: parkingPrefs.type || 'open',
      covered: parkingPrefs.type === 'covered'
    };
  }

  /**
   * Validate multi-floor layout
   */
  validateMultiFloorLayout(multiFloorLayout) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    // Check floor alignment
    const groundFloor = multiFloorLayout.floors[0];
    const otherFloors = multiFloorLayout.floors.slice(1);

    otherFloors.forEach((floor, index) => {
      // Check if upper floors extend beyond ground floor
      floor.rooms.forEach(room => {
        if (room.x < groundFloor.rooms[0]?.x || 
            room.x + room.width > groundFloor.rooms[0]?.x + groundFloor.rooms[0]?.width) {
          validation.warnings.push(`Floor ${index + 1} room extends beyond ground floor boundary`);
        }
      });
    });

    // Check staircase alignment
    if (multiFloorLayout.staircase) {
      otherFloors.forEach((floor, index) => {
        const staircaseOnFloor = floor.rooms.find(r => r.type === 'staircase');
        if (!staircaseOnFloor) {
          validation.warnings.push(`Floor ${index + 1} missing staircase connection`);
        }
      });
    }

    // Check structural integrity
    const totalLoad = this.calculateTotalLoad(multiFloorLayout);
    const foundationCapacity = plot.width * plot.length * 100; // Simplified calculation

    if (totalLoad > foundationCapacity) {
      validation.errors.push('Total building load exceeds foundation capacity');
      validation.isValid = false;
    }

    return validation;
  }

  /**
   * Calculate total structural load
   */
  calculateTotalLoad(multiFloorLayout) {
    let totalLoad = 0;

    multiFloorLayout.floors.forEach(floor => {
      // Simplified load calculation
      const floorArea = floor.rooms.reduce((sum, room) => sum + (room.width * room.height), 0);
      const floorLoad = floorArea * 50; // 50 lbs per sq ft
      totalLoad += floorLoad;
    });

    return totalLoad;
  }

  /**
   * Get room label
   */
  getRoomLabel(type) {
    const labels = {
      living_room: 'Living Room',
      bedroom: 'Bedroom',
      master_bedroom: 'Master Bedroom',
      kitchen: 'Kitchen',
      dining: 'Dining',
      bathroom: 'Bathroom',
      study: 'Study',
      balcony: 'Balcony',
      terrace: 'Terrace',
      prayer_room: 'Prayer Room',
      staircase: 'Staircase',
      parking: 'Parking'
    };
    return labels[type] || type;
  }
}

module.exports = new MultiFloorGenerator();