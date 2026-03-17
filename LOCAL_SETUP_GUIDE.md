# AutoArchitect Local Setup Guide

This guide will help you set up and run AutoArchitect locally on your machine.

## Prerequisites

Before you begin, make sure you have the following installed:

- **Node.js** (version 16 or higher)
- **npm** (version 8 or higher) or **pnpm** (recommended)
- **Git** (for cloning the repository)

## Step 1: Clone the Repository

```bash
git clone <repository-url>
cd autoarchitect
```

## Step 2: Install Dependencies

### Backend Dependencies
```bash
cd backend
npm install
# or if using pnpm:
# pnpm install
```

### Frontend Dependencies
```bash
cd frontend
npm install
# or if using pnpm:
# pnpm install
```

## Step 3: Environment Configuration

### Backend Configuration

1. Copy the environment example file:
```bash
cd backend
cp .env.example .env
```

2. Edit the `.env` file with your configuration:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/autoarchitect
# Or use MongoDB Atlas: mongodb+srv://<username>:<password>@cluster.mongodb.net/autoarchitect

# JWT Secret (Generate a strong secret)
JWT_SECRET=your-super-secret-jwt-key-here

# Google OAuth (Optional - for Google Sign-In)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Gemini AI (Optional - for AI enhancements)
GEMINI_API_KEY=your-gemini-api-key

# Frontend URL
FRONTEND_URL=http://localhost:3000

# File Upload Configuration
MAX_FILE_SIZE=5242880  # 5MB
UPLOAD_PATH=./uploads
```

### Frontend Configuration

The frontend uses environment variables from a `.env` file in the `frontend` directory:

```bash
cd frontend
echo "REACT_APP_API_URL=http://localhost:5000" > .env
```

## Step 4: Database Setup

### Option A: Local MongoDB
1. Install MongoDB locally or use Docker:
```bash
# Using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

2. Update your `.env` file:
```env
MONGODB_URI=mongodb://localhost:27017/autoarchitect
```

### Option B: MongoDB Atlas (Cloud)
1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a new cluster
3. Get your connection string and update `.env`:
```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/autoarchitect
```

## Step 5: Run the Application

### Start the Backend Server
```bash
cd backend
npm start
# or for development with auto-restart:
# npm run dev
```

The backend server will start on `http://localhost:5000`

### Start the Frontend Development Server
```bash
cd frontend
npm start
```

The frontend will start on `http://localhost:3000`

## Step 6: Access the Application

Open your browser and navigate to:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000

## Optional: Google OAuth Setup

To enable Google Sign-In:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth credentials (Web application)
5. Set authorized redirect URI: `http://localhost:5000/api/auth/google/callback`
6. Add your credentials to the `.env` file

## Optional: Gemini AI Setup

To enable AI enhancements:

1. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/)
2. Add it to your `.env` file:
```env
GEMINI_API_KEY=your-gemini-api-key
```

## Troubleshooting

### Common Issues

1. **Port already in use**:
   - Change the PORT in `.env` file
   - Or kill the process using the port

2. **MongoDB connection issues**:
   - Check if MongoDB is running
   - Verify connection string in `.env`
   - Check firewall settings

3. **CORS errors**:
   - Ensure FRONTEND_URL is correctly set in `.env`
   - Check CORS configuration in backend

4. **Missing dependencies**:
   - Run `npm install` again
   - Clear npm cache: `npm cache clean --force`

### Useful Commands

```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# Check if MongoDB is running
mongo --version

# View running processes on port 5000
lsof -i :5000  # macOS/Linux
netstat -ano | findstr :5000  # Windows

# Kill process on port 5000
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows
```

## Development Workflow

1. **Backend Development**:
   - Use `npm run dev` for auto-restart on changes
   - API endpoints available at `http://localhost:5000/api`

2. **Frontend Development**:
   - Use `npm start` for hot reload
   - Changes reflect automatically in browser

3. **Testing**:
   - Backend: `npm test` (if tests are configured)
   - Frontend: `npm test` (React testing)

## Production Deployment

For production deployment:

1. Set `NODE_ENV=production` in `.env`
2. Use a production database (MongoDB Atlas recommended)
3. Configure proper JWT secrets
4. Set up reverse proxy (nginx) if needed
5. Enable HTTPS with SSL certificates

## Support

If you encounter issues:

1. Check the console logs for error messages
2. Verify all environment variables are set
3. Ensure all services are running
4. Check the [GitHub Issues](https://github.com/your-repo/issues) for known problems

## Features Available

Once running, you'll have access to:

- ✅ Google OAuth Authentication
- ✅ Multi-floor building generation
- ✅ Vastu Shastra compliance
- ✅ 3D visualization
- ✅ AutoCAD DXF export
- ✅ AI-powered design suggestions
- ✅ Real-time preview
- ✅ Professional export formats

Happy building! 🏗️