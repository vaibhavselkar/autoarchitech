#!/usr/bin/env python3
"""
Comprehensive Testing Framework for Floor Plan Generation Models

This framework tests each model systematically and evaluates:
1. Functional Quality (room layout, dimensions, connections)
2. Vastu Compliance (room placement according to Vastu principles)
3. Technical Metrics (generation time, output format, consistency)
4. Integration Readiness (API compatibility, CAD export)
"""

import json
import os
import time
import numpy as np
from datetime import datetime

class FloorPlanTester:
    """Main testing class for floor plan generation models."""
    
    def __init__(self, plot_width=30, plot_depth=50):
        self.plot_width = plot_width
        self.plot_depth = plot_depth
        self.plot_area = plot_width * plot_depth
        self.results = []
        
        # Vastu guidelines
        self.vastu_rules = {
            'master_bedroom': {'direction': 'southwest', 'weight': 25},
            'kitchen': {'direction': 'southeast', 'weight': 25},
            'living_room': {'direction': ['north', 'east', 'northeast'], 'weight': 15},
            'bathroom': {'direction': ['west', 'northwest'], 'weight': 15},
            'bedroom': {'direction': ['south', 'west'], 'weight': 10},
            'dining_room': {'direction': ['east', 'south'], 'weight': 10}
        }
        
        # Room size guidelines (in sq ft)
        self.room_size_guidelines = {
            'master_bedroom': {'min': 120, 'max': 250, 'ideal': 180},
            'bedroom': {'min': 100, 'max': 200, 'ideal': 150},
            'kitchen': {'min': 80, 'max': 200, 'ideal': 120},
            'bathroom': {'min': 40, 'max': 100, 'ideal': 60},
            'living_room': {'min': 150, 'max': 400, 'ideal': 250},
            'dining_room': {'min': 80, 'max': 200, 'ideal': 120}
        }
    
    def get_direction(self, x, y):
        """Determine direction based on coordinates."""
        center_x = self.plot_width / 2
        center_y = self.plot_depth / 2
        
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
    
    def evaluate_vastu_compliance(self, rooms):
        """Evaluate Vastu compliance of the floor plan."""
        score = 0
        max_score = 0
        details = []
        
        for room in rooms:
            room_type = room['type']
            if room_type not in self.vastu_rules:
                continue
            
            rule = self.vastu_rules[room_type]
            max_score += rule['weight']
            
            center_x = (room['bbox']['x1'] + room['bbox']['x2']) / 2
            center_y = (room['bbox']['y1'] + room['bbox']['y2']) / 2
            direction = self.get_direction(center_x, center_y)
            
            allowed_directions = rule['direction']
            if isinstance(allowed_directions, str):
                allowed_directions = [allowed_directions]
            
            if direction in allowed_directions:
                score += rule['weight']
                details.append(f"[PASS] {room_type} in {direction} (correct)")
            else:
                details.append(f"[FAIL] {room_type} in {direction} (should be in {allowed_directions})")
        
        return {
            'score': score,
            'max_score': max_score,
            'percentage': (score / max_score * 100) if max_score > 0 else 0,
            'details': details
        }
    
    def evaluate_room_dimensions(self, rooms):
        """Evaluate if room dimensions are within acceptable ranges."""
        results = []
        
        for room in rooms:
            room_type = room['type']
            area = room['area_sqft']
            
            if room_type in self.room_size_guidelines:
                guideline = self.room_size_guidelines[room_type]
                
                if area < guideline['min']:
                    status = 'too_small'
                    score = 0.3
                elif area > guideline['max']:
                    status = 'too_large'
                    score = 0.5
                else:
                    status = 'acceptable'
                    # Score based on how close to ideal
                    deviation = abs(area - guideline['ideal']) / guideline['ideal']
                    score = max(0.5, 1.0 - deviation)
                
                results.append({
                    'room': room_type,
                    'area': area,
                    'status': status,
                    'score': score,
                    'ideal': guideline['ideal']
                })
        
        avg_score = sum(r['score'] for r in results) / len(results) if results else 0
        return {
            'average_score': avg_score,
            'details': results
        }
    
    def evaluate_space_efficiency(self, rooms):
        """Calculate space efficiency metrics."""
        total_room_area = sum(r['area_sqft'] for r in rooms)
        efficiency = total_room_area / self.plot_area
        
        # Penalize if efficiency is too high (no space for walls/corridors)
        # or too low (wasted space)
        if efficiency > 0.95:
            efficiency_score = 0.7  # Too efficient, no circulation space
        elif efficiency < 0.5:
            efficiency_score = 0.3  # Too much wasted space
        else:
            efficiency_score = min(1.0, efficiency / 0.85)  # Ideal is around 85%
        
        return {
            'total_room_area': total_room_area,
            'plot_area': self.plot_area,
            'efficiency': efficiency,
            'score': efficiency_score
        }
    
    def evaluate_connectivity(self, rooms, doors):
        """Evaluate room connectivity and accessibility."""
        # Check if all rooms are accessible
        # This is a simplified check - in reality, you'd need graph traversal
        
        room_count = len(rooms)
        door_count = len(doors) if doors else 0
        
        # Ideal: each room should have at least one door
        # Minimum doors = room_count - 1 (for a connected layout)
        min_doors = max(1, room_count - 1)
        
        if door_count >= min_doors:
            connectivity_score = min(1.0, door_count / room_count)
        else:
            connectivity_score = door_count / min_doors * 0.5
        
        return {
            'room_count': room_count,
            'door_count': door_count,
            'min_required_doors': min_doors,
            'score': connectivity_score
        }
    
    def evaluate_output_format(self, output):
        """Check if output format is compatible with CAD export."""
        required_fields = ['rooms', 'wall_coordinates']
        optional_fields = ['doors', 'windows']
        
        missing_required = [f for f in required_fields if f not in output]
        missing_optional = [f for f in optional_fields if f not in output]
        
        format_score = 1.0
        if missing_required:
            format_score -= 0.3 * len(missing_required)
        
        return {
            'has_required_fields': len(missing_required) == 0,
            'missing_required': missing_required,
            'missing_optional': missing_optional,
            'score': max(0, format_score)
        }
    
    def run_full_evaluation(self, model_name, output_data, generation_time=None):
        """Run complete evaluation on a model's output."""
        rooms = output_data.get('rooms', [])
        doors = output_data.get('doors', [])
        
        vastu = self.evaluate_vastu_compliance(rooms)
        dimensions = self.evaluate_room_dimensions(rooms)
        efficiency = self.evaluate_space_efficiency(rooms)
        connectivity = self.evaluate_connectivity(rooms, doors)
        format_check = self.evaluate_output_format(output_data)
        
        # Calculate overall score
        weights = {
            'vastu': 0.25,
            'dimensions': 0.20,
            'efficiency': 0.20,
            'connectivity': 0.15,
            'format': 0.20
        }
        
        overall_score = (
            vastu['percentage'] / 100 * weights['vastu'] +
            dimensions['average_score'] * weights['dimensions'] +
            efficiency['score'] * weights['efficiency'] +
            connectivity['score'] * weights['connectivity'] +
            format_check['score'] * weights['format']
        )
        
        result = {
            'model': model_name,
            'timestamp': datetime.now().isoformat(),
            'plot_size': f"{self.plot_width}x{self.plot_depth}",
            'generation_time': generation_time,
            'scores': {
                'vastu_compliance': vastu['percentage'],
                'room_dimensions': dimensions['average_score'] * 100,
                'space_efficiency': efficiency['efficiency'] * 100,
                'connectivity': connectivity['score'] * 100,
                'output_format': format_check['score'] * 100,
                'overall': overall_score * 100
            },
            'details': {
                'vastu': vastu,
                'dimensions': dimensions,
                'efficiency': efficiency,
                'connectivity': connectivity,
                'format': format_check
            }
        }
        
        self.results.append(result)
        return result
    
    def print_detailed_report(self, result):
        """Print a detailed evaluation report."""
        print("\n" + "=" * 80)
        print(f"DETAILED EVALUATION REPORT: {result['model']}")
        print(f"Plot Size: {result['plot_size']} feet")
        print(f"Timestamp: {result['timestamp']}")
        if result['generation_time']:
            print(f"Generation Time: {result['generation_time']:.2f} seconds")
        print("=" * 80)
        
        print("\n--- SCORES ---")
        for metric, score in result['scores'].items():
            filled = int(score / 5)
            bar = "#" * filled + "-" * (20 - filled)
            print(f"  {metric:20s}: {score:5.1f}% |{bar}|")
        
        print(f"\n  {'OVERALL SCORE':20s}: {result['scores']['overall']:5.1f}%")
        
        print("\n--- VASTU COMPLIANCE ---")
        for detail in result['details']['vastu']['details']:
            print(f"  {detail}")
        
        print("\n--- ROOM DIMENSIONS ---")
        for detail in result['details']['dimensions']['details']:
            status_icon = "[OK]" if detail['status'] == 'acceptable' else "[!!]"
            print(f"  {status_icon} {detail['room']:15s}: {detail['area']:6.0f} sq ft (ideal: {detail['ideal']} sq ft) - {detail['status']}")
        
        print("\n--- SPACE EFFICIENCY ---")
        print(f"  Total Room Area: {result['details']['efficiency']['total_room_area']:.0f} sq ft")
        print(f"  Plot Area: {result['details']['efficiency']['plot_area']:.0f} sq ft")
        print(f"  Efficiency: {result['details']['efficiency']['efficiency']:.1%}")
        
        print("\n--- CONNECTIVITY ---")
        print(f"  Rooms: {result['details']['connectivity']['room_count']}")
        print(f"  Doors: {result['details']['connectivity']['door_count']}")
        print(f"  Minimum Required: {result['details']['connectivity']['min_required_doors']}")
        
        print("\n--- OUTPUT FORMAT ---")
        print(f"  Required Fields Present: {result['details']['format']['has_required_fields']}")
        if result['details']['format']['missing_required']:
            print(f"  Missing Required: {result['details']['format']['missing_required']}")
        if result['details']['format']['missing_optional']:
            print(f"  Missing Optional: {result['details']['format']['missing_optional']}")
    
    def compare_all_results(self):
        """Compare results from all tested models."""
        if not self.results:
            print("No results to compare.")
            return
        
        print("\n" + "=" * 80)
        print("MODEL COMPARISON SUMMARY")
        print("=" * 80)
        print(f"{'Model':25s} {'Vastu':>8s} {'Dimensions':>12s} {'Efficiency':>10s} {'Overall':>8s}")
        print("-" * 80)
        
        for result in self.results:
            scores = result['scores']
            print(f"{result['model']:25s} {scores['vastu_compliance']:8.1f}% {scores['room_dimensions']:12.1f}% {scores['space_efficiency']:10.1f}% {scores['overall']:8.1f}%")
        
        # Find best in each category
        print("\n--- BEST IN CATEGORY ---")
        categories = ['vastu_compliance', 'room_dimensions', 'space_efficiency', 'overall']
        for cat in categories:
            best = max(self.results, key=lambda r: r['scores'][cat])
            print(f"  {cat:20s}: {best['model']} ({best['scores'][cat]:.1f}%)")
    
    def save_results(self, filename='test_results.json'):
        """Save test results to a JSON file."""
        with open(filename, 'w') as f:
            json.dump(self.results, f, indent=2)
        print(f"\nResults saved to {filename}")


def load_model_output(model_name):
    """Load sample output for a model."""
    path = os.path.join(os.path.dirname(__file__), 'sample_outputs', f'{model_name}_output.json')
    if os.path.exists(path):
        with open(path, 'r') as f:
            return json.load(f)
    return None


if __name__ == '__main__':
    # Create tester instance
    tester = FloorPlanTester(plot_width=30, plot_depth=50)
    
    # Test each model
    models = ['housediffusion', 'ce2eplan', 'graph2plan']
    
    for model in models:
        print(f"\n\n{'='*80}")
        print(f"TESTING MODEL: {model}")
        print('='*80)
        
        data = load_model_output(model)
        if data:
            output = data.get('output', {})
            generation_time = data.get('metrics', {}).get('generation_time_seconds')
            
            result = tester.run_full_evaluation(
                model_name=data.get('model', model),
                output_data=output,
                generation_time=generation_time
            )
            
            tester.print_detailed_report(result)
    
    # Compare all results
    tester.compare_all_results()
    tester.save_results('models/test_results.json')