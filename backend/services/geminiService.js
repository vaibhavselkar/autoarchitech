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
    this.modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

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

    const bW65 = Math.round(bW * 0.65), bW70 = Math.round(bW * 0.7), bW75 = Math.round(bW * 0.75);
    const layoutDescriptions = [
      `LINEAR: Balcony FULL-WIDTH (width=${bW}) at y=0, height=5. Living Room full-width below. Dining + Kitchen side-by-side in the middle. Bedrooms + Bathrooms side-by-side at the rear.`,
      `L-SHAPE: Balcony RIGHT-ALIGNED (x=${bW-bW65}, width=${bW65}) at y=0, height=5. Left 55% column: Living → Dining → Master Bed+Bath stacked. Right 45% column: Kitchen → Study → Bedroom+Bath stacked.`,
      `SPLIT-ZONE: Balcony LEFT-ALIGNED (x=0, width=${bW70}) at y=0, height=6. Left half: Living → Dining → Kitchen stacked full depth. Right half: Master Bed+Bath → Bedroom+Bath stacked. Public/private separated.`,
      `COMPACT: Balcony CENTERED (x=${Math.round((bW-bW75)/2)}, width=${bW75}) at y=0, height=5. Central corridor runs full depth. Left: Living → Study → Master Bed+Bath. Right: Dining → Kitchen → Bedroom+Bath.`,
      `OPEN-PLAN: Balcony FULL-WIDTH (width=${bW}) at y=0, height=6. Living+Dining+Kitchen in one wide open row side-by-side (same y). All Bedrooms+Bathrooms in a single row at the rear.`,
    ];

    // Compute correct example coordinates for a professional linear plan
    const _exBalH  = 5;
    const _exLivH  = Math.min(14, Math.round(bL * 0.27));
    const _exMidH  = Math.min(12, Math.round(bL * 0.22));
    const _exRearY = _exBalH + _exLivH + _exMidH;
    const _exRearH = bL - _exRearY;
    const _exRow1H = Math.round(_exRearH / 2);
    const _exRow2H = _exRearH - _exRow1H;
    const _exBathW = Math.min(9, Math.max(7, Math.round(bW * 0.28)));
    const _exBedW  = bW - _exBathW;
    const _exDW    = Math.round(bW * 0.56);
    const _exKW    = bW - _exDW;

    const prompt = `You are a senior Indian residential civil engineer with 5 years of professional floor plan design experience. Generate ${count} COMPLETELY DIFFERENT floor plan layouts for the plot below. Each must be a genuine architectural variant — not just resized copies.

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

═══ PROFESSIONAL DESIGN PRINCIPLES (3-zone layout) ═══
Zone 1 — PUBLIC (y=0 to y≈${Math.round(bL*0.35)}): Balcony, Living Room
Zone 2 — SERVICE (y≈${Math.round(bL*0.35)} to y≈${Math.round(bL*0.58)}): Dining Room + Kitchen (ADJACENT to each other)
Zone 3 — PRIVATE (y≈${Math.round(bL*0.58)} to y=${bL}): Bedrooms with EN-SUITE Bathrooms
• Each bathroom must be placed directly beside its bedroom (same y, touching x-wall) so they share a wall.
• Bathrooms face INTO the bedroom — never isolated on an exterior boundary alone.
• The layout must feel like a real civil engineer drew it: clear zoning, no wasted corridors, high room coverage.

═══ LAYOUT TYPES — use exactly one per variation ═══
${layoutDescriptions.slice(0, count).map((d, i) => `Variation ${i + 1}: ${d}`).join('\n')}

${prefs.customIdea ? `═══ CLIENT'S SPECIFIC REQUEST — highest priority, honour in every variation ═══
${prefs.customIdea}

