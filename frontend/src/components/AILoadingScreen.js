import { useState, useEffect } from 'react';

const MESSAGES = [
  'Analyzing plot dimensions & setbacks...',
  'AI architecting room arrangements...',
  'Calculating space utilization ratios...',
  'Designing 5 unique layout variations...',
  'Placing doors, windows & openings...',
  'Applying Vastu & architectural principles...',
  'Adding furniture & fixtures...',
  'Finalizing your floor plans...',
];

export default function AILoadingScreen() {
  const [msgIdx, setMsgIdx]     = useState(0);
  const [fade, setFade]         = useState(true);
  const [progress, setProgress] = useState(2);
  const [tick, setTick]         = useState(0);

  useEffect(() => {
    // Cycle status messages with fade
    const msgTimer = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setMsgIdx(i => (i + 1) % MESSAGES.length);
        setFade(true);
      }, 350);
    }, 2800);

    // Progress bar (fills to 93% over ~26s, AI takes ~20-30s)
    const progTimer = setInterval(() => {
      setProgress(p => {
        if (p < 40) return p + 0.55;   // fast start
        if (p < 75) return p + 0.28;   // medium
        return Math.min(p + 0.08, 93); // slow near end
      });
    }, 100);

    // Tick for animated dots
    const tickTimer = setInterval(() => setTick(t => t + 1), 500);

    return () => { clearInterval(msgTimer); clearInterval(progTimer); clearInterval(tickTimer); };
  }, []);

  return (
    <>
      <style>{`
        @keyframes aa-gridpan {
          from { background-position: 0 0; }
          to   { background-position: 40px 40px; }
        }
        @keyframes aa-float {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-10px); }
        }
        @keyframes aa-draw {
          from { stroke-dashoffset: var(--dash); }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes aa-fadein {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes aa-roomfade {
          from { opacity: 0; }
          to   { opacity: 0.14; }
        }
        @keyframes aa-blink {
          0%,100% { opacity: 1;   transform: scale(1); }
          50%      { opacity: 0.3; transform: scale(0.7); }
        }
        @keyframes aa-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes aa-orbit {
          from { transform: rotate(0deg)   translateX(52px) rotate(0deg); }
          to   { transform: rotate(360deg) translateX(52px) rotate(-360deg); }
        }
        @keyframes aa-orbit2 {
          from { transform: rotate(180deg) translateX(38px) rotate(-180deg); }
          to   { transform: rotate(540deg) translateX(38px) rotate(-540deg); }
        }
        .aa-draw-wall  { animation: aa-draw 1.8s ease forwards; stroke-dashoffset: var(--dash,800); }
        .aa-draw-inner { animation: aa-draw 0.9s ease forwards; stroke-dashoffset: var(--dash,200); }
        .aa-draw-door  { animation: aa-draw 0.6s ease forwards; stroke-dashoffset: var(--dash,40); }
        .aa-room       { animation: aa-roomfade 1s ease forwards; opacity: 0; }
        .aa-label      { animation: aa-fadein 0.8s ease forwards; opacity: 0; }
      `}</style>

      {/* Full-screen overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'linear-gradient(135deg, #080E1A 0%, #0D1526 50%, #0A1020 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
        overflow: 'hidden',
      }}>

        {/* Blueprint grid */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage:
            'linear-gradient(rgba(99,102,241,0.18) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(99,102,241,0.18) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          animation: 'aa-gridpan 5s linear infinite',
        }} />

        {/* Radial glow behind card */}
        <div style={{
          position: 'absolute',
          width: 500, height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* ── Orbiting particles ── */}
        <div style={{ position: 'absolute', width: 1, height: 1 }}>
          {[
            { orb: 'aa-orbit',  size: 8,  color: '#6366F1', delay: '0s',    dur: '4s'  },
            { orb: 'aa-orbit2', size: 6,  color: '#8B5CF6', delay: '0s',    dur: '3s'  },
            { orb: 'aa-orbit',  size: 5,  color: '#06B6D4', delay: '1.3s',  dur: '5s'  },
          ].map((p, i) => (
            <div key={i} style={{
              position: 'absolute', top: '50%', left: '50%',
              width: p.size, height: p.size,
              borderRadius: '50%', background: p.color,
              opacity: 0.7,
              transformOrigin: '0 0',
              animation: `${p.orb} ${p.dur} linear ${p.delay} infinite`,
              boxShadow: `0 0 6px ${p.color}`,
            }} />
          ))}
        </div>

        {/* ── Main card ── */}
        <div style={{
          position: 'relative', zIndex: 1,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 28,
          width: '90%', maxWidth: 460,
        }}>

          {/* ── Animated floor plan SVG ── */}
          <div style={{
            background: 'rgba(15,23,42,0.8)',
            border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: 20, padding: '20px 24px',
            animation: 'aa-float 3.5s ease-in-out infinite',
            boxShadow: '0 0 40px rgba(99,102,241,0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}>
            <svg width="260" height="190" viewBox="0 0 260 190">
              {/* Room fills */}
              <rect className="aa-room" x="14" y="14" width="130" height="75" rx="3"
                fill="#6366F1" style={{ animationDelay: '0.3s' }} />
              <rect className="aa-room" x="154" y="14" width="92" height="75" rx="3"
                fill="#8B5CF6" style={{ animationDelay: '0.6s' }} />
              <rect className="aa-room" x="14" y="99" width="90" height="78" rx="3"
                fill="#06B6D4" style={{ animationDelay: '0.9s' }} />
              <rect className="aa-room" x="114" y="99" width="132" height="78" rx="3"
                fill="#10B981" style={{ animationDelay: '1.2s' }} />

              {/* Outer walls */}
              <rect x="14" y="14" width="232" height="163" rx="3" fill="none"
                stroke="#6366F1" strokeWidth="2.5"
                className="aa-draw-wall" style={{ '--dash': 800 }}
              />

              {/* Interior: horizontal divider */}
              <line x1="14" y1="97" x2="246" y2="97" stroke="#818CF8" strokeWidth="1.8"
                className="aa-draw-inner" style={{ '--dash': 240, animationDelay: '1s' }}
              />
              {/* Interior: vertical living/bedroom */}
              <line x1="152" y1="14" x2="152" y2="97" stroke="#818CF8" strokeWidth="1.8"
                className="aa-draw-inner" style={{ '--dash': 85, animationDelay: '1.4s' }}
              />
              {/* Interior: vertical kitchen/master */}
              <line x1="112" y1="97" x2="112" y2="177" stroke="#818CF8" strokeWidth="1.8"
                className="aa-draw-inner" style={{ '--dash': 82, animationDelay: '1.7s' }}
              />

              {/* Main entry door (swing arc) */}
              <line x1="14" y1="30" x2="14" y2="50" stroke="#F59E0B" strokeWidth="2"
                className="aa-draw-door" style={{ '--dash': 22, animationDelay: '2.1s' }}
              />
              <path d="M 14 30 Q 34 30 34 50" fill="none" stroke="#F59E0B" strokeWidth="1.5"
                className="aa-draw-door" style={{ '--dash': 38, animationDelay: '2.3s' }}
              />

              {/* Bedroom door */}
              <line x1="152" y1="70" x2="168" y2="70" stroke="#94A3B8" strokeWidth="1.5"
                className="aa-draw-door" style={{ '--dash': 18, animationDelay: '2.5s' }}
              />
              <path d="M 152 70 Q 152 86 168 86" fill="none" stroke="#94A3B8" strokeWidth="1"
                className="aa-draw-door" style={{ '--dash': 28, animationDelay: '2.7s' }}
              />

              {/* Windows on top wall */}
              {[60, 120, 195].map((wx, i) => (
                <g key={i} className="aa-label" style={{ animationDelay: `${2.8 + i * 0.2}s` }}>
                  <line x1={wx} y1="14" x2={wx + 20} y2="14" stroke="#FFFFFF" strokeWidth="3" />
                  <line x1={wx + 3}  y1="14" x2={wx + 3}  y2="14" stroke="#38BDF8" strokeWidth="1.5" />
                  <line x1={wx + 10} y1="14" x2={wx + 10} y2="14" stroke="#0EA5E9" strokeWidth="1.5" />
                  <line x1={wx + 17} y1="14" x2={wx + 17} y2="14" stroke="#38BDF8" strokeWidth="1.5" />
                </g>
              ))}

              {/* Room labels */}
              <text className="aa-label" x="78"  y="57" textAnchor="middle"
                fill="#A5B4FC" fontSize="9" fontWeight="700" letterSpacing="0.5"
                style={{ animationDelay: '1.5s' }}>LIVING ROOM</text>
              <text className="aa-label" x="199" y="57" textAnchor="middle"
                fill="#C4B5FD" fontSize="9" fontWeight="700"
                style={{ animationDelay: '1.8s' }}>BEDROOM</text>
              <text className="aa-label" x="62"  y="142" textAnchor="middle"
                fill="#67E8F9" fontSize="8.5" fontWeight="700"
                style={{ animationDelay: '2.1s' }}>KITCHEN</text>
              <text className="aa-label" x="178" y="140" textAnchor="middle"
                fill="#6EE7B7" fontSize="8.5" fontWeight="700"
                style={{ animationDelay: '2.4s' }}>MASTER BED</text>

              {/* Dimension marks */}
              <text x="130" y="9" textAnchor="middle" fill="#4B5563" fontSize="7">40 ft</text>
              <text x="251" y="98" fill="#4B5563" fontSize="7">60 ft</text>

              {/* Compass badge */}
              <rect x="230" y="170" width="26" height="14" rx="3" fill="#1E40AF" />
              <text x="243" y="180" textAnchor="middle" fill="#FFFFFF" fontSize="7" fontWeight="bold">N ↑</text>
            </svg>
          </div>

          {/* Title */}
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 22, fontWeight: 700, color: '#F1F5F9',
              letterSpacing: '-0.02em', marginBottom: 6,
              background: 'linear-gradient(90deg, #A5B4FC, #818CF8, #C4B5FD)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              animation: 'aa-shimmer 3s linear infinite',
            }}>
              AI is designing your home
            </div>
            <div style={{ fontSize: 12, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Generating 5 unique floor plan variations
            </div>
          </div>

          {/* Status message */}
          <div style={{
            height: 24, display: 'flex', alignItems: 'center',
            transition: 'opacity 0.35s ease',
            opacity: fade ? 1 : 0,
          }}>
            <span style={{
              fontSize: 13, color: '#818CF8',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{
                display: 'inline-block', width: 6, height: 6,
                borderRadius: '50%', background: '#6366F1',
                boxShadow: '0 0 8px #6366F1',
                animation: 'aa-blink 1s ease-in-out infinite',
              }} />
              {MESSAGES[msgIdx]}
            </span>
          </div>

          {/* Progress bar */}
          <div style={{ width: '100%' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              marginBottom: 8, fontSize: 11,
            }}>
              <span style={{ color: '#475569' }}>Analyzing & generating</span>
              <span style={{ color: '#6366F1', fontWeight: 600 }}>{Math.round(progress)}%</span>
            </div>
            <div style={{
              height: 5, background: 'rgba(99,102,241,0.12)',
              borderRadius: 999, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 999,
                background: 'linear-gradient(90deg, #4F46E5, #7C3AED, #6366F1)',
                backgroundSize: '200% auto',
                width: `${progress}%`,
                transition: 'width 0.12s linear',
                boxShadow: '0 0 10px rgba(99,102,241,0.7)',
                animation: 'aa-shimmer 2s linear infinite',
              }} />
            </div>
          </div>

          {/* Pulsing dots */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{
                width: i === tick % 4 ? 10 : 7,
                height: i === tick % 4 ? 10 : 7,
                borderRadius: '50%',
                background: i === tick % 4 ? '#6366F1' : '#1E293B',
                border: '1.5px solid',
                borderColor: i === tick % 4 ? '#6366F1' : '#334155',
                boxShadow: i === tick % 4 ? '0 0 10px #6366F1' : 'none',
                transition: 'all 0.4s ease',
              }} />
            ))}
          </div>

          {/* Tip */}
          <div style={{
            fontSize: 11, color: '#1E293B',
            background: 'rgba(99,102,241,0.07)',
            border: '1px solid rgba(99,102,241,0.12)',
            borderRadius: 8, padding: '8px 16px',
            textAlign: 'center', color: '#475569',
          }}>
            This usually takes 20–35 seconds. Please don't close this window.
          </div>
        </div>
      </div>
    </>
  );
}
