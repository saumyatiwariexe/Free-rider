'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Activity, Menu, X, LayoutDashboard, Settings, LogIn } from 'lucide-react';
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';

export default function Navbar() {
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

  const closeMenu = () => setIsOpen(false);

  return (
    <>
      <header className="sticky top-0 z-50 w-full glass-panel border-x-0 border-t-0 rounded-none border-b border-white/5 bg-black/60 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto w-full">
          <Link href="/" className="flex items-center gap-3 group" onClick={closeMenu}>
            <div className="p-1.5 bg-white/5 border border-white/10 rounded-md transition-colors group-hover:bg-white/10">
              <Activity size={18} className="text-white/70" />
            </div>
            <span className="font-semibold tracking-wide text-sm text-white">Free-Rider Tracker</span>
          </Link>
          
          {/* Desktop Right Side */}
          <div className="flex items-center gap-4">
            
            <SignedOut>
              <div className="hidden md:flex items-center gap-4">
                <Link href="/sign-in" className="text-sm font-medium text-white/50 hover:text-white transition-colors">
                  Sign in
                </Link>
                <Link href="/sign-up" className="rounded-full px-5 py-1.5 text-sm font-medium text-white/90 bg-white/10 hover:bg-white/20 hover:text-white transition-colors border border-white/10">
                  Get started
                </Link>
              </div>
              
              {/* Mobile Hamburger Button */}
              <button 
                className="md:hidden relative z-50 flex items-center justify-center h-9 w-9 border border-white/10 rounded-full bg-white/5 backdrop-blur-lg text-white"
                onClick={() => setIsOpen(!isOpen)}
              >
                <Menu size={16} className={"absolute transition-all duration-300 " + (isOpen ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100")} />
                <X size={16} className={"absolute transition-all duration-300 " + (isOpen ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0")} />
              </button>
            </SignedOut>

            <SignedIn>
              <div className="hidden md:flex items-center gap-5 mr-3">
                <Link href="/dashboard" className="text-sm font-medium text-white/60 hover:text-white transition-colors flex items-center gap-2">
                  <LayoutDashboard size={14} /> Dashboard
                </Link>
              </div>

              <div className="flex items-center gap-3">
                <UserButton 
                  appearance={{ 
                    elements: { 
                      avatarBox: 'w-8 h-8 rounded-md border border-white/10 relative z-50',
                      userButtonPopoverCard: 'bg-black border border-white/10',
                      userPreviewSecondaryIdentifier: 'text-white/50',
                      userPreviewMainIdentifier: 'text-white'
                    } 
                  }} 
                />
                
                {/* Mobile Menu Button for logged in users */}
                <button 
                  className="md:hidden relative z-50 flex items-center justify-center h-9 w-9 border border-white/10 rounded-full bg-white/5 backdrop-blur-lg text-white"
                  onClick={() => setIsOpen(!isOpen)}
                >
                  <Menu size={16} className={"absolute transition-all duration-300 " + (isOpen ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100")} />
                  <X size={16} className={"absolute transition-all duration-300 " + (isOpen ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0")} />
                </button>
              </div>
            </SignedIn>
          </div>
        </div>
      </header>

      {/* Mobile Menu Panel */}
      <div 
        className={"md:hidden fixed inset-0 z-40 bg-black/80 backdrop-blur-md transition-opacity duration-300 " + (isOpen ? "opacity-100" : "opacity-0 pointer-events-none")}
        onClick={closeMenu}
      />
      
      <div 
        className={"md:hidden fixed right-0 top-0 z-40 h-full w-72 bg-black/90 border-l border-white/10 backdrop-blur-xl flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] " + (isOpen ? "translate-x-0" : "translate-x-full")}
      >
        <div className="flex flex-col gap-6 px-6 pt-24 h-full">
          
          <SignedOut>
            <div className="flex flex-col gap-4 w-full">
              <Link href="/sign-in" className="flex items-center justify-between rounded-xl px-4 py-3.5 text-base font-medium text-white/80 hover:bg-white/10 transition-all border border-transparent hover:border-white/5" onClick={closeMenu}>
                <div className="flex items-center gap-3"><LogIn size={18} /> Sign in</div>
              </Link>
              <Link href="/sign-up" className="w-full text-center rounded-full py-3.5 text-base font-medium text-black bg-white hover:bg-gray-200 transition-colors" onClick={closeMenu}>
                Get started
              </Link>
            </div>
          </SignedOut>

          <SignedIn>
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-widest text-white/40 mb-2 px-4 font-semibold">Application</span>
              <Link href="/dashboard" className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-base font-medium text-white/80 hover:bg-white/10 hover:text-white transition-all" onClick={closeMenu}>
                <LayoutDashboard size={18} /> Dashboard
              </Link>
              <Link href="/link-accounts" className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-base font-medium text-white/80 hover:bg-white/10 hover:text-white transition-all" onClick={closeMenu}>
                <Settings size={18} /> Integrations
              </Link>
            </div>
          </SignedIn>

        </div>
      </div>
    </>
  );
}
