import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Activity } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col relative z-0">
      <header className="sticky top-0 z-40 w-full glass-panel rounded-none border-t-0 border-x-0 border-b border-white/5 bg-black/60 px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="p-1.5 bg-white/5 border border-white/10 rounded-md transition-colors group-hover:bg-white/10">
             <Activity size={18} className="text-white/70" />
          </div>
          <span className="font-semibold tracking-wide text-sm">Free-Rider Tracker</span>
        </Link>
        <div className="flex items-center gap-4">
          <UserButton 
            appearance={{ 
              elements: { 
                avatarBox: 'w-8 h-8 rounded-md border border-white/10',
                userButtonPopoverCard: 'bg-black border border-white/10',
                userPreviewSecondaryIdentifier: 'text-white/50',
                userPreviewMainIdentifier: 'text-white'
              } 
            }} 
          />
        </div>
      </header>
      <main className="flex-1 w-full max-w-7xl mx-auto p-6 md:p-10">
        {children}
      </main>
    </div>
  );
}
