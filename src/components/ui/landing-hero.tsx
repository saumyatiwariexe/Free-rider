'use client';
import React from 'react';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';

export default function LandingHero() {
  const links = ['Code', 'Design', 'Docs', 'Pricing'];

  return (
    <section className="font-geist min-h-screen w-full relative antialiased text-white flex flex-col selection:bg-white/20 selection:text-white pb-16">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Silkscreen:wght@400;700&display=swap');
        .font-geist { font-family: 'Geist', -apple-system, BlinkMacSystemFont, sans-serif; }
        .font-silkscreen { font-family: 'Silkscreen', cursive; }
        .bg-gradient-cta { background: linear-gradient(to bottom, rgba(255,255,255,0.15), rgba(255,255,255,0.05)); border: 1px solid rgba(255,255,255,0.2); }
      `}} />

      {/* Cinematic Dark Background replacing the video */}
      <div className="absolute inset-0 h-full w-full pointer-events-none -z-10 bg-black">
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08)_0%,transparent_100%)]"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,#000_100%)]"></div>
      </div>

      {/* Content Overlay */}
      <div className="relative z-10 flex flex-col flex-1 w-full max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
        

        <main className="mt-16 sm:mt-24 lg:mt-32 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-12 sm:gap-16">
          
          {/* Left Block: Headline & CTA */}
          <div className="flex flex-col">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/50 mb-6 tracking-widest uppercase w-fit">
              <span>Free-Rider Tracker</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-[4.5rem] font-semibold leading-[1.1] tracking-tighter max-w-2xl text-white">
              Measure Work, <br/><span className="text-white/40">Not Talk.</span>
            </h1>
            
            <p className="mt-8 text-lg text-white/50 max-w-lg font-medium leading-relaxed">
              Passive contribution tracking across code, design, and docs. 
              Zero friction. Zero self-reporting. Objective team insights.
            </p>
            
            <div className="mt-8 sm:mt-12 flex flex-col sm:flex-row gap-4">
              <Link href="/sign-up" className="rounded-full px-8 py-4 sm:py-3.5 text-sm font-medium text-white bg-gradient-cta hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                Get started <ChevronDown className="w-4 h-4 -rotate-90" />
              </Link>
              <Link href="/sign-in" className="rounded-full px-8 py-4 sm:py-3.5 text-sm font-medium text-white/70 bg-white/5 border border-white/5 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-center text-center">
                Sign in
              </Link>
            </div>
          </div>

          {/* Right Block: Glass Cards */}
          <div className="flex flex-col sm:flex-row gap-4 lg:gap-5 w-full lg:w-auto h-full pb-8">
            
            {/* Stats Card */}
            <div className="flex flex-col justify-between rounded-2xl bg-white/5 border border-white/10 backdrop-blur-lg p-6 sm:p-7 sm:w-64">
              <div className="font-silkscreen text-3xl sm:text-4xl font-normal tracking-tight text-white mb-6">
                10,000+
              </div>
              <p className="text-sm leading-relaxed text-white/60 font-medium">
                Hours of passive contributions tracked without manual reporting this month.
              </p>
            </div>

            {/* Testimonial Card */}
            <div className="flex flex-col justify-between rounded-2xl bg-white/5 border border-white/10 backdrop-blur-lg p-6 sm:p-7 sm:w-64">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded bg-indigo-500/20 text-indigo-400 font-bold text-xs flex items-center justify-center border border-indigo-500/30">
                    N
                  </div>
                  <span className="text-sm font-semibold text-white">Nova Team</span>
                </div>
                <p className="text-sm leading-relaxed text-white/70 italic">
                  "Finally, we have an objective source of truth for who is actually pushing the project forward."
                </p>
              </div>
              
              <div className="flex items-center gap-3 mt-6">
                <img 
                  src="https://i.pravatar.cc/72?img=33" 
                  alt="Julian Doe" 
                  className="w-9 h-9 rounded-full object-cover bg-white/10"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-white">Julian Doe</span>
                  <span className="text-xs text-white/50">Tech Lead</span>
                </div>
              </div>
            </div>

          </div>

        </main>
      </div>
    </section>
  );
}
