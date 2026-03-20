import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const AuthPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, loginWithGoogle } = useAuth();
  const [isLogin, setIsLogin] = useState(location.state?.isLogin !== false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    if (isLogin) {
      const ok = await login(formData.email, formData.password);
      if (ok) navigate('/home');
    } else {
      if (formData.password !== formData.confirmPassword) {
        toast.error('Passwords do not match');
        setLoading(false);
        return;
      }
      const ok = await register(formData.name, formData.email, formData.password);
      if (ok) navigate('/home');
    }
    setLoading(false);
  };

  const googleEnabled = Boolean(process.env.REACT_APP_GOOGLE_CLIENT_ID);

  const handleGoogleSuccess = async (credentialResponse) => {
    const ok = await loginWithGoogle(credentialResponse.credential);
    if (ok) navigate('/home');
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const inputCls = 'w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm transition-colors';

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-violet-700/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-indigo-700/15 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <button onClick={() => navigate('/')} className="inline-flex items-center gap-2 mb-6 hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">A</div>
            <span className="text-white font-bold text-xl">AutoArchitect</span>
          </button>
          <h1 className="text-2xl font-bold text-white">
            {isLogin ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {isLogin ? 'Sign in to continue designing' : 'Start generating AI floor plans'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl shadow-black/40">

          {/* Google sign-in */}
          {googleEnabled && (
            <>
              <div className="flex justify-center mb-6">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => toast.error('Google sign-in failed')}
                  theme="filled_black"
                  shape="rectangular"
                  size="large"
                  text={isLogin ? 'signin_with' : 'signup_with'}
                  width="340"
                />
              </div>

              {/* Divider */}
              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-700" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-slate-900 px-3 text-slate-500 text-xs">or continue with email</span>
                </div>
              </div>
            </>
          )}

          {/* Email form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">Full Name</label>
                <input name="name" type="text" required={!isLogin} placeholder="John Doe"
                  value={formData.name} onChange={handleChange} className={inputCls} />
              </div>
            )}

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Email</label>
              <input name="email" type="email" required placeholder="you@example.com"
                value={formData.email} onChange={handleChange} className={inputCls} />
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Password</label>
              <input name="password" type="password" required placeholder="••••••••"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                value={formData.password} onChange={handleChange} className={inputCls} />
            </div>

            {!isLogin && (
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">Confirm Password</label>
                <input name="confirmPassword" type="password" required placeholder="••••••••"
                  autoComplete="new-password"
                  value={formData.confirmPassword} onChange={handleChange} className={inputCls} />
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 mt-2">
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />{isLogin ? 'Signing in…' : 'Creating account…'}</>
                : isLogin ? 'Sign In' : 'Create Account'
              }
            </button>
          </form>

          {/* Toggle */}
          <p className="text-center text-slate-500 text-sm mt-6">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setIsLogin(l => !l); setFormData({ name: '', email: '', password: '', confirmPassword: '' }); }}
              className="text-violet-400 hover:text-violet-300 font-medium transition-colors"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>

        {/* Back to landing */}
        <p className="text-center mt-4">
          <button onClick={() => navigate('/')} className="text-slate-600 hover:text-slate-400 text-sm transition-colors">
            ← Back to home
          </button>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
