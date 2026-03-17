const { planUtils } = require('../../shared/plan-schema');

/**
 * Vastu Shastra Compliance Service
 * Provides traditional Indian architectural guidelines and recommendations
 */
class VastuService {
  constructor() {
    this.vastuRules = {
      // Direction-based room placement
      roomDirections: {
        master_bedroom: ['southwest', 'west'],
        kitchen: ['southeast'],
        living_room: ['northeast', 'north'],
        dining: ['west', 'northwest'],
        study: ['northeast', 'north'],
        bathroom: ['northwest', 'west'],
        staircase: ['southwest', 'south'],
        prayer_room: ['northeast'],
        garage: ['southeast', 'south']
      },
      
      // Element associations
      elements: {
        northeast: 'water',
        southeast: 'fire', 
        southwest: 'earth',
        northwest: 'air',
        center: 'space'
      },
      
      // Auspicious directions
      auspiciousDirections: {
        main_entrance: ['north', 'east', 'northeast'],
        kitchen_stove: ['east', 'north'],
        bed_direction: ['south', 'west'],
        study_desk: ['east', 'north']
      }
    };
  }

  /**
   * Analyze Vastu compliance of a layout
   */
  analyzeVastuCompliance(layout) {
    const analysis = {
      overallScore: 0,
      compliance: [],
      violations: [],
      recommendations: []
    };

    // Analyze room directions
    layout.rooms.forEach(room => {
      const roomDirection = this.getRoomDirection(room, layout.plot);
      const auspiciousDirections = this.vastuRules.roomDirections[room.type] || [];
      
      if (auspiciousDirections.includes(roomDirection)) {
        analysis.compliance.push({
          room: room.label,
          direction: roomDirection,
          status: 'compliant',
          message: `${room.label} in ${roomDirection} is auspicious`
        });
      } else {
        analysis.violations.push({
          room: room.label,
          currentDirection: roomDirection,
          recommendedDirections: auspiciousDirections,
          issue: `${room.label} in ${roomDirection} is not ideal per Vastu`
        });
        
        analysis.recommendations.push({
          room: room.label,
          recommendation: `Consider placing ${room.label} in ${auspiciousDirections.join(' or ')} direction`
        });
      }
    });

    // Analyze main entrance
    const entranceDirection = this.getEntranceDirection(layout);
    const auspiciousEntrances = this.vastuRules.auspiciousDirections.main_entrance;
    
    if (auspiciousEntrances.includes(entranceDirection)) {
      analysis.compliance.push({
        room: 'Main Entrance',
        direction: entranceDirection,
        status: 'compliant',
        message: `Main entrance facing ${entranceDirection} is auspicious`
      });
    } else {
      analysis.violations.push({
        room: 'Main Entrance',
        currentDirection: entranceDirection,
        recommendedDirections: auspiciousEntrances,
        issue: `Main entrance facing ${entranceDirection} is not ideal`
      });
      
      analysis.recommendations.push({
        room: 'Main Entrance',
        recommendation: `Consider main entrance in ${auspiciousEntrances.join(' or ')} direction`
      });
    }

    // Calculate overall score
    const totalItems = analysis.compliance.length + analysis.violations.length;
    const complianceRate = totalItems > 0 ? (analysis.compliance.length / totalItems) * 100 : 100;
    analysis.overallScore = Math.round(complianceRate);

    return analysis;
  }

  /**
   * Get the direction of a room based on its position
   */
  getRoomDirection(room, plot) {
    const centerX = plot.width / 2;
    const centerY = plot.length / 2;
    const roomCenterX = room.x + room.width / 2;
    const roomCenterY = room.y + room.height / 2;

    const xDiff = roomCenterX - centerX;
    const yDiff = roomCenterY - centerY;

    // Determine quadrant
    if (xDiff >= 0 && yDiff >= 0) return 'southeast';
    if (xDiff <= 0 && yDiff >= 0) return 'southwest';
    if (xDiff <= 0 && yDiff <= 0) return 'northwest';
    if (xDiff >= 0 && yDiff <= 0) return 'northeast';

    // If on axes
    if (xDiff === 0) return yDiff >= 0 ? 'south' : 'north';
    if (yDiff === 0) return xDiff >= 0 ? 'east' : 'west';

    return 'center';
  }

  /**
   * Get main entrance direction
   */
  getEntranceDirection(layout) {
    // Assume main entrance is at the front (based on facing)
    return layout.plot.facing || 'north';
  }

