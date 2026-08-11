import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import { ArrowLeft, BarChart2 } from 'lucide-react';
import Link from 'next/link';
import { ReportChart } from '@/components/ReportChart';

export const dynamic = 'force-dynamic';

export default async function ReportPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await params;
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect('/sign-in');

  const db = getSupabaseAdmin();
  const { data: user } = await db.from('users').select('id').eq('clerk_id', clerkId).single();
  if (!user) {
     return <div className="p-8 text-white/50">User not found</div>
  }

  const { data: report } = await db.from('insight_reports')
    .select('*, submissions(group_id, groups(name, source_refs))')
    .eq('submission_id', submissionId)
    .single();

  if (!report) {
    return (
       <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 text-center max-w-md mx-auto pt-20">
         <div className="p-6 bg-white/5 rounded-full animate-pulse border border-white/10">
            <BarChart2 size={32} className="text-white/40" />
         </div>
         <div>
            <h2 className="text-xl font-medium tracking-tight mb-2">Report Processing</h2>
            <p className="text-sm text-white/50 max-w-sm mx-auto">Our workers are analyzing the repositories and APIs. This usually completes in under 5 seconds. Reload the page shortly.</p>
         </div>
         <button className="glass-button px-6 py-3 mt-4 text-xs font-semibold tracking-widest uppercase cursor-pointer" style={{ pointerEvents: 'none' }}>
           Auto-Refreshing...
         </button>
       </div>
    );
  }

  const perMemberShare = report.per_member_share as Record<string, any>;
  const narratives = report.narrative_insights as string[];
  const group = (report.submissions as any)?.groups;

  // Resolve member names
  const memberIds = Object.keys(perMemberShare);
  const { data: members } = await db.from('users').select('id, name, email').in('id', memberIds);
  const nameMap: Record<string, string> = {};
  members?.forEach(m => { nameMap[m.id] = m.name?.split(' ')[0] ?? m.email ?? m.id });

  return (
    <div className="flex flex-col gap-10 w-full max-w-5xl mx-auto pb-20">
      <Link href="/dashboard" className="text-white/40 hover:text-white flex items-center gap-2 text-sm font-medium transition-colors w-max">
        <ArrowLeft size={16} /> Back to Dashboard
      </Link>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/5">
        <div>
           <div className="inline-flex items-center gap-2 px-3 py-1 rounded border border-white/5 bg-white/5 text-[10px] text-white/40 mb-3 tracking-widest uppercase">
              <span>{new Date(report.generated_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}</span>
           </div>
           <h1 className="text-4xl font-semibold tracking-tight">{group?.name || 'Group Insight'}</h1>
           <p className="text-white/50 mt-2 font-medium max-w-xl text-sm leading-relaxed">Objective analysis derived mathematically from raw events.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Column: Member Splits */}
        <div className="md:col-span-1 space-y-6">
           <h2 className="text-xs uppercase tracking-widest text-white/40 font-bold ml-1">Team Splits</h2>
           <div className="glass-panel p-6 space-y-10">
              {Object.entries(perMemberShare).map(([mId, shares]) => {
                const hasContributions = Object.values(shares as Record<string, number>).some(val => val > 0);
                
                return (
                  <div key={mId} className="space-y-4">
                     <h3 className="font-semibold text-lg tracking-tight">{nameMap[mId] || 'Unknown Member'}</h3>
                     {!hasContributions ? (
                       <p className="text-xs text-white/30 italic pl-3 border-l text-left border-white/10">No linked contributions.</p>
                     ) : (
                       <div className="space-y-3 border-l-2 border-white/10 pl-4">
                          {['github', 'figma', 'google_docs'].map(provider => {
                             const rawVal = (shares as any)[provider];
                             if (typeof rawVal !== 'number' || rawVal === 0) return null;
                             const pct = Math.round(rawVal * 100);
                             return (
                                <div key={provider} className="flex justify-between items-center text-xs group">
                                   <span className="text-white/40 uppercase tracking-wider group-hover:text-white/70 transition-colors">
                                     {provider.replace('_', ' ')}
                                   </span>
                                   <span className="font-semibold text-white/90">{pct}%</span>
                                </div>
                             )
                          })}
                       </div>
                     )}
                  </div>
                )
              })}
           </div>
        </div>

        {/* Right Column: Timeline & Narratives */}
        <div className="md:col-span-2 space-y-8">
           <div className="glass-panel p-6 pb-2">
              <h2 className="text-xs uppercase tracking-widest text-white/30 font-bold mb-6 ml-2">Activity Timeline (Aggregated Magnitude)</h2>
              <ReportChart timeline={report.timeline as any[]} />
           </div>

           <div className="space-y-4">
              <h2 className="text-xs uppercase tracking-widest text-white/30 font-bold ml-1">Key Insights</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {narratives.length === 0 && (
                   <p className="text-white/40 text-sm italic ml-1">No significant insights derived on this dataset.</p>
                )}
                {narratives.map((nar, idx) => (
                  <div key={idx} className="glass-panel p-6 border-white/5 text-sm leading-relaxed text-white/70 shadow-none bg-white/[0.02]">
                     {nar}
                  </div>
                ))}
              </div>
           </div>
        </div>

      </div>
    </div>
  )
}
