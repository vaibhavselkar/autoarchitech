import { Fragment } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { GoogleOAuthProvider } from '@react-oauth/google';
import Layout from './components/Layout';
import Home from './pages/Home';
import PlanResults from './pages/PlanResults';
import PlanEditor from './pages/PlanEditor';
import ExportPage from './pages/ExportPage';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import LandingPage from './pages/LandingPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Show landing page for guests, redirect logged-in users to app
function PublicRoot() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  return user ? <Navigate to="/home" replace /> : <LandingPage />;
}

// Redirect guests to landing page
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  return user ? children : <Navigate to="/" replace />;
}

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || 'placeholder';

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <Router>
      <AuthProvider>
        <Fragment>
          <Routes>
            {/* Landing page — public */}
            <Route path="/" element={<PublicRoot />} />

            {/* Auth */}
            <Route path="/auth" element={<AuthPage />} />

            {/* Protected app routes */}
            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route path="home" element={<Home />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="results" element={<PlanResults />} />
              <Route path="editor/:planId" element={<PlanEditor />} />
              <Route path="export/:planId" element={<ExportPage />} />
            </Route>

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' },
            }}
          />
        </Fragment>
      </AuthProvider>
    </Router>
    </GoogleOAuthProvider>
  );
}

export default App;
