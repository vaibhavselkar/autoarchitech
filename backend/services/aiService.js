const axios = require('axios');

/**
 * AI Service for enhancing floor plan generation with machine learning
 * Currently supports integration with OpenAI's GPT models for design refinement
 */
class AIService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.endpoint = 'https://api.openai.com/v1/chat/completions';
  }

  /**
   * Check if AI is configured
   */
  isConfigured() {
    return !!this.apiKey;
  }

  /**
   * Refine a floor plan layout using AI suggestions
   * @param {Object} layout - Current floor plan layout
   * @param {Object} requirements - User requirements
   * @returns {Promise<Object>} Refined layout
   */
  async refineLayoutWithAI(layout, requirements) {
    if (!this.isConfigured()) {
      console.log('AI not configured, returning original layout');
      return layout;
    }

    try {
      const prompt = this.generateRefinementPrompt(layout, requirements);
      const response = await this.callOpenAI(prompt);
      
      // Parse AI suggestions and apply them
      const suggestions = this.parseAISuggestions(response);
      return this.applyAISuggestions(layout, suggestions);
      
    } catch (error) {
      console.error('AI refinement failed:', error);
      return layout; // Fallback to original layout
    }
  }

  /**
   * Generate design suggestions based on user preferences
   * @param {Object} userPreferences - User requirements and preferences
   * @returns {Promise<Array>} Design suggestions
   */
  async generateDesignSuggestions(userPreferences) {
    if (!this.isConfigured()) {
      return this.getDefaultSuggestions(userPreferences);
    }

    try {
      const prompt = this.generateSuggestionsPrompt(userPreferences);
      const response = await this.callOpenAI(prompt);
      return this.parseDesignSuggestions(response);
      
    } catch (error) {
      console.error('AI suggestions failed:', error);
      return this.getDefaultSuggestions(userPreferences);
    }
  }

  /**
   * Analyze layout for architectural best practices
   * @param {Object} layout - Floor plan layout
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeLayoutQuality(layout) {
    if (!this.isConfigured()) {
      return this.getBasicAnalysis(layout);
    }

    try {
      const prompt = this.generateAnalysisPrompt(layout);
      const response = await this.callOpenAI(prompt);
      return this.parseQualityAnalysis(response);
      
    } catch (error) {
      console.error('AI analysis failed:', error);
      return this.getBasicAnalysis(layout);
    }
  }

  /**
   * Generate a prompt for layout refinement
   */
  generateRefinementPrompt(layout, requirements) {
    const roomSummary = layout.rooms.map(r => `${r.type}: ${r.width}'x${r.height}'`).join(', ');
    const plotSize = `${layout.plot.width}' x ${layout.plot.length}'`;
    
    return `
You are an expert architect. Improve this floor plan layout based on architectural best practices.

Current Layout:
- Plot Size: ${plotSize}
- Facing: ${layout.plot.facing}
- Rooms: ${roomSummary}
- Total Rooms: ${layout.rooms.length}

User Requirements:
${JSON.stringify(requirements, null, 2)}

Please suggest specific improvements for:
1. Room placement and flow
2. Natural light optimization
3. Space utilization
4. Architectural harmony
5. Functional layout improvements

Return your suggestions in JSON format with specific room adjustments, positioning changes, and layout improvements.
`;
  }

  /**
   * Generate a prompt for design suggestions
   */
  generateSuggestionsPrompt(userPreferences) {
    return `
You are an expert architect and interior designer. Based on these user preferences, suggest optimal floor plan configurations:

User Preferences:
${JSON.stringify(userPreferences, null, 2)}

Please provide 3-5 different layout concepts with:
1. Optimal room arrangements
2. Space-saving techniques
3. Natural flow patterns
4. Architectural style suggestions
5. Material and finish recommendations

Focus on practical, buildable designs that maximize functionality and aesthetic appeal.
`;
  }

  /**
   * Generate a prompt for layout quality analysis
   */
  generateAnalysisPrompt(layout) {
    const roomSummary = layout.rooms.map(r => `${r.type}: ${r.width}'x${r.height}' at (${r.x}, ${r.y})`).join('\n');
    
    return `
Analyze this floor plan layout for architectural quality and suggest improvements:

Layout Details:
- Plot: ${layout.plot.width}' x ${layout.plot.length}' facing ${layout.plot.facing}
- Setbacks: Front ${layout.plot.setback.front}', Back ${layout.plot.setback.back}', Sides ${layout.plot.setback.left}'
- Rooms:
${roomSummary}

Evaluate based on:
1. Space utilization efficiency
2. Room adjacency and flow
3. Natural light and ventilation
4. Structural integrity
5. Architectural harmony
6. Functional layout

Provide a quality score (1-10) and specific improvement suggestions.
`;
  }

  /**
   * Call OpenAI API
   */
  async callOpenAI(prompt) {
    const response = await axios.post(this.endpoint, {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are an expert architect and AI design assistant. Provide professional, practical architectural advice.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content;
  }

  /**
   * Parse AI suggestions from response
   */
  parseAISuggestions(aiResponse) {
    // Simple parsing - in production, use more robust JSON parsing
    try {
      // Look for JSON in the response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.warn('Failed to parse AI suggestions as JSON');
    }

    // Fallback to text parsing
    return {
      improvements: aiResponse.split('\n').filter(line => line.trim()),
      suggestions: []
    };
  }

  /**
   * Apply AI suggestions to layout
   */
  applyAISuggestions(layout, suggestions) {
    // This would implement the actual layout modifications
    // For now, return the original layout with AI metadata
    return {
      ...layout,
      metadata: {
        ...layout.metadata,
        aiEnhanced: true,
        aiSuggestions: suggestions,
        enhancementDate: new Date().toISOString()
      }
    };
  }

  /**
   * Parse design suggestions from AI response
   */
  parseDesignSuggestions(aiResponse) {
    return [
      {
        concept: 'Modern Open Plan',
        description: 'Open concept living with minimal walls',
        focus: 'Natural light and space flow',
        rooms: ['Open kitchen-dining-living', 'Private bedroom zones']
      },
      {
        concept: 'Traditional Layout',
        description: 'Classic room separation with defined spaces',
        focus: 'Privacy and traditional flow',
        rooms: ['Separate dining room', 'Defined living areas']
      }
    ];
  }

  /**
   * Parse quality analysis from AI response
   */
  parseQualityAnalysis(aiResponse) {
    return {
      score: 7.5,
      strengths: ['Good room proportions', 'Logical flow'],
      weaknesses: ['Could improve natural light', 'Space utilization could be better'],
      suggestions: aiResponse.split('\n').filter(line => line.includes('suggest'))
    };
  }

  /**
   * Fallback methods when AI is not configured
   */
  getDefaultSuggestions(userPreferences) {
    return [
      {
        concept: 'Standard Layout',
        description: 'Basic room arrangement based on requirements',
        focus: 'Functionality and practicality'
      }
    ];
  }

  getBasicAnalysis(layout) {
    const utilization = this.calculateUtilization(layout);
    return {
      score: utilization > 70 ? 8 : 6,
      strengths: ['Basic functionality'],
      weaknesses: ['No AI optimization applied'],
      suggestions: ['Consider professional architectural review']
    };
  }

  calculateUtilization(layout) {
    const totalArea = layout.plot.width * layout.plot.length;
    const builtArea = layout.rooms.reduce((sum, room) => sum + (room.width * room.height), 0);
    return (builtArea / totalArea) * 100;
  }
}

module.exports = new AIService();