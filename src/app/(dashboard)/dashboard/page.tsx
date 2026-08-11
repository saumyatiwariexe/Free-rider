import { auth, currentUser } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { Code2, PenTool, FileText, CheckCircle2, Link as LinkIcon, Play, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect('/sign-in');

  const db = getSupabaseAdmin();

  // Get user
  let { data: user } = await db.from('users').select('id, name').eq('clerk_id', clerkId).single();
  
  if (!user) {
    // Local dev fallback: If webhook didn't fire (e.g. no ngrok), insert user manually
    const clerkUser = await currentUser();
    if (clerkUser) {
      const email = clerkUser.emailAddresses[0]?.emailAddress ?? '';
      const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'Contributor';
      const { data: newUser } = await db.from('users').insert({
        clerk_id: clerkId,
        email,
        name,
        avatar_url: clerkUser.imageUrl
      }).select('id, name').single();
      user = newUser;
    }

    if (!user) {
      return (
        <div className="flex h-[50vh] flex-col items-center justify-center p-8 text-white/40 gap-4">
           <RefreshCw className="animate-spin" size={24} />
           <p>Syncing user profile via webhooks...</p>
        </div>
      );
    }
  }

  // Get linked accounts
  const { data: accounts } = await db.from('linked_accounts').select('provider, linked_at').eq('user_id', user.id);
  const linkedProviders = accounts?.map(a => a.provider) ?? [];

  return (
    <div className="flex flex-col gap-14 w-full max-w-4xl mx-auto pb-20">
      
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome, {user.name?.split(' ')[0] ?? 'Contributor'}</h1>
        <p className="text-white/50 font-medium">Manage your connected sources and view team insight reports.</p>
      </div>

      {/* Linked Accounts Grid */}
      <section className="space-y-6">
        <h2 className="text-xs uppercase tracking-widest text-white/30 font-bold border-b border-white/5 pb-3">
          Verification Sources
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
           <ProviderCard 
             provider="github" 
             name="GitHub"
             description="Code commits"
             icon={<Code2 size={24} strokeWidth={1.5} />}
             isLinked={linkedProviders.includes('github')} 
           />
           <ProviderCard 
             provider="figma"
             name="Figma"
             description="Design edits"
             icon={<PenTool size={24} strokeWidth={1.5} />}
             isLinked={linkedProviders.includes('figma')} 
           />
           <ProviderCard 
             provider="google"
             name="Google Docs"
             description="Document revisions"
             icon={<FileText size={24} strokeWidth={1.5} />}
             isLinked={linkedProviders.includes('google_docs')} 
           />
        </div>
      </section>

      {/* New Report Trigger */}
      <section className="space-y-6">
        <h2 className="text-xs uppercase tracking-widest text-white/30 font-bold border-b border-white/5 pb-3">
          Analysis
        </h2>
        <div className="glass-panel p-8 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
           <div className="space-y-3">
              <h3 className="text-xl font-medium tracking-tight">Run Group Insight</h3>
              <p className="text-sm text-white/40 max-w-md leading-relaxed">
                Provide a repository URL, Figma link, or Google Doc ID to auto-detect members and instantly measure the team's true contribution state.
              </p>
           </div>
           <Link href="/dashboard/new" className="glass-button px-6 py-4 border-white/30 whitespace-nowrap flex items-center gap-3">
              Start Snapshot <Play size={16} fill="white" />
           </Link>
        </div>
      </section>

    </div>
  )
}

function ProviderCard({ provider, name, description, icon, isLinked }: { provider: string, name: string, description: string, icon: React.ReactNode, isLinked: boolean }) {
  const linkHref = `/api/link/${provider}`;
  
  return (
    <div className="glass-panel p-6 flex flex-col items-start gap-8 relative overflow-hidden group">
      {/* Decorative gradient blob inside the card, highly subdued */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/[0.02] rounded-full blur-2xl group-hover:bg-white/[0.04] transition-colors"></div>

      <div className="w-full flex justify-between items-start z-10">
        <div className={`p-3 rounded-xl border flex items-center justify-center transition-colors ${isLinked ? 'bg-white/10 border-white/20 text-white' : 'bg-black/50 border-white/5 text-white/40'}`}>
          {icon}
        </div>
        {isLinked && <CheckCircle2 size={20} className="text-white/60" />}
      </div>

      <div className="space-y-1 z-10 w-full">
        <h4 className="text-base font-semibold">{name}</h4>
        <p className="text-xs tracking-wide text-white/40 uppercase">{description}</p>
        
        <div className="pt-6 w-full">
          {isLinked ? (
            <div className="w-full py-2.5 px-3 border border-white/10 bg-white/5 rounded text-xs font-semibold tracking-wider text-center flex items-center justify-center gap-2">
              <CheckCircle2 size={14} /> Connected
            </div>
          ) : (
            <a href={linkHref} className="glass-button w-full block py-2.5 text-xs text-center border-white/20">
              Link Account <LinkIcon size={12} className="inline ml-1" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
