# AI Model Integration Guide

This guide explains how to integrate the AI floor plan generation models with your AutoArchitect application.

## Quick Start

### 1. Start the Flask Service (Optional)

The Flask service provides real-time API access to the AI models. This is optional - the system works with fallback data if the Flask service is not running.

```bash
# Navigate to flask service directory
cd models/flask_service

# Install dependencies
pip install -r requirements.txt

# Run the service
python app.py
```

The service will start on `http://localhost:5000`

### 2. Enable Python Service in Backend

Edit `backend/.env` and set:

```env
PYTHON_SERVICE_ENABLED=true
PYTHON_MODEL_SERVICE_URL=http://localhost:5000
```

### 3. Start the Backend

```bash
cd backend
npm start
```

### 4. Start the Frontend

```bash
cd frontend
npm start
```

### 5. Access the AI Model Tester

Navigate to `http://localhost:3000/ai-tester` in your browser.

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│    Backend      │────▶│  Flask Service  │
│  (React)        │     │  (Node.js)      │     │  (Python)       │
│                 │     │                 │     │                 │
│ AIModelTester   │     │ modelService.js │     │ app.py          │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │  Sample Outputs │
                       │  (JSON files)   │
                       └─────────────────┘
```

## API Endpoints

### Backend AI Routes (`/api/ai/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/generate-floorplan` | POST | Generate floor plan with selected model |
| `/compare-models` | POST | Compare all three models |
| `/analyze-vastu` | POST | Analyze Vastu compliance |
| `/available-models` | GET | List available AI models |
| `/save-generated-plan` | POST | Save generated plan to database |

### Flask Service Routes (`http://localhost:5000/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/generate` | POST | Generate floor plan |
| `/analyze-vastu` | POST | Analyze Vastu compliance |
| `/compare` | POST | Compare all models |
| `/models` | GET | List available models |
| `/health` | GET | Health check |

## Models Available

### 1. HouseDiffusion
- **Type**: Diffusion Model
- **Best For**: High-quality architectural designs
- **Strengths**: Good room dimensions, varied layouts
- **Weaknesses**: Slower generation, lower Vastu compliance

### 2. CE2EPlan (HouseGAN++)
- **Type**: GAN (Generative Adversarial Network)
- **Best For**: Quick iterations, space-efficient designs
- **Strengths**: Fastest generation (1.8s), highest efficiency (87.2%)
- **Weaknesses**: Room sizes can be larger than ideal

### 3. Graph2Plan
- **Type**: Graph Neural Network
- **Best For**: Constraint-based design exploration
- **Strengths**: Graph-based constraints, structured layouts
- **Weaknesses**: Slowest generation (3.2s)

## Testing Results Summary

| Model | Overall | Vastu | Dimensions | Efficiency |
|-------|---------|-------|------------|------------|
| HouseDiffusion | 60.3% | 14.3% | 59.2% | 78.3% |
| CE2EPlan | 63.1% | 23.8% | 53.2% | 87.2% |
| Graph2Plan | 60.4% | 14.3% | 57.9% | 79.5% |

## Current Limitations

1. **Vastu Compliance**: All models score low on Vastu compliance (14-24%) because they were trained on Western floorplan datasets (RPLAN). Fine-tuning on Indian Vastu-compliant floorplans is needed.

2. **Room Sizes**: Kitchens and secondary bedrooms tend to be larger than ideal for Indian homes.

3. **Python Service**: Currently uses sample outputs. Full model inference requires:
   - RPLAN dataset download
   - Pretrained model checkpoints
   - Additional dependencies (MATLAB for Graph2Plan, Graphviz for CE2EPlan)

## Next Steps for Full Integration

### 1. Download RPLAN Dataset
```bash
# Request dataset from: http://staff.ustc.edu.cn/~fuxm/projects/DeepLayout/index.html
# Or use the Google Form: https://docs.google.com/forms/d/e/1FAIpQLSfwteilXzURRKDI5QopWCyOGkeb_CFFbRwtQ0SOPhEg0KGSfw/viewform
```

### 2. Download Pretrained Checkpoints
- HouseDiffusion: https://drive.google.com/file/d/16zKmtxwY5lF6JE-CJGkRf3-OFoD1TrdR/view
- CE2EPlan: Already included in repository
- Graph2Plan: Available in releases

### 3. Fine-Tune for Vastu Compliance
Collect 100-200 Vastu-compliant floorplan examples and fine-tune the models.

### 4. Implement Post-Processing
Add Vastu-based corrections to generated floor plans:
- Swap kitchen to southeast
- Move master bedroom to southwest
- Relocate bathrooms to west/northwest

## Troubleshooting

### Flask Service Not Starting
```bash
# Check if port 5000 is available
netstat -ano | findstr :5000

# Install missing dependencies
pip install flask flask-cors
```

### Backend Can't Connect to Flask
- Ensure Flask service is running on port 5000
- Check `PYTHON_SERVICE_ENABLED=true` in `.env`
- Check `PYTHON_MODEL_SERVICE_URL=http://localhost:5000` in `.env`

### Frontend Can't Connect to Backend
- Ensure backend is running on port 5004
- Check proxy settings in `frontend/package.json`

## Support

For issues or questions:
1. Check the testing framework: `models/testing_framework.py`
2. Review detailed test results: `models/DETAILED_TEST_RESULTS.md`
3. See model comparison: `models/COMPARISON_RESULTS.md`