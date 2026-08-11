import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import { ArrowLeft, BarChart2 } from 'lucide-react';
import Link from 'next/link';
import { ReportChart } from '@/components/ReportChart';
import { GroupInsightDashboard } from '@/components/ui/dashboard-1';

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
  const { data: members } = await db.from('users').select('id, name, email, avatar_url').in('id', memberIds);
  const nameMap: Record<string, string> = {};
  members?.forEach(m => { nameMap[m.id] = m.name?.split(' ')[0] ?? m.email ?? m.id });

  // Calculate stats for Framer Motion Dashboard
  let totalEventsCount = 0;
  const providerCounts: Record<string, number> = { github: 0, figma: 0, google_docs: 0 };
  
  (report.timeline as any[]).forEach(day => {
     day.events.forEach((ev: any) => {
        totalEventsCount += ev.count;
        if (providerCounts[ev.provider] !== undefined) {
           providerCounts[ev.provider] += ev.count;
        }
     });
  });

  const parsedStats = [
    { label: "Code", value: (providerCounts.github / (totalEventsCount || 1)) * 100, color: "bg-blue-500" },
    { label: "Design", value: (providerCounts.figma / (totalEventsCount || 1)) * 100, color: "bg-fuchsia-500" },
    { label: "Docs", value: (providerCounts.google_docs / (totalEventsCount || 1)) * 100, color: "bg-amber-400" }
  ];

  const teamPayload = {
    memberCount: Object.keys(perMemberShare).length,
    members: members?.map(m => ({ id: m.id, name: nameMap[m.id], avatarUrl: m.avatar_url })) || []
  };

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
        
        {/* Left Column: Framer Motion Animated Dashboard Stats */}
        <div className="md:col-span-1">
           <GroupInsightDashboard 
             title="Scope & Activity"
             teamActivities={{ totalEvents: totalEventsCount, stats: parsedStats }}
             team={teamPayload}
           />
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
