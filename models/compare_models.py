#!/usr/bin/env python3
"""
Model Comparison Script for Floor Plan Generation Models

This script compares the outputs of HouseDiffusion, CE2EPlan (HouseGAN++), 
and Graph2Plan models for a 30x50 plot boundary.

It analyzes:
1. Room dimension accuracy
2. Space efficiency
3. Wall coordinate extraction for CAD export
4. Vastu compliance potential
"""

import json
import os

def load_model_output(model_name):
    """Load the output JSON for a specific model."""
    path = os.path.join(os.path.dirname(__file__), 'sample_outputs', f'{model_name}_output.json')
    with open(path, 'r') as f:
        return json.load(f)

def analyze_room_dimensions(data):
    """Analyze room dimensions for accuracy and合理性."""
    rooms = data['output']['rooms']
    analysis = {
        'total_rooms': len(rooms),
        'total_area': sum(r['area_sqft'] for r in rooms),
        'room_types': {},
        'avg_room_area': 0,
        'min_room_area': float('inf'),
        'max_room_area': 0,
        'area_variance': 0
    }
    
    areas = []
    for room in rooms:
        room_type = room['type']
        if room_type not in analysis['room_types']:
            analysis['room_types'][room_type] = []
        analysis['room_types'][room_type].append(room['area_sqft'])
        areas.append(room['area_sqft'])
        
        if room['area_sqft'] < analysis['min_room_area']:
            analysis['min_room_area'] = room['area_sqft']
        if room['area_sqft'] > analysis['max_room_area']:
            analysis['max_room_area'] = room['area_sqft']
    
    analysis['avg_room_area'] = sum(areas) / len(areas)
    analysis['area_variance'] = sum((a - analysis['avg_room_area'])**2 for a in areas) / len(areas)
    
    return analysis

def calculate_efficiency(data):
    """Calculate space efficiency (usable area / total boundary area)."""
    boundary_area = 30 * 50  # 1500 sq ft
    total_room_area = sum(r['area_sqft'] for r in data['output']['rooms'])
    return total_room_area / boundary_area

def extract_wall_coordinates(data):
    """Extract wall coordinates for CAD export."""
    return data.get('wall_coordinates', [])

def analyze_vastu_compliance(data):
    """
    Analyze Vastu compliance based on room positions.
    
    Vastu principles:
    - Master bedroom: Southwest
    - Kitchen: Southeast  
    - Living room: North/East
    - Bathrooms: West/Northwest
    - Entrance: North/East
    """
    rooms = data['output']['rooms']
    boundary_w = 30
    boundary_h = 50
    
    # Calculate center of each room
    room_centers = {}
    for room in rooms:
        bbox = room['bbox']
        center_x = (bbox['x1'] + bbox['x2']) / 2
        center_y = (bbox['y1'] + bbox['y2']) / 2
        room_centers[room['type']] = (center_x, center_y)
    
    vastu_score = 0
    max_score = 100
    deductions = []
    
    # Check master bedroom (should be in southwest - lower left in our coordinate system)
    if 'master_bedroom' in room_centers:
        x, y = room_centers['master_bedroom']
        if x < boundary_w/2 and y > boundary_h/2:  # Southwest
            vastu_score += 20
        else:
            deductions.append(f"Master bedroom not in southwest (pos: {x}, {y})")
    
    # Check kitchen (should be in southeast - lower right)
    if 'kitchen' in room_centers:
        x, y = room_centers['kitchen']
        if x > boundary_w/2 and y > boundary_h/2:  # Southeast
            vastu_score += 20
        else:
            deductions.append(f"Kitchen not in southeast (pos: {x}, {y})")
    
    # Check living room (should be in north/east - upper area)
    if 'living_room' in room_centers:
        x, y = room_centers['living_room']
        if y < boundary_h/2:  # North half
            vastu_score += 15
        else:
            deductions.append(f"Living room not in north (pos: {x}, {y})")
    
    # Check bathrooms (should be in west/northwest)
    bathroom_count = sum(1 for r in rooms if r['type'] == 'bathroom')
    bathrooms_correct = 0
    for room in rooms:
        if room['type'] == 'bathroom':
            x, y = room_centers['bathroom']
            if x < boundary_w/2:  # West half
                bathrooms_correct += 1
    
    if bathrooms_correct == bathroom_count:
        vastu_score += 15
    else:
        deductions.append(f"Not all bathrooms in west ({bathrooms_correct}/{bathroom_count})")
    
    # Normalize score
    vastu_percentage = (vastu_score / max_score) * 100
    
    return {
        'score': vastu_score,
        'max_score': max_score,
        'percentage': vastu_percentage,
        'deductions': deductions
    }

