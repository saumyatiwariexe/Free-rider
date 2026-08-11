/**
 * Report generation logic — pure functions, no I/O.
 *
 * Takes a list of ContributionEventRow (from DB) + resolved member IDs
 * and produces the full InsightReport shape:
 *  - per_member_share: per-provider contribution % per member
 *  - timeline: day-bucketed activity
 *  - narrative_insights: ≥3 plain-language strings
 */

import type {
  ContributionEventRow,
  InsightReportInsert,
  PerMemberShare,
  TimelineBucket,
  Provider,
} from '@/types/db';

// ── Per-member share calculation ────────────────────────────

function calcPerMemberShare(events: ContributionEventRow[]): PerMemberShare {
  // Aggregate magnitude per user per provider
  const sums: Record<string, Record<Provider, number>> = {};

  for (const ev of events) {
    if (!sums[ev.user_id]) sums[ev.user_id] = { github: 0, figma: 0, google_docs: 0 };
    sums[ev.user_id][ev.provider] += ev.magnitude;
  }

  // Provider totals
  const providerTotals: Record<Provider, number> = { github: 0, figma: 0, google_docs: 0 };
  for (const userSums of Object.values(sums)) {
    for (const [prov, mag] of Object.entries(userSums) as [Provider, number][]) {
      providerTotals[prov] += mag;
    }
  }

  // Convert to fractions (0–1)
  const result: PerMemberShare = {};
  for (const [userId, userSums] of Object.entries(sums)) {
    result[userId] = {};
    for (const prov of ['github', 'figma', 'google_docs'] as Provider[]) {
      const total = providerTotals[prov];
      if (total > 0 && userSums[prov] > 0) {
        result[userId][prov] = parseFloat((userSums[prov] / total).toFixed(4));
      }
    }
  }

  return result;
}

// ── Timeline bucketing ──────────────────────────────────────

function calcTimeline(events: ContributionEventRow[]): TimelineBucket[] {
  // Group events by date (YYYY-MM-DD)
  const buckets: Record<string, TimelineBucket['events']> = {};

  for (const ev of events) {
    const date = ev.timestamp.slice(0, 10); // "YYYY-MM-DD"
    if (!buckets[date]) buckets[date] = [];

    // Find existing bucket entry for this user+provider
    const existing = buckets[date].find(
      (e) => e.user_id === ev.user_id && e.provider === ev.provider
    );

    if (existing) {
      existing.count += 1;
      existing.magnitude += ev.magnitude;
    } else {
      buckets[date].push({
        user_id: ev.user_id,
        provider: ev.provider,
        count: 1,
        magnitude: ev.magnitude,
      });
    }
  }

  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, evts]) => ({ date, events: evts }));
}

// ── Narrative insights ──────────────────────────────────────

function calcNarrative(
  events: ContributionEventRow[],
  perMemberShare: PerMemberShare,
  memberNames: Record<string, string>
): string[] {
  const insights: string[] = [];
  const getName = (id: string) => memberNames[id] ?? `Member ${id.slice(0, 6)}`;

  // Insight 1: Top GitHub contributor
  const githubEvents = events.filter((e) => e.provider === 'github');
  if (githubEvents.length > 0) {
    const githubSums: Record<string, number> = {};
    for (const e of githubEvents) {
      githubSums[e.user_id] = (githubSums[e.user_id] ?? 0) + e.magnitude;
    }
    const topGithub = Object.entries(githubSums).sort(([, a], [, b]) => b - a)[0];
    if (topGithub) {
      const pct = Math.round((perMemberShare[topGithub[0]]?.github ?? 0) * 100);
      insights.push(
        `${getName(topGithub[0])} led code contributions with ${pct}% of all lines changed (${topGithub[1].toLocaleString()} lines).`
      );
    }
  }

  // Insight 2: Top Figma contributor
  const figmaEvents = events.filter((e) => e.provider === 'figma');
  if (figmaEvents.length > 0) {
    const figmaSums: Record<string, number> = {};
    for (const e of figmaEvents) {
      figmaSums[e.user_id] = (figmaSums[e.user_id] ?? 0) + e.magnitude;
    }
    const topFigma = Object.entries(figmaSums).sort(([, a], [, b]) => b - a)[0];
    if (topFigma) {
      const pct = Math.round((perMemberShare[topFigma[0]]?.figma ?? 0) * 100);
      insights.push(
        `${getName(topFigma[0])} was the primary designer with ${pct}% of Figma versions (${topFigma[1]} versions saved).`
      );
    }
  }

  // Insight 3: Most active day
  const dayTotals: Record<string, number> = {};
  for (const e of events) {
    const day = e.timestamp.slice(0, 10);
    dayTotals[day] = (dayTotals[day] ?? 0) + 1;
  }
  const busiestDay = Object.entries(dayTotals).sort(([, a], [, b]) => b - a)[0];
  if (busiestDay) {
    const date = new Date(busiestDay[0]).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    insights.push(
      `The team was most active on ${date} with ${busiestDay[1]} contribution events.`
    );
  }

  // Insight 4: Late-stage contribution check (last 20% of time window)
  const timestamps = events.map((e) => new Date(e.timestamp).getTime()).sort((a, b) => a - b);
  if (timestamps.length >= 5) {
    const windowStart = timestamps[0];
    const windowEnd = timestamps[timestamps.length - 1];
    const lateWindow = windowEnd - (windowEnd - windowStart) * 0.2;

    const lateEvents = events.filter((e) => new Date(e.timestamp).getTime() >= lateWindow);
    const lateSums: Record<string, number> = {};
    for (const e of lateEvents) {
      lateSums[e.user_id] = (lateSums[e.user_id] ?? 0) + 1;
    }
    const topLate = Object.entries(lateSums).sort(([, a], [, b]) => b - a)[0];
    if (topLate && lateSums[topLate[0]] / lateEvents.length > 0.4) {
      insights.push(
        `${getName(topLate[0])} contributed heavily in the final stretch (${lateSums[topLate[0]]} of ${lateEvents.length} late-stage events).`
      );
    }
  }

  // Insight 5: Member with zero contribution in any linked provider
  const activeUsers = new Set(events.map((e) => e.user_id));
  const allMembers = Object.keys(perMemberShare);
  const inactive = allMembers.filter((id) => !activeUsers.has(id));
  if (inactive.length > 0) {
    const names = inactive.map(getName).join(', ');
    insights.push(
      `${names} ${inactive.length === 1 ? 'has' : 'have'} no recorded contribution events across any linked source.`
    );
  }

  return insights.filter(Boolean).slice(0, 5);
}

// ── Main export ─────────────────────────────────────────────

export function generateReport(
  submissionId: string,
  events: ContributionEventRow[],
  memberNames: Record<string, string>  // { userId → displayName }
): InsightReportInsert {
  const perMemberShare = calcPerMemberShare(events);
  const timeline = calcTimeline(events);
  const narrativeInsights = calcNarrative(events, perMemberShare, memberNames);

  return {
    submission_id: submissionId,
    per_member_share: perMemberShare,
    timeline,
    narrative_insights: narrativeInsights,
  };
}
