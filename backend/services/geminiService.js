const { GoogleGenerativeAI } = require('@google/generative-ai');
const { planUtils } = require('../../shared/plan-schema');

/**
 * Gemini AI Service for advanced floor plan generation and design enhancement
 * Uses Google's Gemini API for architectural design intelligence
 */
class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.modelName = 'gemini-pro';
    this.visionModelName = 'gemini-pro-vision';
    
    if (this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({ model: this.modelName });
    }
  }

  /**
   * Check if Gemini is configured
   */
  isConfigured() {
    return !!this.apiKey && !!this.genAI;
  }

  /**
   * Generate enhanced floor plans using Gemini AI
   * @param {Object} plot - Plot dimensions and constraints
   * @param {Object} requirements - Room requirements
   * @param {Object} preferences - User preferences
   * @param {number} variations - Number of variations to generate
   * @returns {Promise<Array>} Enhanced layouts
   */
  async generateAIFloorPlans(plot, requirements, preferences, variations = 5) {
    if (!this.isConfigured()) {
      console.log('Gemini AI not configured, using rule-based generation');
      return null;
    }

    try {
      const prompt = this.createGenerationPrompt(plot, requirements, preferences, variations);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse the AI-generated layouts
      return this.parseAIGeneratedLayouts(text, plot, requirements);
      
    } catch (error) {
      console.error('Gemini AI generation failed:', error);
      return null;
    }
  }

  /**
   * Refine existing layout with AI suggestions
   * @param {Object} layout - Current layout
   * @param {Object} requirements - User requirements
   * @returns {Promise<Object>} Refined layout
   */
  async refineLayoutWithGemini(layout, requirements) {
    if (!this.isConfigured()) {
      return layout;
    }

    try {
      const prompt = this.createRefinementPrompt(layout, requirements);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const suggestions = response.text();

      return this.applyGeminiSuggestions(layout, suggestions);
      
    } catch (error) {
      console.error('Gemini AI refinement failed:', error);
      return layout;
    }
  }

  /**
   * Analyze layout quality and provide AI recommendations
   * @param {Object} layout - Floor plan layout
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeLayoutQuality(layout) {
    if (!this.isConfigured()) {
      return this.getBasicAnalysis(layout);
    }

    try {
      const prompt = this.createAnalysisPrompt(layout);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const analysis = response.text();

      return this.parseQualityAnalysis(analysis, layout);
      
    } catch (error) {
      console.error('Gemini AI analysis failed:', error);
      return this.getBasicAnalysis(layout);
    }
  }

  /**
   * Generate design concepts and styles
   * @param {Object} requirements - User requirements
   * @param {Object} preferences - User preferences
   * @returns {Promise<Array>} Design concepts
   */
  async generateDesignConcepts(requirements, preferences) {
    if (!this.isConfigured()) {
      return this.getDefaultConcepts(requirements, preferences);
    }

    try {
      const prompt = this.createConceptPrompt(requirements, preferences);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const concepts = response.text();

      return this.parseDesignConcepts(concepts);
      
    } catch (error) {
      console.error('Gemini AI concepts failed:', error);
      return this.getDefaultConcepts(requirements, preferences);
    }
  }

  /**
   * Create prompt for floor plan generation
   */
  createGenerationPrompt(plot, requirements, preferences, variations) {
    const plotDetails = `
Plot Information:
- Size: ${plot.width}' x ${plot.length}'
- Facing: ${plot.facing}
- Setbacks: Front ${plot.setback?.front || 6}', Back ${plot.setback?.back || 4}', Sides ${plot.setback?.left || 4}'`;

    const roomRequirements = `
Room Requirements:
${this.formatRequirements(requirements)}`;

    const userPreferences = `
User Preferences:
${this.formatPreferences(preferences)}`;

    return `
You are an expert AI architect and interior designer. Generate ${variations} innovative and practical floor plan concepts for a residential building.

${plotDetails}

${roomRequirements}

${userPreferences}

Please provide detailed floor plan descriptions including:
1. Room layout and positioning
2. Flow and circulation patterns
3. Natural light optimization
4. Space utilization efficiency
5. Architectural style elements
6. Functional zoning

For each concept, provide:
- Overall layout strategy
- Room-by-room specifications (dimensions, positioning)
- Key design features
- Space optimization techniques
- Architectural highlights

Focus on creating modern, functional, and aesthetically pleasing designs that maximize the available space while maintaining architectural integrity and user comfort.
`;
  }

  /**
   * Create prompt for layout refinement
   */
  createRefinementPrompt(layout, requirements) {
    const currentLayout = `
Current Layout Analysis:
- Plot: ${layout.plot.width}' x ${layout.plot.length}' facing ${layout.plot.facing}
- Total Rooms: ${layout.rooms.length}
- Room Breakdown: ${layout.rooms.map(r => `${r.type}: ${r.width}'x${r.height}'`).join(', ')}
- Space Utilization: ${planUtils.calculateUtilization(layout).toFixed(1)}%`;

    const requirementsText = `
User Requirements:
${this.formatRequirements(requirements)}`;

    return `
You are an expert architect. Analyze and improve this floor plan layout:

${currentLayout}

${requirementsText}

Please provide specific improvements for:
1. Room placement optimization
2. Traffic flow enhancement
3. Natural light and ventilation improvements
4. Space utilization efficiency
5. Architectural harmony
6. Functional layout adjustments

Provide actionable suggestions with specific measurements and positioning changes. Focus on practical, buildable improvements that enhance both functionality and aesthetic appeal.
`;
  }

  /**
   * Create prompt for layout quality analysis
   */
  createAnalysisPrompt(layout) {
    const layoutDetails = `
Layout Analysis:
- Plot Size: ${layout.plot.width}' x ${layout.plot.length}' (${(layout.plot.width * layout.plot.length).toFixed(0)} sq ft)
- Facing Direction: ${layout.plot.facing}
- Setbacks: Front ${layout.plot.setback?.front || 6}', Back ${layout.plot.setback?.back || 4}', Sides ${layout.plot.setback?.left || 4}'
- Total Rooms: ${layout.rooms.length}
- Total Built Area: ${planUtils.calculateBuiltUpArea(layout).toFixed(0)} sq ft
- Space Utilization: ${planUtils.calculateUtilization(layout).toFixed(1)}%

Room Details:
${layout.rooms.map((room, i) => `${i + 1}. ${room.type}: ${room.width}' x ${room.height}' at position (${room.x}', ${room.y}')`).join('\n')}

Wall and Structure:
- Total Walls: ${layout.walls?.length || 0}
- Doors: ${layout.doors?.length || 0}
- Windows: ${layout.windows?.length || 0}`;

    return `
Perform a comprehensive architectural analysis of this floor plan:

${layoutDetails}

Evaluate based on these criteria (score 1-10 for each):
1. Space Utilization Efficiency
2. Room Proportions and Sizing
3. Traffic Flow and Circulation
4. Natural Light Optimization
5. Functional Zoning
6. Architectural Harmony
7. Structural Integrity
8. Buildability and Construction Practicality

Provide:
- Overall quality score (1-100)
- Strengths of the current design
- Specific areas for improvement
- Actionable recommendations with measurements
- Alternative layout suggestions if applicable

Focus on professional architectural standards and practical buildability.
`;
  }

  /**
   * Create prompt for design concepts
   */
  createConceptPrompt(requirements, preferences) {
    return `
You are an expert AI architect and interior designer. Based on these user requirements and preferences, generate innovative design concepts:

User Requirements:
${this.formatRequirements(requirements)}

User Preferences:
${this.formatPreferences(preferences)}

Please provide 3-5 distinct design concepts that include:
1. Architectural style and theme
2. Spatial organization strategy
3. Material and finish recommendations
4. Color palette suggestions
5. Lighting design approach
6. Sustainability features
7. Unique design elements

Each concept should be practical, buildable, and tailored to the user's lifestyle and aesthetic preferences. Focus on creating cohesive, functional, and beautiful living spaces.
`;
  }

  /**
   * Parse AI-generated layouts from response
   */
  parseAIGeneratedLayouts(aiResponse, plot, requirements) {
    // Extract layout information from AI response
    const layouts = [];
    
    // Look for concept sections in the response
    const conceptMatches = aiResponse.match(/Concept \d+[:\s]|Design \d+[:\s]|Layout \d+[:\s]/gi);
    
    if (conceptMatches) {
      // Parse each concept
      conceptMatches.forEach((match, index) => {
        const layout = this.createLayoutFromConcept(match, aiResponse, plot, requirements);
        if (layout) {
          layouts.push(layout);
        }
      });
    } else {
      // Fallback: create a single layout from the response
      const layout = this.createBasicLayoutFromResponse(aiResponse, plot, requirements);
      if (layout) {
        layouts.push(layout);
      }
    }

    return layouts.length > 0 ? layouts : null;
  }

  /**
   * Apply Gemini AI suggestions to existing layout
   */
  applyGeminiSuggestions(layout, suggestions) {
    // Parse suggestions and apply them to the layout
    const improvedLayout = { ...layout };
    
    // Look for specific improvement suggestions in the text
    const improvementRegex = /(\w+)\s*:\s*(.+)/g;
    let match;
    
    while ((match = improvementRegex.exec(suggestions)) !== null) {
      const [_, category, suggestion] = match;
      
      switch (category.toLowerCase()) {
        case 'room placement':
          improvedLayout = this.adjustRoomPlacement(improvedLayout, suggestion);
          break;
        case 'dimensions':
          improvedLayout = this.adjustDimensions(improvedLayout, suggestion);
          break;
        case 'flow':
          improvedLayout = this.improveFlow(improvedLayout, suggestion);
          break;
      }
    }

    return {
      ...improvedLayout,
      metadata: {
        ...improvedLayout.metadata,
        geminiEnhanced: true,
        geminiSuggestions: suggestions,
        enhancementDate: new Date().toISOString()
      }
    };
  }

  /**
   * Parse quality analysis from AI response
   */
  parseQualityAnalysis(analysis, layout) {
    const scoreMatch = analysis.match(/Overall score[:\s]+(\d+)/i);
    const overallScore = scoreMatch ? parseInt(scoreMatch[1]) : 75;

    const strengthsMatch = analysis.match(/Strengths:[\s\S]*?Weaknesses:/i);
    const strengths = strengthsMatch ? strengthsMatch[0].split('\n').slice(1).filter(line => line.trim()) : [];

    const weaknessesMatch = analysis.match(/Weaknesses:[\s\S]*?Recommendations:/i);
    const weaknesses = weaknessesMatch ? weaknessesMatch[0].split('\n').slice(1).filter(line => line.trim()) : [];

    const recommendationsMatch = analysis.match(/Recommendations:[\s\S]*?$/i);
    const recommendations = recommendationsMatch ? recommendationsMatch[0].split('\n').filter(line => line.trim()) : [];

    return {
      overallScore,
      strengths: strengths.slice(0, 5), // Limit to top 5
      weaknesses: weaknesses.slice(0, 5), // Limit to top 5
      recommendations: recommendations.slice(0, 10), // Limit to top 10
      detailedAnalysis: analysis
    };
  }

  /**
   * Parse design concepts from AI response
   */
  parseDesignConcepts(conceptsText) {
    const designConcepts = [];
    
    // Look for concept sections
    const conceptRegex = /(Concept \d+|Design \d+|Style \d+)[\s\S]*?(?=(Concept \d+|Design \d+|Style \d+|$))/gi;
    const matches = conceptsText.match(conceptRegex);
    
    if (matches) {
      matches.forEach((match, index) => {
        const lines = match.split('\n').filter(line => line.trim());
        designConcepts.push({
          id: index + 1,
          title: lines[0] || `Concept ${index + 1}`,
          description: lines.slice(1).join(' '),
          features: this.extractFeatures(lines),
          style: this.extractStyle(lines)
        });
      });
    }

    return designConcepts.length > 0 ? designConcepts : this.getDefaultConcepts();
  }

  /**
   * Helper methods for formatting and parsing
   */
  formatRequirements(requirements) {
    return Object.entries(requirements)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join('\n');
  }

  formatPreferences(preferences) {
    if (!preferences) return 'No specific preferences';
    
    return Object.entries(preferences)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join('\n');
  }

  extractFeatures(lines) {
    return lines
      .filter(line => line.includes('feature') || line.includes('element') || line.includes('aspect'))
      .map(line => line.replace(/.*?:\s*/, ''))
      .slice(0, 5);
  }

  extractStyle(lines) {
    const styleLine = lines.find(line => line.toLowerCase().includes('style'));
    return styleLine ? styleLine.replace(/.*?:\s*/, '') : 'Modern';
  }

  /**
   * Fallback methods when Gemini is not configured
   */
  getDefaultConcepts() {
    return [
      {
        id: 1,
        title: 'Modern Minimalist',
        description: 'Clean lines and open spaces with minimal decoration',
        features: ['Open floor plan', 'Large windows', 'Neutral color palette'],
        style: 'Modern'
      },
      {
        id: 2,
        title: 'Traditional Elegance',
        description: 'Classic design elements with timeless appeal',
        features: ['Defined room spaces', 'Warm materials', 'Classic details'],
        style: 'Traditional'
      }
    ];
  }

  getBasicAnalysis(layout) {
    const utilization = planUtils.calculateUtilization(layout);
    return {
      overallScore: utilization > 70 ? 85 : 65,
      strengths: ['Functional layout', 'Good room proportions'],
      weaknesses: ['Could optimize space utilization', 'Limited natural light optimization'],
      recommendations: ['Consider open plan layout', 'Optimize room positioning'],
      detailedAnalysis: 'Basic analysis performed without AI enhancement'
    };
  }

  // Placeholder methods for layout modifications
  createLayoutFromConcept(concept, response, plot, requirements) {
    // This would parse specific concept details and create a layout
    return null;
  }

  createBasicLayoutFromResponse(response, plot, requirements) {
    // This would create a basic layout from the AI response
    return null;
  }

  adjustRoomPlacement(layout, suggestion) {
    // This would implement room placement adjustments
    return layout;
  }

  adjustDimensions(layout, suggestion) {
    // This would implement dimension adjustments
    return layout;
  }

  improveFlow(layout, suggestion) {
    // This would implement flow improvements
    return layout;
  }
}

module.exports = new GeminiService();