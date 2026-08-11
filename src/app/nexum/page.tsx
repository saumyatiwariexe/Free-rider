'use client';
import React, { useState, useEffect } from 'react';
import { ChevronDown, Menu, X } from 'lucide-react';

export default function NexumHero() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const links = ['Modules', 'Clientele', 'Solutions', 'Billing'];

  return (
    <>
      <section className="font-geist h-screen w-full overflow-hidden relative antialiased text-[#010101] lg:text-white">
        <title>Nexum Hero</title>
        <style dangerouslySetInnerHTML={{__html: `
          @import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Silkscreen:wght@400;700&display=swap');
          .font-geist { font-family: 'Geist', -apple-system, BlinkMacSystemFont, sans-serif; }
          .font-silkscreen { font-family: 'Silkscreen', cursive; }
          .bg-gradient-cta { background: linear-gradient(to bottom, #2B2B2B, #101010); }
        `}} />

        {/* Video Background */}
        <video 
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay 
          loop 
          muted 
          playsInline
        >
          <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260803_192301_9231ed6b-c55c-4a48-909c-4ebe11cf2e11.mp4" type="video/mp4" />
        </video>

        {/* Content Overlay */}
        <div className="relative z-10 flex flex-col h-full w-full selection:bg-white/20 selection:text-white">
          
          {/* Navigation */}
          <nav className="flex items-center justify-between px-5 py-5 sm:px-8 sm:py-6 lg:px-12">
            
            {/* Logo */}
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 256 256" className="w-6 h-6 fill-[#010101] lg:fill-white">
                <path d="M 128 128 C 128 198.692 70.692 256 0 256 C 0 185.308 57.308 128 128 128 Z M 128 128 C 198.692 128 256 185.308 256 256 C 185.308 256 128 198.692 128 128 Z M 0 0 C 70.692 0 128 57.308 128 128 C 57.308 128 0 70.692 0 0 Z M 256 0 C 256 70.692 198.692 128 128 128 C 128 57.308 185.308 0 256 0 Z" />
              </svg>
              <span className="text-lg font-semibold lowercase text-[#010101] lg:text-white">nexum</span>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-3">
              <div className="flex items-center gap-1 rounded-full bg-white/10 px-1.5 py-1.5 backdrop-blur-lg">
                {links.map((link) => (
                  <a key={link} href="#" className="flex items-center rounded-full px-4 py-1.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors cursor-pointer">
                    {link}
                    {link === 'Solutions' && <ChevronDown className="ml-1 w-3.5 h-3.5" />}
                  </a>
                ))}
              </div>
              <button className="self-stretch rounded-full px-5 text-sm font-medium text-white bg-gradient-cta hover:opacity-90 transition-opacity">
                Get started
              </button>
            </div>

            {/* Mobile Hamburger Button */}
            <button 
              className="md:hidden relative z-50 flex items-center justify-center h-10 w-10 border-0 rounded-full bg-white/10 backdrop-blur-lg text-[#010101] lg:text-white cursor-pointer"
              onClick={() => setIsOpen(!isOpen)}
            >
              <Menu className={"absolute w-5 h-5 transition-all duration-300 " + (isOpen ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100")} />
              <X className={"absolute w-5 h-5 transition-all duration-300 " + (isOpen ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0")} />
            </button>
          </nav>

          {/* Mobile Menu Backdrop */}
          <div 
            className={"md:hidden fixed inset-0 z-40 bg-black/80 backdrop-blur-md transition-opacity duration-300 " + (isOpen ? "opacity-100" : "opacity-0 pointer-events-none")}
            onClick={() => setIsOpen(false)}
          />

          {/* Mobile Menu Panel */}
          <div 
            className={"md:hidden fixed right-0 top-0 z-40 h-full w-72 bg-black/90 backdrop-blur-xl flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] " + (isOpen ? "translate-x-0" : "translate-x-full")}
          >
            <div className="flex flex-col gap-2 px-6 pt-24">
              {links.map((link, index) => (
                <a 
                  key={link} 
                  href="#" 
                  className={"flex items-center rounded-xl px-4 py-3.5 text-base font-medium text-white/80 hover:bg-white/10 hover:text-white transition-all duration-500 " + (isOpen ? "opacity-100 translate-x-0" : "opacity-0 translate-x-6")}
                  style={{ transitionDelay: isOpen ? `${(index + 1) * 60}ms` : '0ms' }}
                >
                  {link}
                  {link === 'Solutions' && <ChevronDown className="ml-auto w-4 h-4" />}
                </a>
              ))}
            </div>
            
            <div 
              className={"mt-auto px-6 pb-10 transition-all duration-400 " + (isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4")}
              style={{ transitionDelay: isOpen ? '300ms' : '0ms' }}
            >
              <button className="w-full rounded-full py-3.5 text-base font-medium text-white bg-gradient-cta hover:opacity-90 transition-opacity">
                Get started
              </button>
            </div>
          </div>

          {/* Main Content (mt-auto pins to bottom) */}
          <main className="mt-auto flex flex-col lg:flex-row lg:items-end lg:justify-between px-5 pb-8 sm:px-8 sm:pb-12 lg:px-12 lg:pb-16 gap-6 sm:gap-8">
            
            {/* Left Block: Headline & CTA */}
            <div className="flex flex-col">
              <h1 className="text-3xl sm:text-4xl lg:text-[3.5rem] font-semibold leading-[1.1] tracking-tight max-w-xl text-[#010101] lg:text-white">
                Ship AI workers that grind while you rest
              </h1>
              
              <div className="mt-6 sm:mt-8 flex flex-col gap-3 sm:gap-0 sm:inline-flex sm:flex-row sm:items-center sm:rounded-full sm:bg-white sm:p-1.5 sm:w-fit">
                <input 
                  type="email" 
                  placeholder="Type your email" 
                  className="rounded-full bg-white px-5 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none sm:w-64 sm:rounded-none sm:bg-transparent sm:px-4 sm:py-2"
                />
                <button className="rounded-full px-6 py-3 sm:py-2.5 text-sm font-medium text-white bg-gradient-cta hover:opacity-90 transition-opacity whitespace-nowrap">
                  Get started
                </button>
              </div>
            </div>

            {/* Right Block: Glass Cards */}
            <div className="flex flex-col sm:flex-row gap-4 lg:gap-5 lg:w-auto w-full">
              
              {/* Stats Card */}
              <div className="flex flex-col justify-between rounded-2xl bg-white/10 backdrop-blur-lg p-5 sm:p-6 sm:w-64">
                <div className="font-silkscreen text-3xl sm:text-4xl font-normal tracking-tight text-[#010101] lg:text-white">
                  42,500+
                </div>
                <p className="mt-3 sm:mt-4 text-sm leading-relaxed text-[#010101]/70 lg:text-white/70">
                  Teams run Nexum to handle recurring ops daily.
                </p>
              </div>

              {/* Testimonial Card */}
              <div className="flex flex-col justify-between rounded-2xl bg-white/10 backdrop-blur-lg p-5 sm:p-6 sm:w-64">
                <div>
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <div className="w-6 h-6 rounded flex items-center justify-center bg-black text-white font-bold text-xs select-none">
                      S
                    </div>
                    <span className="text-sm font-semibold text-[#010101] lg:text-white">Stratify</span>
                  </div>
                  <p className="text-sm leading-relaxed text-[#010101]/80 lg:text-white/80">
                    &quot;With Nexum we went from managing tedious operational work to having AI agents that handle everything.&quot;
                  </p>
                </div>
                
                <div className="flex items-center gap-3 mt-4 sm:mt-5">
                  <img 
                    src="https://i.pravatar.cc/72?img=12" 
                    alt="Sara Klein" 
                    className="w-9 h-9 rounded-full object-cover bg-white/20"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-[#010101] lg:text-white">Sara Klein</span>
                    <span className="text-xs text-[#010101]/60 lg:text-white/60">Dir of Operations</span>
                  </div>
                </div>
              </div>

            </div>
          </main>
        </div>
      </section>
    </>
  );
}
