import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="glass-panel p-8 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-white/50" size={32} />
        <span className="text-sm tracking-widest uppercase text-white/40 font-medium">Loading...</span>
      </div>
    </div>
  );
}