def compare_models():
    """Compare all three models."""
    models = ['housediffusion', 'ce2eplan', 'graph2plan']
    results = []
    
    print("=" * 80)
    print("FLOOR PLAN GENERATION MODEL COMPARISON")
    print("Input: 30x50 feet plot boundary")
    print("=" * 80)
    
    for model_name in models:
        data = load_model_output(model_name)
        
        room_analysis = analyze_room_dimensions(data)
        efficiency = calculate_efficiency(data)
        walls = extract_wall_coordinates(data)
        vastu = analyze_vastu_compliance(data)
        
        result = {
            'model': data['model'],
            'generation_time': data['metrics']['generation_time_seconds'],
            'total_area': room_analysis['total_area'],
            'efficiency': efficiency,
            'room_count': room_analysis['total_rooms'],
            'avg_room_area': room_analysis['avg_room_area'],
            'vastu_score': vastu['percentage'],
            'wall_count': len(walls)
        }
        results.append(result)
        
        print(f"\n--- {data['model']} ---")
        print(f"  Generation Time: {result['generation_time']:.1f} seconds")
        print(f"  Total Room Area: {result['total_area']} sq ft")
        print(f"  Efficiency: {result['efficiency']:.1%}")
        print(f"  Room Count: {result['room_count']}")
        print(f"  Avg Room Area: {result['avg_room_area']:.1f} sq ft")
        print(f"  Vastu Compliance: {result['vastu_score']:.1f}%")
        print(f"  Wall Segments: {result['wall_count']}")
        
        if vastu['deductions']:
            print(f"  Vastu Issues:")
            for d in vastu['deductions']:
                print(f"    - {d}")
    
    # Summary comparison
    print("\n" + "=" * 80)
    print("SUMMARY COMPARISON")
    print("=" * 80)
    
    # Find best in each category
    fastest = max(results, key=lambda x: 1/x['generation_time'] if x['generation_time'] > 0 else 0)
    most_efficient = max(results, key=lambda x: x['efficiency'])
    best_vastu = max(results, key=lambda x: x['vastu_score'])
    
    print(f"\nFastest Generation: {fastest['model']} ({fastest['generation_time']:.1f}s)")
    print(f"Highest Efficiency: {most_efficient['model']} ({most_efficient['efficiency']:.1%})")
    print(f"Best Vastu Compliance: {best_vastu['model']} ({best_vastu['vastu_score']:.1f}%)")
    
    # Overall recommendation
    print("\n" + "=" * 80)
    print("RECOMMENDATION FOR VASTU-COMPLIANT HOUSE PLANNING")
    print("=" * 80)
    
    # Calculate weighted score (Vastu is most important for this use case)
    for r in results:
        r['weighted_score'] = (
            r['vastu_score'] * 0.4 +  # Vastu compliance is most important
            r['efficiency'] * 100 * 0.3 +  # Space efficiency
            (1 / r['generation_time']) * 50 * 0.2 +  # Speed (inverse)
            r['room_count'] * 5 * 0.1  # Room count variety
        )
    
    best_overall = max(results, key=lambda x: x['weighted_score'])
    print(f"\nBest Overall for Vastu Planning: {best_overall['model']}")
    print(f"  Weighted Score: {best_overall['weighted_score']:.1f}")
    
    return results

def export_to_cad_format(model_name):
    """Export wall coordinates to a CAD-compatible format."""
    data = load_model_output(model_name)
    walls = extract_wall_coordinates(data)
    
    cad_output = {
        "drawing_name": f"floorplan_{model_name}_30x50",
        "units": "feet",
        "boundary": {"width": 30, "depth": 50},
        "entities": []
    }
    
    for wall in walls:
        cad_output["entities"].append({
            "type": "LINE",
            "start": wall["start"],
            "end": wall["end"]
        })
    
    # Add room labels
    for room in data["output"]["rooms"]:
        cad_output["entities"].append({
            "type": "TEXT",
            "position": room["center"],
            "text": f"{room['type']}\n{room['area_sqft']} sqft"
        })
    
    output_path = os.path.join(os.path.dirname(__file__), 'sample_outputs', f'{model_name}_cad_export.json')
    with open(output_path, 'w') as f:
        json.dump(cad_output, f, indent=2)
    
    print(f"\nCAD export saved to: {output_path}")
    return cad_output

if __name__ == '__main__':
    # Run comparison
    results = compare_models()
    
    # Export CAD formats for each model
    for model in ['housediffusion', 'ce2eplan', 'graph2plan']:
        export_to_cad_format(model)