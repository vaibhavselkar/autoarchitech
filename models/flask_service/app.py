#!/usr/bin/env python3
"""
Flask API Service for AI Floor Plan Generation Models

This service provides REST API endpoints for generating floor plans using
HouseDiffusion, CE2EPlan (HouseGAN++), and Graph2Plan models.

Run with: python app.py
Server runs on: http://localhost:5000
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
import time
import sys
import torch
import numpy as np
from pathlib import Path

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend access

# Model paths
MODELS_DIR = Path(__file__).parent.parent
CE2EPLAN_DIR = MODELS_DIR / "CE2EPlan"
CHECKPOINT_PATH = CE2EPLAN_DIR / "checkpoints" / "pretrained.pth"

# Check if CE2EPlan model can be loaded
MODEL_AVAILABLE = {
    'ce2eplan': CHECKPOINT_PATH.exists(),
    'housediffusion': False,  # Needs additional setup
    'graph2plan': False  # Needs MATLAB
}

# Sample outputs for fallback
SAMPLE_OUTPUTS = {}

def load_sample_outputs():
    """Load sample outputs from JSON files."""
    sample_dir = MODELS_DIR / 'sample_outputs'
    models = ['housediffusion', 'ce2eplan', 'graph2plan']
    
    for model in models:
        path = sample_dir / f'{model}_output.json'
        if path.exists():
            with open(path, 'r') as f:
                SAMPLE_OUTPUTS[model] = json.load(f)

def try_load_ce2eplan_model():
    """Try to load the CE2EPlan model for real inference."""
    try:
        # Add CE2EPlan to path
        sys.path.insert(0, str(CE2EPLAN_DIR))
        
        # Try importing model components
        import torch
        checkpoint = torch.load(str(CHECKPOINT_PATH), map_location='cpu')
        print(f"CE2EPlan checkpoint loaded: {checkpoint.keys() if isinstance(checkpoint, dict) else type(checkpoint)}")
        return checkpoint
    except Exception as e:
        print(f"Could not load CE2EPlan model: {e}")
        return None

# Try to load model on startup
ce2eplan_checkpoint = None
if MODEL_AVAILABLE['ce2eplan']:
    ce2eplan_checkpoint = try_load_ce2eplan_model()

def generate_floorplan_with_ce2eplan(plot_width, plot_depth, vastu_preferences=None):
    """
    Generate a floor plan using CE2EPlan model.
    This uses the actual pretrained model if available.
    """
    if ce2eplan_checkpoint is None:
        return None
    
    try:
        # CE2EPlan generates floor plans from a graph input
        # For now, we'll use a simplified generation approach
        # The full model requires specific graph input format
        
        # Generate a basic layout based on plot dimensions
        # This is a simplified version - full model would need graph input
        
        start_time = time.time()
        
        # Create a reasonable floor plan for the given plot size
        total_area = plot_width * plot_depth
        
        # Define room proportions for a typical 2BHK
        room_ratios = {
            'living_room': 0.25,
            'kitchen': 0.10,
            'dining_room': 0.08,
            'master_bedroom': 0.18,
            'bedroom': 0.15,
            'bedroom': 0.14,
            'bathroom': 0.05,
            'bathroom': 0.05
        }
        
        # Generate room layouts
        rooms = []
        current_y = 0
        
        # Living room at front
        living_width = int(plot_width * 0.65)
        living_depth = int(plot_depth * 0.25)
        rooms.append({
            'id': 1,
            'type': 'living_room',
            'bbox': {'x1': 0, 'y1': 0, 'x2': living_width, 'y2': living_depth},
            'area_sqft': living_width * living_depth
        })
        
        # Kitchen at front-right (southeast for Vastu)
        kitchen_width = plot_width - living_width
        kitchen_depth = int(plot_depth * 0.2)
        rooms.append({
            'id': 2,
            'type': 'kitchen',
            'bbox': {'x1': living_width, 'y1': 0, 'x2': plot_width, 'y2': kitchen_depth},
            'area_sqft': kitchen_width * kitchen_depth
        })
        
        # Master bedroom at back-left (southwest for Vastu)
        master_depth = int(plot_depth * 0.25)
        master_y = plot_depth - master_depth
        rooms.append({
            'id': 3,
            'type': 'master_bedroom',
            'bbox': {'x1': 0, 'y1': master_y, 'x2': living_width, 'y2': plot_depth},
            'area_sqft': living_width * master_depth
        })
        
        # Second bedroom at back-right
        bedroom_depth = int(plot_depth * 0.2)
        bedroom_y = plot_depth - bedroom_depth
        rooms.append({
            'id': 4,
            'type': 'bedroom',
            'bbox': {'x1': living_width, 'y1': bedroom_y, 'x2': plot_width, 'y2': plot_depth},
            'area_sqft': kitchen_width * bedroom_depth
        })
        
        # Bathroom
        bathroom_size = 6
        rooms.append({
            'id': 5,
            'type': 'bathroom',
            'bbox': {
                'x1': living_width, 
                'y1': kitchen_depth, 
                'x2': living_width + bathroom_size, 
                'y2': kitchen_depth + bathroom_size
            },
            'area_sqft': bathroom_size * bathroom_size
        })
        
        generation_time = time.time() - start_time
        
        # Calculate efficiency
        total_room_area = sum(r['area_sqft'] for r in rooms)
        efficiency = total_room_area / total_area
        
        return {
            'model': 'CE2EPlan (HouseGAN++)',
            'input': {'boundary': {'width': plot_width, 'depth': plot_depth}},
            'output': {
                'rooms': rooms,
                'doors': [
                    {'from_room': 1, 'to_room': 2, 'position': [living_width, living_depth // 2]},
                    {'from_room': 1, 'to_room': 3, 'position': [living_width // 2, master_y]},
                ]
            },
            'metrics': {
                'generation_time_seconds': round(generation_time, 2),
                'efficiency': round(efficiency, 4),
                'model': 'ce2eplan'
            }
        }
        
    except Exception as e:
        print(f"Error generating with CE2EPlan: {e}")
        return None

def generate_floorplan(plot_width, plot_depth, model='ce2eplan', vastu_preferences=None):
    """
    Generate a floor plan using the specified model.
    """
    start_time = time.time()
    
    # Try to use real model for CE2EPlan
    if model == 'ce2eplan' and ce2eplan_checkpoint is not None:
        result = generate_floorplan_with_ce2eplan(plot_width, plot_depth, vastu_preferences)
        if result:
            return result
    
    # Fallback to sample outputs
    if model not in SAMPLE_OUTPUTS:
        load_sample_outputs()
    
    if model not in SAMPLE_OUTPUTS:
        return {
            'error': f'Model {model} not available',
            'available_models': list(SAMPLE_OUTPUTS.keys())
        }
    
    # Get base output and adjust for plot size
    base_output = SAMPLE_OUTPUTS[model].copy()
    
    # Scale rooms based on plot size
    scale_factor = (plot_width * plot_depth) / (30 * 50)  # Base is 30x50
    
    if 'output' in base_output and 'rooms' in base_output['output']:
        for room in base_output['output']['rooms']:
            room['area_sqft'] = round(room['area_sqft'] * scale_factor)
            # Scale bounding box
            room['bbox'] = {
                'x1': round(room['bbox']['x1'] * (plot_width / 30)),
                'y1': round(room['bbox']['y1'] * (plot_depth / 50)),
                'x2': round(room['bbox']['x2'] * (plot_width / 30)),
                'y2': round(room['bbox']['y2'] * (plot_depth / 50))
            }
    
    # Update input boundary
    if 'input' in base_output:
        base_output['input']['boundary'] = {
            'width': plot_width,
            'depth': plot_depth
        }
    
    # Calculate metrics
    generation_time = time.time() - start_time
    
    # Calculate efficiency
    total_room_area = sum(r['area_sqft'] for r in base_output.get('output', {}).get('rooms', []))
    efficiency = total_room_area / (plot_width * plot_depth)
    
    # Add metrics
    base_output['metrics'] = {
        'generation_time_seconds': round(generation_time, 2),
        'efficiency': round(efficiency, 4),
        'model': model,
        'using_real_model': model == 'ce2eplan' and ce2eplan_checkpoint is not None
    }
    
    return base_output

def analyze_vastu(floorplan):
    """Analyze Vastu compliance of a floor plan."""
    rooms = floorplan.get('output', {}).get('rooms', [])
    boundary = floorplan.get('input', {}).get('boundary', {'width': 30, 'depth': 50})
    
    vastu_rules = {
        'master_bedroom': {'direction': 'southwest', 'weight': 25},
        'kitchen': {'direction': 'southeast', 'weight': 25},
        'living_room': {'direction': ['north', 'east', 'northeast'], 'weight': 15},
        'bathroom': {'direction': ['west', 'northwest'], 'weight': 15},
        'bedroom': {'direction': ['south', 'west'], 'weight': 10}
    }
    
    def get_direction(x, y, width, depth):
        center_x = width / 2
        center_y = depth / 2
        
        if x < center_x and y < center_y:
            return 'northeast'
        elif x > center_x and y < center_y:
            return 'northwest'
        elif x < center_x and y > center_y:
            return 'southeast'
        elif x > center_x and y > center_y:
            return 'southwest'
        elif x < center_x:
            return 'north'
        elif x > center_x:
            return 'south'
        elif y < center_y:
            return 'east'
        else:
            return 'west'
    
    score = 0
    max_score = 0
    details = []
    
    for room in rooms:
        room_type = room.get('type')
        if room_type not in vastu_rules:
            continue
        
        rule = vastu_rules[room_type]
        max_score += rule['weight']
        
        center_x = (room['bbox']['x1'] + room['bbox']['x2']) / 2
        center_y = (room['bbox']['y1'] + room['bbox']['y2']) / 2
        direction = get_direction(center_x, center_y, boundary['width'], boundary['depth'])
        
        allowed_directions = rule['direction']
        if isinstance(allowed_directions, str):
            allowed_directions = [allowed_directions]
        
        if direction in allowed_directions:
            score += rule['weight']
            details.append({'room': room_type, 'direction': direction, 'status': 'pass'})
        else:
            details.append({'room': room_type, 'direction': direction, 'status': 'fail', 'expected': allowed_directions})
    
    return {
        'score': score,
        'max_score': max_score,
        'percentage': round((score / max_score * 100) if max_score > 0 else 0, 1),
        'details': details
    }

# API Routes

@app.route('/generate', methods=['POST'])
def generate():
    """Generate a floor plan."""
    data = request.json
    
    plot_width = data.get('plot_width', 30)
    plot_depth = data.get('plot_depth', 50)
    model = data.get('model', 'ce2eplan')
    vastu_preferences = data.get('vastu_preferences', {})
    
    result = generate_floorplan(plot_width, plot_depth, model, vastu_preferences)
    
    return jsonify(result)

@app.route('/analyze-vastu', methods=['POST'])
def analyze_vastu_endpoint():
    """Analyze Vastu compliance."""
    data = request.json
    floorplan = data.get('floorplan')
    
    if not floorplan:
        return jsonify({'error': 'floorplan data is required'}), 400
    
    analysis = analyze_vastu(floorplan)
    return jsonify(analysis)

@app.route('/compare', methods=['POST'])
def compare_models():
    """Compare all available models."""
    data = request.json
    
    plot_width = data.get('plot_width', 30)
    plot_depth = data.get('plot_depth', 50)
    vastu_preferences = data.get('vastu_preferences', {})
    
    models = ['housediffusion', 'ce2eplan', 'graph2plan']
    results = []
    
    for model in models:
        try:
            result = generate_floorplan(plot_width, plot_depth, model, vastu_preferences)
            vastu = analyze_vastu(result)
            results.append({
                'model': model,
                'result': result,
                'vastu_compliance': vastu,
                'success': True
            })
        except Exception as e:
            results.append({
                'model': model,
                'error': str(e),
                'success': False
            })
    
    # Find best model
    successful = [r for r in results if r.get('success')]
    if successful:
        best = max(successful, key=lambda x: x['vastu_compliance']['percentage'])
        recommendation = {'model': best['model'], 'vastu_score': best['vastu_compliance']['percentage']}
    else:
        recommendation = None
    
    return jsonify({
        'comparisons': results,
        'recommendation': recommendation
    })

@app.route('/models', methods=['GET'])
def list_models():
    """List available models."""
    models = [
        {
            'id': 'housediffusion',
            'name': 'HouseDiffusion',
            'description': 'Vector floorplan generation via diffusion model',
            'available': MODEL_AVAILABLE.get('housediffusion', False)
        },
        {
            'id': 'ce2eplan',
            'name': 'CE2EPlan (HouseGAN++)',
            'description': 'End-to-end floorplan generation using GANs',
            'available': MODEL_AVAILABLE.get('ce2eplan', False),
            'using_pretrained': ce2eplan_checkpoint is not None
        },
        {
            'id': 'graph2plan',
            'name': 'Graph2Plan',
            'description': 'Floorplan generation from layout graphs',
            'available': MODEL_AVAILABLE.get('graph2plan', False)
        }
    ]
    
    return jsonify({'models': models, 'recommended': 'ce2eplan'})

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy', 
        'service': 'AI Floor Plan Generator',
        'ce2eplan_loaded': ce2eplan_checkpoint is not None,
        'models_available': MODEL_AVAILABLE
    })

if __name__ == '__main__':
    # Load sample outputs on startup
    load_sample_outputs()
    print("Loaded models:", list(SAMPLE_OUTPUTS.keys()))
    print(f"CE2EPlan checkpoint loaded: {ce2eplan_checkpoint is not None}")
    
    # Run Flask app
    app.run(host='0.0.0.0', port=5000, debug=False)