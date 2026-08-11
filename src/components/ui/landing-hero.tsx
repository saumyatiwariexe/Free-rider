'use client';
import React, { useEffect, useRef } from 'react';
import { ArrowRight, GitBranch, FileText, PenTool, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';



const STATS = [
  { value: '3', label: 'Source Adapters', sub: 'GitHub · Figma · Google Docs' },
  { value: '< 60s', label: 'To Link an Account', sub: 'One-time. No instructions needed.' },
  { value: '< 5s', label: 'Report Generation', sub: 'For any hackathon-sized team' },
  { value: '0', label: 'Self-Reports Required', sub: 'Zero ongoing input, ever.' },
];

export default function LandingHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Subtle particle animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const setSize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    setSize();
    window.addEventListener('resize', setSize);

    const particles: { x: number; y: number; r: number; dx: number; dy: number; o: number }[] = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3,
      dx: (Math.random() - 0.5) * 0.3,
      dy: (Math.random() - 0.5) * 0.3,
      o: Math.random() * 0.4 + 0.05,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${p.o})`;
        ctx.fill();
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
      }
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', setSize);
    };
  }, []);

  return (
    <section className="relative w-full overflow-hidden bg-black text-white">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        .hero-font { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        .anim-1 { animation: fadeUp 0.8s ease both; }
        .anim-2 { animation: fadeUp 0.8s 0.1s ease both; }
        .anim-3 { animation: fadeUp 0.8s 0.2s ease both; }
        .anim-4 { animation: fadeUp 0.8s 0.35s ease both; }
        .anim-5 { animation: fadeUp 0.8s 0.5s ease both; }
        .anim-6 { animation: fadeIn 1s 0.6s ease both; }
        .gradient-text {
          background: linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.4) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .glow-dot { box-shadow: 0 0 6px 2px rgba(74,222,128,0.6); }
        .source-pill {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 12px; border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.6);
          transition: all 0.2s;
        }
        .source-pill:hover { background: rgba(255,255,255,0.08); color: #fff; }
      `}} />

      {/* Background canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none opacity-60" />

      {/* Radial glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.06),transparent_70%)]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[300px] bg-[radial-gradient(ellipse_at_bottom,rgba(100,100,255,0.04),transparent_70%)]" />
      </div>

      {/* Content */}
      <div className="hero-font relative z-10 max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 pt-20 pb-24 lg:pt-28 lg:pb-32">



        {/* Headline */}
        <h1 className="anim-2 text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight max-w-4xl">
          Contribution tracking<br />
          <span className="gradient-text">without self-report.</span>
        </h1>

        {/* Sub */}
        <p className="anim-3 mt-6 text-lg sm:text-xl text-white/50 max-w-2xl leading-relaxed font-normal">
          Group work runs on a broken assumption: that everyone will honestly log what they did.
          Free-Rider Tracker reads what actually happened — from the tools your team already uses.
        </p>

        {/* Source pills */}
        <div className="anim-4 flex flex-wrap items-center gap-2 mt-8">
          <span className="source-pill">
            <GitBranch size={13} />
            GitHub Commits
          </span>
          <span className="source-pill">
            <PenTool size={13} />
            Figma Edits
          </span>
          <span className="source-pill">
            <FileText size={13} />
            Google Docs Revisions
          </span>
          <span className="text-xs text-white/25 ml-1">— all in one objective report.</span>
        </div>

        {/* CTAs */}
        <div className="anim-5 mt-10 flex flex-col sm:flex-row gap-4">
          <Link
            href="/sign-up"
            id="hero-get-started"
            className="inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold text-black bg-white hover:bg-white/90 transition-all active:scale-95"
          >
            Get started free
            <ArrowRight size={15} />
          </Link>
          <Link
            href="/sign-in"
            id="hero-sign-in"
            className="inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-medium text-white/70 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-all"
          >
            Sign in
          </Link>
        </div>

        {/* Trust line */}
        <p className="anim-5 mt-5 text-xs text-white/25 flex items-center gap-1.5">
          <CheckCircle2 size={11} className="text-green-400/70" />
          Read-only OAuth scopes only · No manual logging · One-time account link
        </p>

        {/* Stats row */}
        <div className="anim-6 mt-20 pt-8 border-t border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-8">
          {STATS.map((s) => (
            <div key={s.label} className="flex flex-col gap-1">
              <span className="text-3xl sm:text-4xl font-bold text-white tracking-tight">{s.value}</span>
              <span className="text-sm font-semibold text-white/70">{s.label}</span>
              <span className="text-xs text-white/30">{s.sub}</span>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
