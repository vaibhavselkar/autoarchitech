# AutoArchitect - AI House Plan Generator

AutoArchitect is a full-stack web application that automatically generates architectural floor plans based on user constraints such as plot size, facing direction, parking, number of rooms, and floors.

## Features

### 🏗️ **Core Functionality**
- **Constraint-based Layout Generation**: Automatically generates floor plans from user requirements
- **Multiple Layout Variations**: Generates 5-10 different design options
- **Room Placement Logic**: Smart room positioning based on architectural principles
- **Professional Standards**: Follows minimum room size and clearance requirements

### 📐 **Room Types Supported**
- Living Rooms, Bedrooms (including Master), Guest Rooms
- Kitchens, Dining Areas, Bathrooms
- Studies, Balconies, Terraces
- Parking spaces with customizable configurations

### 🎨 **Design Features**
- **Wall Generation**: Automatic structural wall placement
- **Door & Window Placement**: Logical positioning based on room adjacency
- **Staircase Planning**: Optimal staircase placement and design
- **Dimension Labels**: Professional dimension annotations
- **Setback Calculations**: Automatic setback application based on plot boundaries

### 📤 **Export Formats**
- **SVG**: Web-compatible vector graphics
- **PDF**: Print-ready documents
- **DXF**: AutoCAD compatible files
- **JSON**: Data interchange format
- **3D Models**: OBJ format for visualization

### 🎮 **User Interface**
- **Interactive Canvas**: Drag-and-drop floor plan editing
- **Real-time Preview**: Live updates during editing
- **Plan Management**: Save, load, and organize multiple designs
- **Responsive Design**: Works on desktop and tablet devices

## Tech Stack

### Frontend
- **React 18** - Modern UI framework
- **Tailwind CSS** - Utility-first CSS framework
- **React Konva** - 2D canvas library for floor plan rendering
- **React Router** - Client-side routing
- **React Hot Toast** - User notifications

### Backend
- **Node.js** - JavaScript runtime
- **Express** - Web application framework
- **MongoDB** - NoSQL database with Mongoose ODM
- **JWT** - Authentication and authorization

### Geometry & Export Engine
- **Custom Layout Generator** - Constraint-based algorithm
- **PDFKit** - PDF generation
- **DXF Writer** - AutoCAD compatible file export
- **HTML2Canvas** - Canvas to image conversion

## Project Structure

```
autoarchitect/
├── backend/                 # Node.js Express server
│   ├── server.js           # Main server file
│   ├── package.json        # Backend dependencies
│   ├── routes/             # API route handlers
│   ├── controllers/        # Business logic
│   ├── models/             # MongoDB schemas
│   ├── services/           # Core services
│   │   ├── layoutGenerator.js  # Floor plan generation
│   │   └── exporter.js        # Export functionality
│   └── middleware/         # Authentication middleware
├── frontend/               # React application
│   ├── src/
│   │   ├── App.js          # Main app component
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API service layer
│   │   ├── contexts/       # React context providers
│   │   └── canvas/         # Canvas rendering components
│   └── package.json        # Frontend dependencies
└── shared/                 # Shared utilities and schemas
    └── plan-schema.js      # Floor plan data structure
```

## Installation

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or cloud instance)

### Backend Setup
```bash
cd autoarchitect/backend
npm install
cp .env.example .env  # Create environment file
# Edit .env with your MongoDB connection string and JWT secret
npm start
```

### Frontend Setup
```bash
cd autoarchitect/frontend
npm install
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile

### Plans
- `POST /api/plans/generate` - Generate floor plans
- `GET /api/plans` - Get user's plans
- `GET /api/plans/:id` - Get specific plan
- `PUT /api/plans/:id` - Update plan
- `DELETE /api/plans/:id` - Delete plan
- `GET /api/plans/:id/export/:format` - Export plan

### Plots
- `POST /api/plans/plots` - Save plot
- `GET /api/plans/plots` - Get user's plots

## Usage

1. **Register/Login**: Create an account or sign in
2. **Input Plot Details**: Enter plot dimensions, facing direction, and setbacks
3. **Specify Requirements**: Define room types, quantities, and preferences
4. **Generate Plans**: System creates multiple layout variations
5. **Review & Edit**: View, edit, and customize generated plans
6. **Export**: Download plans in various professional formats

## Development

### Backend Development
The backend uses a modular architecture with separate concerns:
- **Routes**: Handle HTTP requests and responses
- **Controllers**: Implement business logic
- **Services**: Core algorithms and external integrations
- **Models**: Data structure definitions

### Frontend Development
The frontend follows React best practices:
- **Components**: Reusable UI elements
- **Context**: Global state management
- **Services**: API communication layer
- **Pages**: Route-based page components

### Layout Generation Algorithm

The layout generator follows these steps:

1. **Parse Constraints**: Extract plot and requirement data
2. **Calculate Buildable Area**: Apply setbacks to determine usable space
3. **Room Placement**: Position rooms based on adjacency rules
4. **Wall Generation**: Create structural walls around rooms
5. **Feature Placement**: Add doors, windows, and staircase
6. **Dimension Generation**: Add measurement labels
7. **Validation**: Ensure all constraints are met

## Future Enhancements

- **Vastu Compliance**: Traditional architectural guidelines
- **Cost Estimation**: Material and construction cost calculations
- **Sunlight Simulation**: Natural light analysis
- **3D Walkthrough**: Interactive 3D visualization
- **Structural Analysis**: Load-bearing wall calculations
- **Building Permit Drawings**: Regulatory compliance documents

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Join our Discord community
- Email us at support@autoarchitect.com

---

**AutoArchitect** - Making architectural design accessible to everyone.