  /**
   * Generate Vastu-compliant layout suggestions
   */
  generateVastuSuggestions(layout) {
    const suggestions = [];
    const analysis = this.analyzeVastuCompliance(layout);

    // Room repositioning suggestions
    analysis.violations.forEach(violation => {
      if (violation.room !== 'Main Entrance') {
        violation.recommendedDirections.forEach(direction => {
          suggestions.push({
            type: 'room_reposition',
            room: violation.room,
            fromDirection: violation.currentDirection,
            toDirection: direction,
            reason: `Vastu recommends ${violation.room} in ${direction} direction`,
            priority: this.getPriority(violation.room)
          });
        });
      }
    });

    // Element balance suggestions
    const elementBalance = this.analyzeElementBalance(layout);
    elementBalance.improvements.forEach(improvement => {
      suggestions.push({
        type: 'element_balance',
        ...improvement
      });
    });

    return {
      analysis,
      suggestions: suggestions.sort((a, b) => b.priority - a.priority)
    };
  }

  /**
   * Analyze element balance in the layout
   */
  analyzeElementBalance(layout) {
    const improvements = [];
    
    // Check if water element (northeast) is clean and uncluttered
    const northeastRooms = layout.rooms.filter(room => 
      this.getRoomDirection(room, layout.plot) === 'northeast'
    );

    if (northeastRooms.length === 0) {
      improvements.push({
        element: 'water',
        suggestion: 'Consider adding a water feature or light-colored room in Northeast',
        reason: 'Northeast represents water element and should be light and clean'
      });
    }

    // Check fire element (southeast) for kitchen
    const southeastRooms = layout.rooms.filter(room => 
      this.getRoomDirection(room, layout.plot) === 'southeast'
    );

    const hasKitchenInSE = southeastRooms.some(room => room.type === 'kitchen');
    if (!hasKitchenInSE) {
      improvements.push({
        element: 'fire',
        suggestion: 'Place kitchen in Southeast direction',
        reason: 'Southeast represents fire element, ideal for kitchen'
      });
    }

    // Check earth element (southwest) for stability
    const southwestRooms = layout.rooms.filter(room => 
      this.getRoomDirection(room, layout.plot) === 'southwest'
    );

    const hasMasterBedroomInSW = southwestRooms.some(room => room.type === 'master_bedroom');
    if (!hasMasterBedroomInSW) {
      improvements.push({
        element: 'earth',
        suggestion: 'Place master bedroom in Southwest direction',
        reason: 'Southwest represents earth element, ideal for master bedroom'
      });
    }

    return { improvements };
  }

  /**
   * Get priority level for Vastu suggestions
   */
  getPriority(roomType) {
    const priorities = {
      'kitchen': 10,
      'master_bedroom': 9,
      'main_entrance': 8,
      'living_room': 7,
      'prayer_room': 6,
      'study': 5,
      'bathroom': 4,
      'dining': 3,
      'garage': 2,
      'other': 1
    };
    return priorities[roomType] || 1;
  }

  /**
   * Apply Vastu corrections to layout
   */
  applyVastuCorrections(layout) {
    const correctedLayout = JSON.parse(JSON.stringify(layout));
    const suggestions = this.generateVastuSuggestions(layout);

    // Apply high-priority corrections
    suggestions.suggestions
      .filter(s => s.priority >= 7)
      .forEach(suggestion => {
        if (suggestion.type === 'room_reposition') {
          this.repositionRoom(correctedLayout, suggestion.room, suggestion.toDirection);
        }
      });

    return {
      layout: correctedLayout,
      appliedCorrections: suggestions.suggestions.filter(s => s.priority >= 7)
    };
  }

  /**
   * Reposition a room to a specific direction
   */
  repositionRoom(layout, roomName, targetDirection) {
    const room = layout.rooms.find(r => r.label === roomName);
    if (!room) return;

    // Calculate target position based on direction
    const plot = layout.plot;
    const centerX = plot.width / 2;
    const centerY = plot.length / 2;

    let targetX, targetY;

    switch (targetDirection) {
      case 'northeast':
        targetX = centerX + plot.width * 0.25;
        targetY = centerY - plot.length * 0.25;
        break;
      case 'southeast':
        targetX = centerX + plot.width * 0.25;
        targetY = centerY + plot.length * 0.25;
        break;
      case 'southwest':
        targetX = centerX - plot.width * 0.25;
        targetY = centerY + plot.length * 0.25;
        break;
      case 'northwest':
        targetX = centerX - plot.width * 0.25;
        targetY = centerY - plot.length * 0.25;
        break;
      default:
        return;
    }

    // Adjust position to fit within plot boundaries
    room.x = Math.max(0, Math.min(targetX - room.width / 2, plot.width - room.width));
    room.y = Math.max(0, Math.min(targetY - room.height / 2, plot.length - room.height));
  }
}

module.exports = new VastuService();