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
      // Use upsert to guarantee existing users get their avatar_url updated
      const { data: upsertedUser } = await db.from('users').upsert({
        clerk_id: clerkId,
        email,
        name,
        avatar_url: clerkUser.imageUrl
      }, { onConflict: 'clerk_id' }).select('id, name').single();
      user = upsertedUser;
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
             icon={<GithubIcon />}
             isLinked={linkedProviders.includes('github')} 
           />
           <ProviderCard 
             provider="figma"
             name="Figma"
             description="Design edits"
             icon={<FigmaIcon />}
             isLinked={linkedProviders.includes('figma')} 
           />
           <ProviderCard 
             provider="google"
             name="Google Docs"
             description="Document revisions"
             icon={<GoogleDocsIcon />}
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

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} width="24" height="24">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z" />
    </svg>
  );
}

function FigmaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 38 57" className={className} width="24" height="24" fill="none">
      <path d="M19 28.5C19 33.7467 14.7467 38 9.5 38C4.25329 38 0 33.7467 0 28.5C0 23.2533 4.25329 19 9.5 19C14.7467 19 19 23.2533 19 28.5Z" fill="#1ABCFE"/>
      <path d="M0 47.5C0 52.7467 4.25329 57 9.5 57C14.7467 57 19 52.7467 19 47.5V38H9.5C4.25329 38 0 42.2533 0 47.5Z" fill="#0ACF83"/>
      <path d="M19 0H9.5C4.25329 0 0 4.25329 0 9.5C0 14.7467 4.25329 19 9.5 19H19V0Z" fill="#F24E1E"/>
      <path d="M19 19H28.5C33.7467 19 38 14.7467 38 9.5C38 4.25329 33.7467 0 28.5 0H19V19Z" fill="#FF7262"/>
      <path d="M38 28.5C38 33.7467 33.7467 38 28.5 38C23.2533 38 19 33.7467 19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5Z" fill="#A259FF"/>
    </svg>
  );
}

function GoogleDocsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} width="24" height="24">
      <path fill="#4285F4" d="M37,45H11c-1.657,0-3-1.343-3-3V6c0-1.657,1.343-3,3-3h19l10,10v29C40,43.657,38.657,45,37,45z" />
      <path fill="#C3D9FF" d="M40 13L30 13 30 3z" />
      <path fill="#1A73E8" d="M30 13L40 23 40 13z" />
      <path fill="#E8EAF6" d="M15 23H33V27H15zM15 31H33V35H15zM15 15H25V19H15z" />
    </svg>
  );
}
