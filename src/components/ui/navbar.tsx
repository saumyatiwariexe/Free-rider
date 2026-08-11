'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Activity, Menu, X, LayoutDashboard, Settings, LogIn, GitBranch } from 'lucide-react';
import { useAuth, UserButton } from '@clerk/nextjs';

const NAV_LINKS = [
  { label: 'Problem', href: '#problem' },
  { label: 'Solution', href: '#solution' },
  { label: 'How it Works', href: '#how-it-works' },
  { label: 'Features', href: '#features' },
];

export default function Navbar() {
  const { isSignedIn } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('#')) {
      e.preventDefault();
      const el = document.querySelector(href);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      closeMenu();
    }
  };

  return (
    <>
      <header
        className={`sticky top-0 z-50 w-full border-b transition-all duration-300 ${
          scrolled
            ? 'bg-black/80 backdrop-blur-xl border-white/10'
            : 'bg-transparent border-transparent'
        }`}
      >
        <div className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto w-full">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group" onClick={closeMenu}>
            <div className="p-1.5 bg-white/5 border border-white/10 rounded-md transition-colors group-hover:bg-white/10">
              <GitBranch size={16} className="text-white/80" />
            </div>
            <span className="font-semibold tracking-tight text-sm text-white">Free-Rider Tracker</span>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-widest uppercase bg-white/10 border border-white/10 text-white/50 ml-1">
              Beta
            </span>
          </Link>

          {/* Desktop Nav — public links */}
          {!isSignedIn && (
            <nav className="hidden md:flex items-center gap-6">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleAnchorClick(e, link.href)}
                  className="text-sm font-medium text-white/50 hover:text-white transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          )}

          {/* Signed-in Desktop Nav */}
          {isSignedIn && (
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/dashboard" className="text-sm font-medium text-white/50 hover:text-white transition-colors flex items-center gap-1.5">
                <LayoutDashboard size={14} /> Dashboard
              </Link>
              <Link href="/link-accounts" className="text-sm font-medium text-white/50 hover:text-white transition-colors flex items-center gap-1.5">
                <Settings size={14} /> Integrations
              </Link>
            </nav>
          )}

          {/* Right Side */}
          <div className="flex items-center gap-3">
            {!isSignedIn && (
              <>
                <div className="hidden md:flex items-center gap-3">
                  <Link
                    href="/sign-in"
                    className="text-sm font-medium text-white/50 hover:text-white transition-colors"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/sign-up"
                    className="rounded-full px-5 py-1.5 text-sm font-medium text-white bg-white/10 hover:bg-white/20 transition-colors border border-white/15"
                  >
                    Get started →
                  </Link>
                </div>

                {/* Mobile hamburger */}
                <button
                  className="md:hidden relative z-50 flex items-center justify-center h-9 w-9 border border-white/10 rounded-full bg-white/5 backdrop-blur-lg text-white"
                  onClick={() => setIsOpen(!isOpen)}
                  aria-label="Toggle menu"
                >
                  <Menu size={16} className={'absolute transition-all duration-300 ' + (isOpen ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100')} />
                  <X size={16} className={'absolute transition-all duration-300 ' + (isOpen ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0')} />
                </button>
              </>
            )}

            {isSignedIn && (
              <div className="flex items-center gap-3">
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: 'w-8 h-8 rounded-md border border-white/10 relative z-50',
                      userButtonPopoverCard: 'bg-black border border-white/10',
                      userPreviewSecondaryIdentifier: 'text-white/50',
                      userPreviewMainIdentifier: 'text-white',
                    },
                  }}
                />
                <button
                  className="md:hidden relative z-50 flex items-center justify-center h-9 w-9 border border-white/10 rounded-full bg-white/5 backdrop-blur-lg text-white"
                  onClick={() => setIsOpen(!isOpen)}
                  aria-label="Toggle menu"
                >
                  <Menu size={16} className={'absolute transition-all duration-300 ' + (isOpen ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100')} />
                  <X size={16} className={'absolute transition-all duration-300 ' + (isOpen ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0')} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Backdrop */}
      <div
        className={'md:hidden fixed inset-0 z-40 bg-black/80 backdrop-blur-md transition-opacity duration-300 ' + (isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none')}
        onClick={closeMenu}
      />

      {/* Mobile Slide-out Panel */}
      <div
        className={'md:hidden fixed right-0 top-0 z-40 h-full w-72 bg-black/90 border-l border-white/10 backdrop-blur-xl flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ' + (isOpen ? 'translate-x-0' : 'translate-x-full')}
      >
        <div className="flex flex-col gap-6 px-6 pt-24 h-full">
          {!isSignedIn && (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-widest text-white/30 mb-2 px-4 font-semibold">Navigation</span>
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => handleAnchorClick(e, link.href)}
                    className="flex items-center rounded-xl px-4 py-3 text-base font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
              <div className="flex flex-col gap-3 mt-2">
                <Link href="/sign-in" className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-base font-medium text-white/80 hover:bg-white/10 transition-all border border-transparent hover:border-white/5" onClick={closeMenu}>
                  <LogIn size={18} /> Sign in
                </Link>
                <Link href="/sign-up" className="w-full text-center rounded-full py-3.5 text-base font-medium text-black bg-white hover:bg-gray-200 transition-colors" onClick={closeMenu}>
                  Get started
                </Link>
              </div>
            </>
          )}

          {isSignedIn && (
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-widest text-white/40 mb-2 px-4 font-semibold">Application</span>
              <Link href="/dashboard" className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-base font-medium text-white/80 hover:bg-white/10 hover:text-white transition-all" onClick={closeMenu}>
                <LayoutDashboard size={18} /> Dashboard
              </Link>
              <Link href="/link-accounts" className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-base font-medium text-white/80 hover:bg-white/10 hover:text-white transition-all" onClick={closeMenu}>
                <Settings size={18} /> Integrations
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