` : ''}═══ HARD RULES — every room in every variation must obey ═══
1. BOUNDS: 0 ≤ x, (x + width) ≤ ${bW}, 0 ≤ y, (y + height) ≤ ${bL}
2. NO OVERLAP: rooms must not intersect (touching edges is fine)
3. COVERAGE ≥ 95%: total room area must be ≥ ${Math.round(bW * bL * 0.95)} sq.ft. Leave NO large empty patches.
4. BALCONY: y=0, height=5 or 6ft — width and x follow your assigned layout type above
5. KITCHEN + DINING: must share a wall (touching). Kitchen NEVER on the road-facing front.
6. EN-SUITE BATHROOMS: every bathroom must share a SIDE WALL with exactly one bedroom (same y-band, touching on x-axis). Example: bedroom at x=0,y=42,w=${_exBedW},h=${_exRow1H} → bathroom at x=${_exBedW},y=42,w=${_exBathW},h=${Math.min(_exRow1H,10)}. NEVER place a bathroom floating alone.
7. LIVING ROOM: must have the LARGEST floor area of all habitable rooms
8. BATHROOM SIZE: width 6–9ft, height 8–10ft — NEVER exceed 9ft wide or 10ft deep. NEVER less than 6ft wide or 8ft deep.
9. BEDROOM SIZE: every bedroom must be LARGER than every bathroom. Master bedroom ≥ 13×12ft. Bedroom ≥ 11×10ft.
10. LAYOUT ORDER (front to back): balcony (y=0) → living_room → dining/kitchen → bedrooms+bathrooms (rear)
11. ASPECT RATIO: every room's (width ÷ height) must be between 0.5 and 2.2. No pencil-thin rooms.
12. BALCONY SHAPE: use the width specified in your layout type description above (not always full-width)
${prefs.vastu ? '13. VASTU: Master bedroom at south-west (large x, large y); kitchen at south-east; prayer room at north-east (small x, small y)' : ''}

═══ OUTPUT FORMAT ═══
Return ONLY a raw JSON array — no markdown, no explanation.
Study this CORRECT PROFESSIONAL EXAMPLE carefully before generating (for a ${bW}×${bL} buildable area):
[
  {
    "layoutStyle": "linear",
    "designTheme": "Modern Minimalist",
    "description": "Three-band plan — open social zone, en-suite private zone",
    "rooms": [
      { "type": "balcony",        "x": 0,         "y": 0,          "width": ${bW},      "height": ${_exBalH}  },
      { "type": "living_room",    "x": 0,         "y": ${_exBalH}, "width": ${bW},      "height": ${_exLivH} },
      { "type": "dining",         "x": 0,         "y": ${_exBalH+_exLivH}, "width": ${_exDW},  "height": ${_exMidH} },
      { "type": "kitchen",        "x": ${_exDW},  "y": ${_exBalH+_exLivH}, "width": ${_exKW},  "height": ${_exMidH} },
      { "type": "master_bedroom", "x": 0,         "y": ${_exRearY}, "width": ${_exBedW}, "height": ${_exRow1H} },
      { "type": "bathroom",       "x": ${_exBedW},"y": ${_exRearY}, "width": ${_exBathW},"height": ${Math.min(_exRow1H,10)} },
      { "type": "bedroom",        "x": 0,         "y": ${_exRearY+_exRow1H}, "width": ${_exBedW}, "height": ${_exRow2H} },
      { "type": "bathroom",       "x": ${_exBedW},"y": ${_exRearY+_exRow1H}, "width": ${_exBathW},"height": ${Math.min(_exRow2H,10)} }
    ]
  }
]

KEY OBSERVATIONS from the example:
• Each bathroom is side-by-side with its bedroom (same y, touching x-wall) — NOT below or floating
• Rooms fill the ENTIRE buildable area with almost no gaps
• Zones are clean: public front, service middle, private rear
• All rooms have good proportions (width:height roughly 1:1 to 2:1)

VALID room type names: balcony, living_room, dining, kitchen, master_bedroom, bedroom, bathroom, study, prayer_room, guest_room, utility_room, terrace

Generate exactly ${count} variation objects now. Each variation must have a GENUINELY DIFFERENT spatial arrangement from the example and from each other:`;

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

    // Per-type size constraints (must match layoutGenerator.js ROOM_MIN/ROOM_MAX)
    const RMIN = {
      living_room:{w:13,h:12}, dining:{w:11,h:10}, kitchen:{w:10,h:10},
      master_bedroom:{w:13,h:12}, bedroom:{w:11,h:10}, bathroom:{w:6,h:8},
      study:{w:10,h:10}, balcony:{w:8,h:5}, terrace:{w:8,h:8},
      prayer_room:{w:8,h:8}, guest_room:{w:11,h:10}, utility_room:{w:6,h:8},
    };
    const RMAX = {
      living_room:{w:22,h:18}, dining:{w:16,h:13}, kitchen:{w:14,h:12},
      master_bedroom:{w:16,h:15}, bedroom:{w:14,h:13}, bathroom:{w:9,h:10},
      study:{w:13,h:12}, balcony:{w:bW,h:6}, terrace:{w:20,h:12},
      prayer_room:{w:12,h:10}, guest_room:{w:14,h:12}, utility_room:{w:10,h:10},
    };

    const rooms = Array.isArray(v.rooms) ? v.rooms.map(r => {
      const type = String(r.type || 'bedroom');
      const mn = RMIN[type] || { w: 6, h: 6 };
      const mx = RMAX[type] || { w: bW, h: bL };
      const x  = Math.max(0, parseFloat(r.x) || 0);
      const y  = Math.max(0, parseFloat(r.y) || 0);
      const w  = Math.max(mn.w, Math.min(mx.w, parseFloat(r.width)  || mn.w));
      const h  = Math.max(mn.h, Math.min(mx.h, parseFloat(r.height) || mn.h));
      return {
        type,
        x,
        y,
        width:  Math.min(w, bW - x),
        height: Math.min(h, bL - y),
      };
    }) : [];

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

  // ─── Fix rooms based on validator errors ──────────────────────────────────

  async fixRoomPlacements(rooms, validationErrors, bW, bL, layoutStyle) {
    if (!this.isConfigured()) return null;

    const errorList  = validationErrors.map((e, i) => `${i + 1}. ${e.message}`).join('\n');
    const roomsJson  = JSON.stringify(rooms, null, 2);

    const prompt = `You are a senior Indian residential architect fixing a floor plan. Correct EVERY listed error.

═══ BUILDABLE AREA ═══
Width: ${bW}ft  Depth: ${bL}ft
All coordinates must satisfy: 0 ≤ x, x+width ≤ ${bW}, 0 ≤ y, y+height ≤ ${bL}

═══ CURRENT ROOMS (buildable-relative) ═══
${roomsJson}

═══ ERRORS TO FIX ═══
${errorList}

═══ HARD RULES ═══
1. BOUNDS: every room fully inside the buildable area
2. NO OVERLAP: rooms must not intersect (touching edges OK)
3. COVERAGE ≥ 95%: total room area ≥ ${Math.round(bW * bL * 0.95)} sq.ft — expand rooms or add rooms to fill gaps
4. EN-SUITE: each bathroom must share a side wall with a bedroom (same y-band, touching on x-axis)
5. BATHROOM: width 6–9ft, height 8–10ft
6. BEDROOMS larger than bathrooms. Master ≥ 13×12ft. Regular ≥ 11×10ft
7. LIVING ROOM largest habitable area
8. Keep layout style: ${layoutStyle}

Return ONLY the fixed rooms as a raw JSON array — no markdown, no text:
[{"type":"...","x":...,"y":...,"width":...,"height":...}, ...]`;

    try {
      const result = await this.model.generateContent(prompt);
      const text   = result.response.text();
      const parsed = this.extractJSONArray(text);
      if (!Array.isArray(parsed) || parsed.length === 0) return null;
      return parsed;
    } catch (err) {
      console.error('Gemini fixRoomPlacements failed:', err.message);
      return null;
    }
  }

  // Extracts a JSON array from text (handles both [...] at root level)
  extractJSONArray(text) {
    const stripped = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const s = stripped.indexOf('['), e = stripped.lastIndexOf(']');
    if (s !== -1 && e !== -1) {
      try { return JSON.parse(stripped.slice(s, e + 1)); } catch { /* */ }
    }
    return null;
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
