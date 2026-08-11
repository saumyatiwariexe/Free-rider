import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Code2, PenTool, FileText, ChevronRight } from 'lucide-react';

export default async function LandingPage() {
  const { userId } = await auth();

  // If heavily logged in, direct to dashboard
  if (userId) {
    redirect('/dashboard');
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-12 relative overflow-hidden">
      {/* Subtle dynamic background elements could go here, but avoiding gradients. */}
      {/* Background is handled in globals.css (radial-gradient for lighting) */}

      <div className="w-full max-w-4xl mx-auto flex flex-col items-center text-center space-y-16 z-10">
        
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/50 mb-4 tracking-widest uppercase">
            <span>Free-Rider Tracker</span>
          </div>
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tighter">
            Measure Work, <br />
            <span className="text-white/40">Not Talk.</span>
          </h1>
          <p className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto font-medium leading-relaxed">
            Passive contribution tracking across code, design, and docs. 
            Zero friction. Zero self-reporting. Objective team insights.
          </p>
        </div>

        <div className="glass-panel p-8 sm:p-12 w-full max-w-2xl flex flex-col items-center space-y-12">
          
          <div className="grid grid-cols-3 w-full border-b border-white/5 pb-8">
             <div className="flex flex-col items-center gap-4 text-white/40">
                <Code2 size={32} strokeWidth={1.5} />
                <span className="text-xs font-semibold tracking-widest uppercase">Code</span>
             </div>
             <div className="flex flex-col items-center gap-4 text-white/40 border-l border-white/5">
                <PenTool size={32} strokeWidth={1.5} />
                <span className="text-xs font-semibold tracking-widest uppercase">Design</span>
             </div>
             <div className="flex flex-col items-center gap-4 text-white/40 border-l border-white/5">
                <FileText size={32} strokeWidth={1.5} />
                <span className="text-xs font-semibold tracking-widest uppercase">Docs</span>
             </div>
          </div>

          <div className="flex flex-col w-full items-center gap-4">
            <Link href="/sign-up" className="glass-button px-8 py-4 text-sm uppercase tracking-widest w-full flex items-center justify-center gap-2 border-white/30">
              Get Started <ChevronRight size={16} />
            </Link>
            <Link href="/sign-in" className="text-sm text-white/30 hover:text-white transition-colors">
              Already have an account? Sign in
            </Link>
          </div>

        </div>

      </div>
    </main>
  );
}
