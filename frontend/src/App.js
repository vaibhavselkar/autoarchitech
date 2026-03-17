import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Home from './pages/Home';
import PlanResults from './pages/PlanResults';
import PlanEditor from './pages/PlanEditor';
import ExportPage from './pages/ExportPage';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Protected route component
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  return user ? children : <Navigate to="/auth" />;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="App">
          <Routes>
            {/* Public routes */}
            <Route path="/auth" element={<AuthPage />} />
            
            {/* Protected routes */}
            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route index element={<Home />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="results" element={<PlanResults />} />
              <Route path="editor/:planId" element={<PlanEditor />} />
              <Route path="export/:planId" element={<ExportPage />} />
            </Route>
            
            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
          
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
            }}
          />
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;