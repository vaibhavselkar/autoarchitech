# Floor Plan Generation Models Testing Report

## Executive Summary

This report documents the setup and testing process for three open-source floor plan generation models:
1. **HouseDiffusion** - Vector floorplan generation via diffusion model
2. **CE2EPlan (HouseGAN++)** - End-to-end floorplan generation using GANs
3. **Graph2Plan** - Floorplan generation from layout graphs

## Model Sources

### 1. HouseDiffusion
- **Official Repository**: https://github.com/aminshabani/house_diffusion
- **Paper**: HouseDiffusion: Vector Floorplan Generation via a Diffusion Model with Discrete and Continuous Denoising (2022)
- **Key Features**: 
  - Uses diffusion models for vector floorplan generation
  - Handles both discrete (room types) and continuous (coordinates) denoising
  - Trained on RPLAN dataset (80K floorplans)

### 2. CE2EPlan / HouseGAN++
- **Official Repository**: https://github.com/ennauata/houseganpp
- **Paper**: HouseGAN++: Probabilistic Typo-Graphical Floorplan Generation using a Relational Graph Convolutional Network
- **Key Features**:
  - Graph-based GAN for floorplan generation
  - Incremental room placement
  - Uses relational graph convolution

### 3. Graph2Plan
- **Official Repository**: https://github.com/HanHan55/Graph2plan
- **Paper**: Graph2Plan: Learning Floorplan Generation from Layout Graphs (SIGGRAPH 2020)
- **Key Features**:
  - Converts layout graphs to floorplans
  - Interactive interface for user constraints
  - Uses graph neural networks (GNN)

## Setup Process

### Environment Setup

All three models were set up with separate Python virtual environments to avoid dependency conflicts:

```bash
# Create virtual environments
python -m venv models/HouseDiffusion/venv
python -m venv models/CE2EPlan/venv
python -m venv models/Graph2Plan/venv
```

### Dependencies Installed

#### HouseDiffusion
```
blobfile, cairosvg, drawSvg, imageio, matplotlib, networkx, numpy, 
opencv-python, Pillow, pytorch-fid, shapely, tqdm, webcolors, 
torch, torchvision, torchaudio
```

#### CE2EPlan (HouseGAN++)
```
matplotlib, networkx, numpy, opencv-python, Pillow, pytz, svgwrite,
torch, torchvision, torchaudio, webcolors, scikit-image
```

#### Graph2Plan
```
torch, torchvision, torchaudio, opencv-python, scipy, pandas, 
shapely, tqdm
```

## Challenges Encountered

### 1. Dataset Requirements
All three models require the **RPLAN dataset** which:
- Needs to be requested from the original authors
- Requires preprocessing before use
- Is approximately 80,000 floorplans

### 2. Pretrained Model Checkpoints
- **HouseDiffusion**: Checkpoint available via Google Drive (needs download)
- **CE2EPlan**: Pretrained checkpoint included in repository
- **Graph2Plan**: Requires training or downloading from releases

### 3. Additional Dependencies
- **Graph2Plan**: Requires MATLAB for post-processing (alignment of room boxes)
- **CE2EPlan**: Requires Graphviz/pygraphviz for graph visualization
- **HouseDiffusion**: Requires specific PyTorch version compatibility

### 4. Python Version Compatibility
The models were originally developed for Python 3.7-3.9. Running on Python 3.12 required:
- Using latest compatible package versions
- Some version conflicts with numpy (2.x vs 1.x requirements)

## Testing Framework

### Sample Input: 30x50 Plot Boundary

For a 30x50 feet plot (approximately 9m x 15m), the expected input format would be:

```python
# Boundary definition (in normalized coordinates)
boundary = {
    "width": 30,      # feet
    "depth": 50,      # feet
    "door_position": "front",  # or specific coordinates
    "constraints": {
        "min_rooms": 3,
        "required_rooms": ["bedroom", "kitchen", "bathroom"],
        "vastu_preferences": {
            "master_bedroom": "southwest",
            "kitchen": "southeast",
            "entrance": "north"
        }
    }
}
```

### Expected Output Format

```json
{
    "floorplan": {
        "boundary": {"width": 30, "depth": 50},
        "rooms": [
            {
                "type": "bedroom",
                "bbox": {"x1": 0, "y1": 0, "x2": 12, "y2": 15},
                "dimensions": {"width": 12, "depth": 15},
                "area_sqft": 180
            },
            // ... more rooms
        ],
        "doors": [
            {"from": "room1", "to": "room2", "position": [x, y]}
        ],
        "windows": [
            {"room": "room1", "wall": "north", "position": [x, y]}
        ]
    },
    "metrics": {
        "total_area": 1500,
        "efficiency": 0.85,
        "vastu_compliance": 0.7
    }
}
```

## Performance Metrics Framework

When properly set up, the following metrics should be measured:

### 1. Generation Time
```python
import time

start_time = time.time()
# Run model inference
generation_time = time.time() - start_time
```

### 2. Room Dimension Accuracy
```python
def calculate_dimension_accuracy(predicted_rooms, ground_truth_rooms):
    """Calculate how accurately room dimensions match expected sizes."""
    errors = []
    for pred, truth in zip(predicted_rooms, ground_truth_rooms):
        dim_error = abs(pred['area'] - truth['area']) / truth['area']
        errors.append(dim_error)
    return 1 - np.mean(errors)  # Higher is better
```

### 3. Vastu Compliance Score
```python
def calculate_vastu_compliance(floorplan):
    """Calculate Vastu compliance based on room positions."""
    vastu_rules = {
        'master_bedroom': 'southwest',
        'kitchen': 'southeast',
        'entrance': ['north', 'east'],
        'bathroom': ['west', 'northwest']
    }
    # Implementation would check room positions against rules
    pass
```

## Recommendations

### For Production Use

1. **Dataset Preparation**: Download and preprocess the RPLAN dataset
2. **Model Training**: Fine-tune models on Vastu-compliant floorplans
3. **Post-processing**: Implement custom post-processing without MATLAB dependency
4. **API Development**: Create REST API endpoints for each model

### For Vastu Compliance

1. Create a Vastu-compliant floorplan dataset
2. Fine-tune models with Vastu constraints as additional input
3. Implement Vastu validation as post-processing step

### Alternative Approach

Given the complexity of setting up these research models, consider:
1. Using the existing `layoutGenerator.js` in the backend
2. Building a custom solution using constraint satisfaction
3. Training a simpler model specifically for Vastu-compliant layouts

## Conclusion

While the three models (HouseDiffusion, CE2EPlan/HouseGAN++, Graph2Plan) represent state-of-the-art in floor plan generation, they require significant setup effort including:
- RPLAN dataset acquisition and preprocessing
- MATLAB installation (for Graph2Plan)
- Graphviz installation (for CE2EPlan)
- Model checkpoint downloads

For immediate Vastu-compliant house planning needs, a hybrid approach combining rule-based generation with machine learning refinement may be more practical.

## Next Steps

1. Download RPLAN dataset from official sources
2. Set up MATLAB or implement alternative post-processing
3. Download pretrained checkpoints
4. Run full inference tests with 30x50 plot boundary
5. Extract wall coordinates and format as JSON for CAD export
6. Measure generation time and room dimension accuracy