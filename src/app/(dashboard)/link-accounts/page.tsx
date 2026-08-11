import { auth, currentUser } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';

// ── SVG Icons ──────────────────────────────────────────────

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z" />
    </svg>
  );
}

function FigmaIcon() {
  return (
    <svg viewBox="0 0 38 57" width="18" height="22" fill="none">
      <path d="M19 28.5C19 33.7467 14.7467 38 9.5 38C4.25329 38 0 33.7467 0 28.5C0 23.2533 4.25329 19 9.5 19C14.7467 19 19 23.2533 19 28.5Z" fill="#1ABCFE"/>
      <path d="M0 47.5C0 52.7467 4.25329 57 9.5 57C14.7467 57 19 52.7467 19 47.5V38H9.5C4.25329 38 0 42.2533 0 47.5Z" fill="#0ACF83"/>
      <path d="M19 0H9.5C4.25329 0 0 4.25329 0 9.5C0 14.7467 4.25329 19 9.5 19H19V0Z" fill="#F24E1E"/>
      <path d="M19 19H28.5C33.7467 19 38 14.7467 38 9.5C38 4.25329 33.7467 0 28.5 0H19V19Z" fill="#FF7262"/>
      <path d="M38 28.5C38 33.7467 33.7467 38 28.5 38C23.2533 38 19 33.7467 19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5Z" fill="#A259FF"/>
    </svg>
  );
}

function GoogleDocsIcon() {
  return (
    <svg viewBox="0 0 48 48" width="22" height="22">
      <path fill="#4285F4" d="M37,45H11c-1.657,0-3-1.343-3-3V6c0-1.657,1.343-3,3-3h19l10,10v29C40,43.657,38.657,45,37,45z" />
      <path fill="#C3D9FF" d="M40 13L30 13 30 3z" />
      <path fill="#1A73E8" d="M30 13L40 23 40 13z" />
      <path fill="#E8EAF6" d="M15 23H33V27H15zM15 31H33V35H15zM15 15H25V19H15z" />
    </svg>
  );
}

// ── Provider meta ──────────────────────────────────────────

const PROVIDERS: {
  id: string;
  name: string;
  description: string;
  linkHref: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  {
    id: 'github',
    name: 'GitHub',
    description: 'Track code commits, pull requests, and review activity.',
    linkHref: '/api/link/github',
    icon: <GithubIcon />,
    color: 'from-white/5 to-white/[0.02]',
  },
  {
    id: 'figma',
    name: 'Figma',
    description: 'Track design file edits, version saves, and contributions.',
    linkHref: '/api/link/figma',
    icon: <FigmaIcon />,
    color: 'from-[#A259FF]/10 to-[#1ABCFE]/5',
  },
  {
    id: 'google_docs',
    name: 'Google Docs',
    description: 'Track document revisions and collaborative edits.',
    linkHref: '/api/link/google',
    icon: <GoogleDocsIcon />,
    color: 'from-[#4285F4]/10 to-[#34A853]/5',
  },
];

// ── Page ───────────────────────────────────────────────────

