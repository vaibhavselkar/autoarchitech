import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ── Animated counter ───────────────────────────────────────────────────────
function Counter({ end, suffix = '', duration = 2000 }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const steps = 60;
        const increment = end / steps;
        let current = 0;
        const timer = setInterval(() => {
          current += increment;
          if (current >= end) { setCount(end); clearInterval(timer); }
          else setCount(Math.floor(current));
        }, duration / steps);
      }
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// ── Feature card ───────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc, gradient, delay = 0 }) {
  return (
    <div
      className="group relative rounded-2xl p-px overflow-hidden transition-transform duration-300 hover:-translate-y-1"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${gradient}`} />
      <div className="relative bg-slate-900 rounded-2xl p-6 h-full border border-slate-800 group-hover:border-transparent transition-colors duration-300">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4 ${gradient} bg-opacity-20`}
          style={{ background: 'rgba(99,102,241,0.12)' }}>
          {icon}
        </div>
        <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
        <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

// ── Step ──────────────────────────────────────────────────────────────────
function Step({ num, title, desc, icon }) {
  return (
    <div className="flex gap-5 items-start">
      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-violet-900/40">
        {num}
      </div>
      <div>
        <div className="text-2xl mb-1">{icon}</div>
        <h4 className="text-white font-semibold text-lg">{title}</h4>
        <p className="text-slate-400 text-sm mt-1 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

// ── Floor plan mock SVG ────────────────────────────────────────────────────
function FloorPlanMock() {
  const rooms = [
    { x: 10, y: 10, w: 120, h: 80, label: 'Living Room', color: '#3B82F6' },
    { x: 140, y: 10, w: 80, h: 80, label: 'Kitchen', color: '#10B981' },
    { x: 10, y: 100, w: 80, h: 90, label: 'Master Bed', color: '#8B5CF6' },
    { x: 100, y: 100, w: 60, h: 40, label: 'Bath', color: '#06B6D4' },
    { x: 100, y: 150, w: 60, h: 40, label: 'Bath', color: '#06B6D4' },
    { x: 170, y: 100, w: 50, h: 90, label: 'Bedroom', color: '#EC4899' },
    { x: 10, y: 200, w: 210, h: 30, label: 'Balcony', color: '#14B8A6' },
  ];
  return (
    <svg viewBox="0 0 240 240" className="w-full h-full" style={{ filter: 'drop-shadow(0 0 30px rgba(99,102,241,0.3))' }}>
      {/* Background */}
      <rect x="0" y="0" width="240" height="240" rx="8" fill="#0f172a" />
      {/* Outer wall */}
      <rect x="6" y="6" width="228" height="228" rx="4" fill="none" stroke="#334155" strokeWidth="2.5" />
      {/* Rooms */}
      {rooms.map((r, i) => (
        <g key={i}>
          <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={r.color} fillOpacity="0.12" stroke={r.color} strokeWidth="1.2" rx="2" />
          <text x={r.x + r.w / 2} y={r.y + r.h / 2} textAnchor="middle" dominantBaseline="middle"
            fill={r.color} fontSize="7" fontWeight="600" fontFamily="system-ui">
            {r.label}
          </text>
        </g>
      ))}
      {/* Dimension lines */}
      <line x1="10" y1="235" x2="220" y2="235" stroke="#475569" strokeWidth="0.7" />
      <text x="115" y="239" textAnchor="middle" fill="#64748b" fontSize="6" fontFamily="system-ui">30′ — 0″</text>
      {/* North arrow */}
      <g transform="translate(220, 20)">
        <circle cx="0" cy="0" r="8" fill="#1e293b" stroke="#334155" strokeWidth="1" />
        <text x="0" y="1" textAnchor="middle" dominantBaseline="middle" fill="#94a3b8" fontSize="7" fontWeight="bold" fontFamily="system-ui">N</text>
      </g>
    </svg>
  );
}

// ── Main landing page ──────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const features = [
    {
      icon: '🤖', gradient: 'bg-gradient-to-br from-violet-600 to-indigo-600',
      title: 'AI-Powered Floor Plans',
      desc: 'Google Gemini AI designs complete room layouts with precise coordinates — not just sizes. Every plan is genuinely unique.',
    },
    {
      icon: '🏠', gradient: 'bg-gradient-to-br from-blue-600 to-cyan-600',
      title: 'Interactive 3D Viewer',
      desc: 'Instantly see your floor plan in 3D with real walls, room colours, doors, swing arcs, and export a PNG in one click.',
    },
    {
      icon: '📐', gradient: 'bg-gradient-to-br from-emerald-600 to-teal-600',
      title: 'Professional Drawings',
      desc: 'AutoCAD-quality SVG output with double-line walls, hatching, door arcs, window markers, dimension chains, and title block.',
    },
    {
      icon: '🔄', gradient: 'bg-gradient-to-br from-orange-600 to-amber-600',
      title: '5 Unique Variations',
      desc: 'Get 5 spatially distinct plans per generation — open-plan, split-zone, L-shape, compact, and more. Pick your favourite.',
    },
    {
      icon: '🚪', gradient: 'bg-gradient-to-br from-pink-600 to-rose-600',
      title: 'Smart Door & Window Placement',
      desc: 'Doors and windows are placed intelligently between adjacent rooms — main entry, balcony sliders, and private passage doors.',
    },
    {
      icon: '📏', gradient: 'bg-gradient-to-br from-purple-600 to-violet-600',
      title: 'Setback & Regulation Aware',
      desc: 'Respects front, back, and side setbacks. Buildable area calculated automatically from your plot dimensions.',
    },
    {
      icon: '🌐', gradient: 'bg-gradient-to-br from-sky-600 to-blue-600',
      title: 'Multi-Floor Support',
      desc: 'Design multi-storey homes with independent floor sheets — each floor gets its own professional layout.',
    },
    {
      icon: '💾', gradient: 'bg-gradient-to-br from-green-600 to-emerald-600',
      title: 'Save, Edit & Export',
      desc: 'All plans saved to your account. Edit room shapes in the Konva editor. Export to PDF, PNG, or SVG anytime.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden">

      {/* ── Animated background blobs ─────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-violet-700/20 blur-3xl animate-pulse" />
        <div className="absolute top-1/3 -right-32 w-80 h-80 rounded-full bg-indigo-700/15 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 rounded-full bg-blue-700/10 blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* ── Navbar ───────────────────────────────────────────────────────── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/60 shadow-xl shadow-black/30' : ''}`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-sm font-bold">A</div>
            <span className="font-bold text-lg tracking-tight">AutoArchitect</span>
          </div>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it Works</a>
            <a href="#showcase" className="hover:text-white transition-colors">Showcase</a>
            <a href="#stats" className="hover:text-white transition-colors">Stats</a>
          </div>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <button onClick={() => navigate('/auth')}
              className="text-sm text-slate-300 hover:text-white transition-colors px-3 py-1.5">
              Sign In
            </button>
            <button onClick={() => navigate('/auth')}
              className="text-sm font-medium bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-4 py-2 rounded-lg transition-all duration-200 shadow-lg shadow-violet-900/40">
              Get Started Free →
            </button>
          </div>

          {/* Mobile menu toggle */}
          <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setMenuOpen(o => !o)}>
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-slate-900 border-t border-slate-800 px-6 py-4 space-y-3 text-sm">
            <a href="#features" className="block text-slate-400 hover:text-white" onClick={() => setMenuOpen(false)}>Features</a>
            <a href="#how-it-works" className="block text-slate-400 hover:text-white" onClick={() => setMenuOpen(false)}>How it Works</a>
            <a href="#showcase" className="block text-slate-400 hover:text-white" onClick={() => setMenuOpen(false)}>Showcase</a>
            <button onClick={() => navigate('/auth')} className="w-full mt-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-2 rounded-lg font-medium">
              Get Started Free
            </button>
          </div>
        )}
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative z-10 min-h-screen flex items-center pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">

          {/* Left — text */}
          <div>
            <div className="inline-flex items-center gap-2 bg-violet-950/60 border border-violet-800/50 rounded-full px-4 py-1.5 text-xs text-violet-300 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              Powered by Google Gemini AI
            </div>

            <h1 className="text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight mb-6">
              Design Your{' '}
              <span className="bg-gradient-to-r from-violet-400 via-indigo-400 to-blue-400 bg-clip-text text-transparent">
                Dream Home
              </span>
              {' '}with AI
            </h1>

            <p className="text-slate-400 text-lg leading-relaxed mb-8 max-w-lg">
              Enter your plot dimensions and requirements. AutoArchitect generates 5 professional floor plan variations in seconds — each with 3D preview, accurate room placement, and architectural-quality drawings.
            </p>

            <div className="flex flex-wrap gap-4 mb-10">
              <button onClick={() => navigate('/auth')}
                className="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-violet-900/40 transition-all duration-200 hover:scale-105">
                Generate Your Plan — Free →
              </button>
              <a href="#showcase"
                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl border border-slate-700 transition-all duration-200">
                See Examples
              </a>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-5 text-sm text-slate-500">
              {['✓ No credit card needed', '✓ 5 plans per generation', '✓ 3D viewer included'].map(t => (
                <span key={t} className="text-slate-400">{t}</span>
              ))}
            </div>
          </div>

          {/* Right — floor plan mockup */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 to-indigo-600/20 rounded-3xl blur-2xl" />
            <div className="relative bg-slate-900 rounded-3xl border border-slate-700/60 p-4 shadow-2xl shadow-black/60">
              {/* Top bar */}
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <div className="w-3 h-3 rounded-full bg-green-500/70" />
                </div>
                <span className="text-slate-500 text-xs ml-2">AI-Enhanced Plan 1 — Traditional Layout</span>
              </div>
              {/* Floor plan SVG */}
              <div className="rounded-xl overflow-hidden aspect-square max-w-sm mx-auto">
                <FloorPlanMock />
              </div>
              {/* Bottom stats row */}
              <div className="flex justify-around mt-3 pt-3 border-t border-slate-800 text-center">
                {[['3 BHK', 'Type'], ['1,450', 'sq ft'], ['7 Rooms', 'Layout']].map(([val, lbl]) => (
                  <div key={lbl}>
                    <p className="text-white font-semibold text-sm">{val}</p>
                    <p className="text-slate-500 text-xs">{lbl}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Floating badges */}
            <div className="absolute -top-4 -right-4 bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg animate-bounce">
              ✓ AI Generated
            </div>
            <div className="absolute -bottom-4 -left-4 bg-slate-800 border border-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-full shadow-lg">
              🏠 5 variations ready
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <section id="stats" className="relative z-10 py-16 border-y border-slate-800">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { end: 5, suffix: '', label: 'Plans per generation', icon: '📋' },
            { end: 12, suffix: '+', label: 'Room types supported', icon: '🏠' },
            { end: 100, suffix: '%', label: 'AI-first placement', icon: '🤖' },
            { end: 3, suffix: 'D', label: 'Viewer + export', icon: '🔮' },
          ].map(({ end, suffix, label, icon }) => (
            <div key={label} className="group">
              <div className="text-3xl mb-2">{icon}</div>
              <div className="text-4xl font-extrabold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                <Counter end={end} suffix={suffix} />
              </div>
              <p className="text-slate-400 text-sm mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section id="features" className="relative z-10 py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-violet-400 text-sm font-semibold uppercase tracking-widest">Features</span>
            <h2 className="text-4xl font-extrabold mt-2 mb-4">Everything an Architect Needs</h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              From AI-generated floor plans to professional-grade drawings and immersive 3D views — AutoArchitect covers the complete design workflow.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f, i) => (
              <FeatureCard key={f.title} {...f} delay={i * 60} />
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="relative z-10 py-24 bg-slate-900/50">
        <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-20 items-center">
          <div>
            <span className="text-violet-400 text-sm font-semibold uppercase tracking-widest">How it Works</span>
            <h2 className="text-4xl font-extrabold mt-2 mb-12">From Plot to Plan in 3 Steps</h2>
            <div className="space-y-10">
              <Step num="1" icon="📝" title="Enter Your Requirements"
                desc="Input your plot dimensions, number of bedrooms, parking, vastu preferences, and design style. Takes under 2 minutes." />
              <Step num="2" icon="🤖" title="AI Designs Your Plans"
                desc="Gemini AI generates 5 complete, spatially unique floor plans — each room placed with precise X, Y coordinates and realistic dimensions." />
              <Step num="3" icon="🚀" title="View, Edit & Export"
                desc="Compare plans side by side, fly through your home in the 3D viewer, edit room shapes, and export professional PDFs." />
            </div>
          </div>

          {/* Decorative card stack */}
          <div className="relative h-80 lg:h-auto">
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Card 3 (back) */}
              <div className="absolute w-64 h-72 bg-slate-800 rounded-2xl border border-slate-700 shadow-xl"
                style={{ transform: 'rotate(6deg) translateY(12px)', zIndex: 1 }} />
              {/* Card 2 (mid) */}
              <div className="absolute w-64 h-72 bg-slate-800 rounded-2xl border border-slate-700 shadow-xl"
                style={{ transform: 'rotate(2deg) translateY(6px)', zIndex: 2 }} />
              {/* Card 1 (front) */}
              <div className="relative w-64 h-72 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-violet-700/50 shadow-2xl p-4" style={{ zIndex: 3 }}>
                <div className="text-xs text-slate-500 mb-3 font-medium">PLAN 1 — AI ENHANCED</div>
                <div className="w-full h-48 rounded-xl overflow-hidden">
                  <FloorPlanMock />
                </div>
                <div className="mt-3 flex justify-between text-xs text-slate-400">
                  <span>Open-plan layout</span>
                  <span className="text-violet-400 font-semibold">Best match ★</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3D Showcase ──────────────────────────────────────────────────── */}
      <section id="showcase" className="relative z-10 py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-violet-400 text-sm font-semibold uppercase tracking-widest">3D Visualisation</span>
            <h2 className="text-4xl font-extrabold mt-2 mb-4">Walk Through Your Home Before Building</h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Every floor plan instantly renders in 3D with coloured rooms, walls, doors with swing arcs, and ground setbacks. Rotate, pan, and zoom freely.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: '🔄', title: 'Orbit Controls', desc: 'Drag to rotate, right-drag to pan, scroll to zoom. Full 3D navigation.' },
              { icon: '🚪', title: 'Doors & Arcs', desc: 'Main entry (red), room doors (wood), sliding/balcony (blue) — all with swing arcs.' },
              { icon: '📸', title: 'PNG Export', desc: 'Capture your 3D view as a high-res PNG image with one click.' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center hover:border-slate-600 transition-colors">
                <div className="text-4xl mb-4">{icon}</div>
                <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
                <p className="text-slate-400 text-sm">{desc}</p>
              </div>
            ))}
          </div>

          {/* 3D viewer mock screenshot */}
          <div className="mt-10 relative rounded-3xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl shadow-black/60">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-950">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
              </div>
              <span className="text-slate-500 text-xs ml-2">AI-Enhanced Plan 3 — 3D View · Traditional Elegance · split zone layout</span>
            </div>
            <div className="relative h-64 md:h-96 flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
              {/* Fake 3D floor grid */}
              <svg viewBox="0 0 600 300" className="w-full h-full opacity-80">
                <defs>
                  <linearGradient id="roomGrad1" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.1" />
                  </linearGradient>
                  <linearGradient id="roomGrad2" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.1" />
                  </linearGradient>
                  <linearGradient id="roomGrad3" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0.1" />
                  </linearGradient>
                </defs>
                {/* Simulated 3D perspective floor plan */}
                <g transform="translate(300,150) rotate(-20) skewX(-15) scale(0.8)">
                  <rect x="-200" y="-100" width="150" height="100" fill="url(#roomGrad1)" stroke="#3B82F6" strokeWidth="1.5" />
                  <text x="-125" y="-45" textAnchor="middle" fill="#60A5FA" fontSize="11" fontFamily="system-ui" fontWeight="600">Living Room</text>
                  <rect x="-50" y="-100" width="100" height="100" fill="url(#roomGrad2)" stroke="#8B5CF6" strokeWidth="1.5" />
                  <text x="0" y="-45" textAnchor="middle" fill="#A78BFA" fontSize="11" fontFamily="system-ui" fontWeight="600">Master Bed</text>
                  <rect x="50" y="-100" width="80" height="50" fill="url(#roomGrad3)" stroke="#10B981" strokeWidth="1.5" />
                  <text x="90" y="-72" textAnchor="middle" fill="#34D399" fontSize="10" fontFamily="system-ui" fontWeight="600">Kitchen</text>
                  <rect x="-200" y="0" width="150" height="80" fill="url(#roomGrad3)" stroke="#10B981" strokeWidth="1.5" />
                  <text x="-125" y="42" textAnchor="middle" fill="#34D399" fontSize="11" fontFamily="system-ui" fontWeight="600">Dining</text>
                  <rect x="-50" y="0" width="180" height="80" fill="url(#roomGrad2)" stroke="#8B5CF6" strokeWidth="1.5" />
                  <text x="40" y="42" textAnchor="middle" fill="#A78BFA" fontSize="11" fontFamily="system-ui" fontWeight="600">Bedroom</text>
                </g>
              </svg>
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent pointer-events-none" />
              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm rounded-xl px-4 py-2 text-xs text-slate-300 space-y-0.5">
                <p>◉ Left drag — Rotate</p>
                <p>◎ Right drag — Pan</p>
                <p>↕ Scroll — Zoom</p>
              </div>
              <div className="absolute top-4 right-4 bg-violet-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
                🏠 View in 3D
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Capabilities grid ─────────────────────────────────────────────── */}
      <section className="relative z-10 py-20 bg-slate-900/40">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold mb-3">What You Can Design</h2>
            <p className="text-slate-400">AutoArchitect handles residential projects of all scales</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: '🏡', title: '1–5 BHK Homes', desc: 'Any bedroom configuration' },
              { icon: '🏢', title: 'Multi-storey', desc: 'Up to 4+ floors' },
              { icon: '🚗', title: 'Parking', desc: 'Car + bike setbacks' },
              { icon: '🌿', title: 'Setback Zones', desc: 'Front, back, sides' },
              { icon: '🛁', title: 'Attached Baths', desc: 'Per bedroom' },
              { icon: '🍳', title: 'Open Kitchen', desc: 'With dining zones' },
              { icon: '📚', title: 'Study / Office', desc: 'Work-from-home rooms' },
              { icon: '🌅', title: 'Balcony & Terrace', desc: 'Full-width or partial' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-violet-800/50 transition-colors group">
                <span className="text-2xl">{icon}</span>
                <p className="text-white font-medium text-sm mt-2 group-hover:text-violet-300 transition-colors">{title}</p>
                <p className="text-slate-500 text-xs mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="relative z-10 py-32">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-violet-700/15 blur-3xl" />
          </div>
          <h2 className="text-5xl font-extrabold mb-6 leading-tight">
            Start Designing{' '}
            <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">Today</span>
          </h2>
          <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto">
            Join homeowners, architects, and builders who use AutoArchitect to visualise spaces before breaking ground.
          </p>
          <button onClick={() => navigate('/auth')}
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-lg rounded-2xl shadow-2xl shadow-violet-900/50 transition-all duration-200 hover:scale-105 hover:shadow-violet-700/40">
            Generate My Floor Plan
            <span className="text-xl">→</span>
          </button>
          <p className="text-slate-600 text-sm mt-4">Free to use · No credit card · Instant results</p>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-slate-800 py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white">A</div>
            <span className="font-semibold text-slate-400">AutoArchitect</span>
            <span className="ml-2">© 2026</span>
          </div>
          <div className="flex gap-6">
            <span>AI-Powered Floor Plan Generator</span>
            <span>·</span>
            <span>Built with Google Gemini</span>
          </div>
          <button onClick={() => navigate('/auth')} className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
            Get Started →
          </button>
        </div>
      </footer>
    </div>
  );
}
