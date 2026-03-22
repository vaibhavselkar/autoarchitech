const { GoogleGenerativeAI } = require('@google/generative-ai');
const { planUtils } = require('../../shared/plan-schema');

/**
 * Gemini AI Service  v2.0
 *
 * AI-FIRST approach:
 *   Gemini now produces complete room layouts (x, y, width, height per room).
 *   The layoutGenerator uses these coordinates directly.
 *   Rule-based fallback only when Gemini fails or produces invalid output.
 */
class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.modelName = 'gemini-1.5-flash';

    if (this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({ model: this.modelName });
    }
  }

  isConfigured() {
    return !!this.apiKey && !!this.genAI;
  }

  // ─── PRIMARY: AI generates complete room placements ───────────────────────

  /**
   * Ask Gemini to produce `count` complete floor plan layouts.
   * Each layout is an array of rooms with exact x, y, width, height.
   * Returns array of variation objects, or null on failure.
   */
  async generateRoomPlacements(plot, requirements, preferences, count) {
    if (!this.isConfigured()) return null;

    const bW = Math.round(plot.width  - (plot.setback?.left || 4) - (plot.setback?.right || 4));
    const bL = Math.round(plot.length - (plot.setback?.front || 6) - (plot.setback?.back  || 4));
    const facing = (plot.facing || 'north').toLowerCase();
    const req = requirements;
    const prefs = preferences || {};

    // Build the list of rooms the user needs
    const roomList = this._buildRoomList(req, bW, bL);

    const layoutDescriptions = [
      'LINEAR: Horizontal bands stacked front-to-back. Balcony full-width at y=0. Living Room full-width next. Dining + Kitchen side-by-side in the middle. Bedrooms + Bathrooms side-by-side at the rear.',
      'L-SHAPE: Full-width Balcony at front. Left 55% column: Living → Dining → Master Bed+Bath stacked. Right 45% column: Kitchen (tall) → Study → Bedroom+Bath stacked. Each column fills full remaining depth.',
      'SPLIT-ZONE: Full-width Balcony at front. Left half: Living → Dining → Kitchen stacked full depth. Right half: Master Bed+Bath → Bedroom+Bath stacked full depth. Public and private completely separated.',
      'COMPACT: Full-width Balcony at front. Central 3.5ft corridor runs full depth. Left of corridor: Living → Study → Master Bed+Bath stacked. Right of corridor: Dining → Kitchen → Bedroom+Bath stacked.',
      'OPEN-PLAN: Full-width Balcony at front. Below it, Living+Dining+Kitchen merged in one open row side-by-side (same y, same height). All Bedrooms+Bathrooms in one row at the rear.',
    ];

    const prompt = `You are a senior Indian residential architect. Generate ${count} COMPLETELY DIFFERENT floor plan layouts for the plot below. Each must be a genuine architectural variant — not just resized copies.

═══ COORDINATE SYSTEM ═══
• Buildable area: ${bW}ft wide × ${bL}ft deep
• x goes LEFT→RIGHT:  0 = left/west wall, ${bW} = right/east wall
• y goes FRONT→BACK:  0 = FRONT (road/${facing} side), ${bL} = BACK (garden)
• All coordinates are RELATIVE to the buildable area origin (0, 0)

═══ SITE ═══
Plot: ${plot.width}ft × ${plot.length}ft, ${facing.toUpperCase()}-facing
Buildable zone: ${bW}ft wide × ${bL}ft deep

═══ REQUIRED ROOMS ═══
${roomList}

═══ LAYOUT TYPES — use exactly one per variation ═══
${layoutDescriptions.slice(0, count).map((d, i) => `Variation ${i + 1}: ${d}`).join('\n')}

═══ HARD RULES — every room in every variation must obey ═══
1. BOUNDS: 0 ≤ x, (x + width) ≤ ${bW}, 0 ≤ y, (y + height) ≤ ${bL}
2. NO OVERLAP: rooms must not intersect (touching edges at the same x or y is fine)
3. FILL: rooms should cover the buildable area with no large gaps
4. BALCONY: always at y=0, width ≥ ${Math.round(bW * 0.6)}ft, height = 5 or 6ft
5. ADJACENCY: kitchen x-adjacent or y-adjacent to dining (they must share a wall)
6. BATHROOMS: each bathroom must share a wall with a bedroom (same x-range or same y-range, touching)
7. BEDROOMS: cluster at the rear (large y values)
8. BATHROOM SIZE: width ≥ 6ft, height ≥ 8ft — never smaller
${prefs.vastu ? '9. VASTU: Master bedroom at south-west (large x, large y); kitchen at south-east; prayer room at north-east (small x, small y)' : ''}

═══ OUTPUT FORMAT ═══
Return ONLY a raw JSON array — no markdown, no explanation:
[
  {
    "layoutStyle": "linear",
    "designTheme": "Modern Minimalist",
    "description": "Three-band north-facing plan with open social core",
    "rooms": [
      { "type": "balcony",       "x": 0,  "y": 0,  "width": ${bW}, "height": 5  },
      { "type": "living_room",   "x": 0,  "y": 5,  "width": ${bW}, "height": 14 },
      { "type": "dining",        "x": 0,  "y": 19, "width": ${Math.round(bW*0.5)}, "height": 11 },
      { "type": "kitchen",       "x": ${Math.round(bW*0.5)}, "y": 19, "width": ${bW - Math.round(bW*0.5)}, "height": 11 },
      { "type": "master_bedroom","x": 0,  "y": 30, "width": ${Math.round(bW*0.55)}, "height": ${bL - 30} },
      { "type": "bathroom",      "x": ${Math.round(bW*0.55)}, "y": 30, "width": ${Math.round(bW*0.25)}, "height": ${bL - 30} },
      { "type": "bedroom",       "x": ${Math.round(bW*0.8)}, "y": 30, "width": ${bW - Math.round(bW*0.8)}, "height": ${bL - 30} }
    ]
  }
]

VALID room type names: balcony, living_room, dining, kitchen, master_bedroom, bedroom, bathroom, study, prayer_room, guest_room, utility_room, terrace

Generate exactly ${count} variation objects now, each with a genuinely different spatial arrangement:`;

    try {
      const result = await this.model.generateContent(prompt);
      const text   = result.response.text();
      const parsed = this.extractJSON(text);

      if (!Array.isArray(parsed) || parsed.length === 0) {
        console.warn('Gemini room placements: no usable output');
        return null;
      }

      return parsed.slice(0, count).map((v, i) => this._sanitiseVariation(v, i, bW, bL));
    } catch (err) {
      console.error('Gemini generateRoomPlacements failed:', err.message);
      return null;
    }
  }

  // ─── SECONDARY: design parameters (used as fallback by rule-based engine) ──

  async generateDesignParameters(plot, requirements, preferences, count) {
    if (!this.isConfigured()) return null;

    const bW = Math.round(plot.width  - (plot.setback?.left || 4) - (plot.setback?.right || 4));
    const bL = Math.round(plot.length - (plot.setback?.front || 6) - (plot.setback?.back  || 4));
    const facing = (plot.facing || 'north').toLowerCase();

    const prompt = `You are a senior Indian residential architect. Generate ${count} distinct design-parameter sets for floor plan variations.

Site: ${plot.width}×${plot.length}ft, ${facing}-facing. Buildable: ${bW}×${bL}ft.
Rooms: ${JSON.stringify(requirements)}. Preferences: ${JSON.stringify(preferences || {})}.

Return ONLY a raw JSON array:
[{
  "layoutStyle": "linear",
  "designTheme": "Modern Minimalist",
  "description": "...",
  "roomSizes": {
    "living_room": {"width": 16, "height": 14},
    "dining":      {"width": 13, "height": 11},
    "kitchen":     {"width": 12, "height": 10},
    "master_bedroom": {"width": 14, "height": 13},
    "bedroom":     {"width": 12, "height": 11},
    "bathroom":    {"width":  7, "height":  9},
    "study":       {"width": 11, "height": 10},
    "balcony":     {"width": 14, "height":  5}
  }
}]

Styles: linear, l-shape, split-zone, compact, open-plan (use each once).
Bathroom min: width≥6, height≥8. No aspect ratio > 1.7.
Generate ${count} objects:`;

    try {
      const result = await this.model.generateContent(prompt);
      const text   = result.response.text();
      const params = this.extractJSON(text);
      if (!Array.isArray(params) || params.length === 0) return null;
      return params.slice(0, count).map((p, i) => this._sanitiseParams(p, i, bW, bL));
    } catch (err) {
      console.error('Gemini generateDesignParameters failed:', err.message);
      return null;
    }
  }

  // ─── Other methods ────────────────────────────────────────────────────────

  async refineLayoutWithGemini(layout, requirements) {
    if (!this.isConfigured()) return layout;
    const prompt = `You are an expert architect. Suggest improvements to this floor plan.
Plot: ${layout.plot.width}ft x ${layout.plot.length}ft facing ${layout.plot.facing}
Rooms: ${layout.rooms.map(r => `${r.type} ${r.width}x${r.height}`).join(', ')}
Space utilisation: ${planUtils.calculateUtilization(layout).toFixed(1)}%
Requirements: ${JSON.stringify(requirements)}
List up to 5 specific, actionable improvements.`;
    try {
      const result = await this.model.generateContent(prompt);
      return { ...layout, metadata: { ...layout.metadata, geminiEnhanced: true, geminiSuggestions: result.response.text() } };
    } catch (err) {
      return layout;
    }
  }

  async analyzeLayoutQuality(layout) {
    if (!this.isConfigured()) return this.getBasicAnalysis(layout);
    const prompt = `Analyse this residential floor plan and score it:
Plot: ${layout.plot.width}x${layout.plot.length}ft, facing ${layout.plot.facing}
Rooms: ${layout.rooms.map(r => `${r.type} ${r.width}x${r.height} at (${r.x},${r.y})`).join('\n')}
Respond:
Overall score: [1-100]
Strengths: [bullets]
Weaknesses: [bullets]
Recommendations: [bullets]`;
    try {
      const result = await this.model.generateContent(prompt);
      return this._parseQualityAnalysis(result.response.text(), layout);
    } catch (err) {
      return this.getBasicAnalysis(layout);
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  _buildRoomList(req, bW, bL) {
    const beds  = parseInt(req.bedrooms  || 2);
    const baths = parseInt(req.bathrooms || 2);
    const lines = ['INCLUDE EXACTLY THESE ROOMS — no more, no fewer:'];

    lines.push(`• 1× balcony       — full-width (${bW}ft), height 5-6ft, placed at y=0 (front)`);
    lines.push(`• 1× living_room   — width 14-${Math.min(bW, 22)}ft, height 12-16ft`);
    lines.push(`• 1× dining        — width 11-15ft, height 10-13ft`);
    lines.push(`• 1× kitchen       — width 10-14ft, height 10-12ft`);
    lines.push(`• 1× master_bedroom — width 13-16ft, height 12-15ft`);
    if (beds > 1) lines.push(`• ${beds - 1}× bedroom       — width 11-14ft, height 10-13ft each`);
    lines.push(`• ${baths}× bathroom      — width ≥6ft, height ≥8ft EACH (NEVER SMALLER — this is a HARD rule)`);
    if (parseInt(req.study  || 0) > 0)  lines.push(`• 1× study         — width 10-13ft, height 10-12ft`);
    if (req.prayer_room)                lines.push(`• 1× prayer_room   — width 8-12ft, height 8-10ft`);
    if (parseInt(req.guest_room || 0) > 0) lines.push(`• 1× guest_room   — width 11-14ft, height 10-12ft`);
    if (parseInt(req.utility_room || 0) > 0) lines.push(`• 1× utility_room — width 6-10ft, height 8-10ft`);

    const total = 4 + beds + baths
      + (parseInt(req.study || 0) > 0 ? 1 : 0)
      + (req.prayer_room ? 1 : 0)
      + (parseInt(req.guest_room || 0) > 0 ? 1 : 0)
      + (parseInt(req.utility_room || 0) > 0 ? 1 : 0);
    lines.push(`TOTAL rooms per variation: ${total}`);
    return lines.join('\n');
  }

  _sanitiseVariation(v, index, bW, bL) {
    const styles = ['linear', 'l-shape', 'split-zone', 'compact', 'open-plan'];
    const themes = ['Modern Minimalist', 'Contemporary', 'Traditional Elegance', 'Vastu Compliant', 'Scandinavian'];

    const rooms = Array.isArray(v.rooms) ? v.rooms.map(r => ({
      type:   String(r.type || 'bedroom'),
      x:      Math.max(0, parseFloat(r.x) || 0),
      y:      Math.max(0, parseFloat(r.y) || 0),
      width:  Math.max(1, parseFloat(r.width)  || 6),
      height: Math.max(1, parseFloat(r.height) || 8),
    })).map(r => ({
      ...r,
      // Clip to buildable bounds
      width:  Math.min(r.width,  bW - r.x),
      height: Math.min(r.height, bL - r.y),
    })) : [];

    return {
      layoutStyle: styles.includes(v.layoutStyle) ? v.layoutStyle : styles[index % styles.length],
      designTheme: v.designTheme || themes[index % themes.length],
      description: v.description || `AI Layout Variation ${index + 1}`,
      rooms,
    };
  }

  _sanitiseParams(p, index, maxW, maxL) {
    const styles = ['linear', 'l-shape', 'split-zone', 'compact', 'open-plan'];
    const themes = ['Modern Minimalist', 'Contemporary', 'Traditional Elegance', 'Vastu Compliant', 'Scandinavian'];
    const clamp  = (v, lo, hi) => Math.max(lo, Math.min(hi, v || 0));
    const rs = p.roomSizes || {};
    const make = (rawW, rawH, minW, minH) => {
      const w = clamp(rawW, minW, maxW * 0.55);
      const h = clamp(rawH, minH, maxL * 0.55);
      return { width: w, height: h };
    };
    return {
      layoutStyle:  styles.includes(p.layoutStyle) ? p.layoutStyle : styles[index % styles.length],
      designTheme:  p.designTheme  || themes[index % themes.length],
      description:  p.description  || `Design variation ${index + 1}`,
      roomSizes: {
        living_room:    make(rs.living_room?.width,    rs.living_room?.height,    13, 12),
        dining:         make(rs.dining?.width,          rs.dining?.height,         11, 10),
        kitchen:        make(rs.kitchen?.width,         rs.kitchen?.height,        10, 10),
        master_bedroom: make(rs.master_bedroom?.width,  rs.master_bedroom?.height, 13, 12),
        bedroom:        make(rs.bedroom?.width,         rs.bedroom?.height,        11, 10),
        bathroom:       make(rs.bathroom?.width,        rs.bathroom?.height,         6,  8),
        study:          make(rs.study?.width,           rs.study?.height,          10, 10),
        balcony:        make(rs.balcony?.width,         rs.balcony?.height,         8,  5),
        guest_room:     make(rs.guest_room?.width,      rs.guest_room?.height,     11, 10),
        utility_room:   make(rs.utility_room?.width,    rs.utility_room?.height,    6,  8),
        prayer_room:    make(rs.prayer_room?.width,     rs.prayer_room?.height,     8,  8),
      },
      features: p.features || { masterEnSuite: true, balconyPosition: 'front', staircasePosition: 'corner' },
    };
  }

  _parseQualityAnalysis(analysis, layout) {
    const scoreMatch  = analysis.match(/Overall score[:\s]+(\d+)/i);
    const parseList   = (m) => m ? m[1].split('\n').map(l => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean).slice(0, 5) : [];
    return {
      overallScore:    scoreMatch ? parseInt(scoreMatch[1]) : 75,
      strengths:       parseList(analysis.match(/Strengths:([\s\S]*?)(?:Weaknesses:|$)/i)),
      weaknesses:      parseList(analysis.match(/Weaknesses:([\s\S]*?)(?:Recommendations:|$)/i)),
      recommendations: parseList(analysis.match(/Recommendations:([\s\S]*?)$/i)),
      detailedAnalysis: analysis,
    };
  }

  getBasicAnalysis(layout) {
    const utilization = planUtils.calculateUtilization(layout);
    return {
      overallScore: utilization > 70 ? 82 : 62,
      strengths: ['Functional layout', 'Good room proportions'],
      weaknesses: ['Space utilisation could improve'],
      recommendations: ['Consider open-plan living area', 'Optimise room positioning'],
      detailedAnalysis: 'Basic analysis (Gemini not configured)',
    };
  }

  extractJSON(text) {
    const stripped = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const s = stripped.indexOf('['), e = stripped.lastIndexOf(']');
    if (s !== -1 && e !== -1) {
      try { return JSON.parse(stripped.slice(s, e + 1)); } catch { /* ignore */ }
    }
    const s2 = text.indexOf('['), e2 = text.lastIndexOf(']');
    if (s2 !== -1 && e2 !== -1) {
      try { return JSON.parse(text.slice(s2, e2 + 1)); } catch { /* ignore */ }
    }
    return null;
  }
}

module.exports = new GeminiService();