export default async function LinkAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect('/sign-in');

  const params = await searchParams;
  const successProvider = params.success;
  const errorCode = params.error;

  const db = getSupabaseAdmin();

  // Ensure user exists (local dev fallback in case webhook didn't fire)
  let { data: user } = await db.from('users').select('id, name').eq('clerk_id', clerkId).single();

  if (!user) {
    const clerkUser = await currentUser();
    if (clerkUser) {
      const email = clerkUser.emailAddresses[0]?.emailAddress ?? '';
      const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'Contributor';
      const { data: upsertedUser } = await db
        .from('users')
        .upsert({ clerk_id: clerkId, email, name, avatar_url: clerkUser.imageUrl }, { onConflict: 'clerk_id' })
        .select('id, name')
        .single();
      user = upsertedUser;
    }
    if (!user) redirect('/sign-in');
  }

  // Fetch linked providers
  const { data: accounts } = await db
    .from('linked_accounts')
    .select('provider, linked_at')
    .eq('user_id', user.id);

  const linkedMap: Record<string, string> = {};
  for (const a of accounts ?? []) {
    linkedMap[a.provider] = a.linked_at;
  }

  // Human-readable messages
  const errorMessages: Record<string, string> = {
    figma_denied: 'Figma authorization was cancelled or denied.',
    figma_token_failed: 'Could not exchange your Figma authorization code. Please try again.',
    figma_save_failed: 'Connected to Figma but failed to save your account. Please try again.',
    google_denied: 'Google authorization was cancelled or denied.',
    google_token_failed: 'Could not exchange your Google authorization code. Please try again.',
    google_save_failed: 'Connected to Google but failed to save your account. Please try again.',
    user_not_found: 'Your user profile was not found. Please sign out and sign back in.',
  };

  const successMessages: Record<string, string> = {
    figma: 'Figma account linked successfully! Design activity will now be tracked.',
    google: 'Google Docs account linked successfully! Document revisions will now be tracked.',
    github: 'GitHub account linked successfully!',
  };

  return (
    <div className="flex flex-col gap-14 w-full max-w-4xl mx-auto pb-20">

      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-white/50 font-medium">
          Connect your accounts so Free-Rider Tracker can measure real contributions.
        </p>
      </div>

      {/* Notifications */}
      {successProvider && successMessages[successProvider] && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white/80">
          <CheckCircle2 size={18} className="text-white/60 mt-0.5 flex-shrink-0" />
          <span>{successMessages[successProvider]}</span>
        </div>
      )}
      {errorCode && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-sm text-red-300/80">
          <AlertCircle size={18} className="text-red-400 mt-0.5 flex-shrink-0" />
          <span>{errorMessages[errorCode] ?? `An unknown error occurred (${errorCode}).`}</span>
        </div>
      )}

      {/* Provider Cards */}
      <section className="space-y-6">
        <h2 className="text-xs uppercase tracking-widest text-white/30 font-bold border-b border-white/5 pb-3">
          Connected Sources
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {PROVIDERS.map((p) => {
            const isLinked = Boolean(linkedMap[p.id]);
            const linkedAt = linkedMap[p.id];

            return (
              <div
                key={p.id}
                className={`glass-panel p-6 flex flex-col gap-6 relative overflow-hidden bg-gradient-to-br ${p.color}`}
              >
                {/* Icon row */}
                <div className="flex items-start justify-between w-full">
                  <div
                    className={`p-3 rounded-xl border flex items-center justify-center transition-colors ${
                      isLinked
                        ? 'bg-white/10 border-white/20 text-white'
                        : 'bg-black/50 border-white/5 text-white/40'
                    }`}
                  >
                    {p.icon}
                  </div>
                  {isLinked && <CheckCircle2 size={18} className="text-white/50" />}
                </div>

                {/* Info */}
                <div className="flex flex-col gap-1 flex-1">
                  <h3 className="text-base font-semibold">{p.name}</h3>
                  <p className="text-xs text-white/40 leading-relaxed">{p.description}</p>
                  {linkedAt && (
                    <p className="text-[10px] text-white/25 mt-1">
                      Linked {new Date(linkedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {/* Action */}
                <div className="w-full">
                  {isLinked ? (
                    <div className="w-full py-2.5 px-3 border border-white/10 bg-white/5 rounded text-xs font-semibold tracking-wider text-center flex items-center justify-center gap-2 text-white/60">
                      <CheckCircle2 size={13} /> Connected
                    </div>
                  ) : (
                    <a
                      href={p.linkHref}
                      className="glass-button w-full py-2.5 text-xs text-center border-white/20 flex items-center justify-center gap-1.5"
                    >
                      Connect <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Help text */}
      <section className="glass-panel p-6 space-y-3">
        <h3 className="text-white/60 font-semibold text-sm">How it works</h3>
        <ul className="list-disc list-inside space-y-1 text-xs text-white/40 leading-relaxed">
          <li>Connect each tool you use for your group project.</li>
          <li>When a new insight report is run, Free-Rider Tracker fetches your activity from each connected source.</li>
          <li>Contribution scores are computed across all sources and compared across team members.</li>
          <li>Free-rider detection flags members with disproportionately low contributions.</li>
        </ul>
        <p className="pt-1">
          <Link
            href="/dashboard"
            className="text-xs text-white/50 underline underline-offset-2 hover:text-white transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </p>
      </section>

    </div>
  );
}
