"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Terminal } from "lucide-react";
import Link from "next/link";

export default function NewReportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setStatusText("Detecting group members...");

    const formData = new FormData(e.currentTarget);
    const repoUrl = formData.get("repo_url") as string;
    
    if (!repoUrl) {
      setError("Please provide at least a GitHub Repo URL for this snapshot.");
      setLoading(false);
      return;
    }

    try {
      // 1. Detect Group
      const detectRes = await fetch("/api/groups/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_refs: { repo_url: repoUrl },
        })
      });

      const detectData = await detectRes.json();
      if (!detectRes.ok) throw new Error(detectData.error || "Failed group detection");

      setStatusText("Compiling contribution events...");

      // 2. Submit for generation
      const subRes = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_id: detectData.group.id })
      });

      const subData = await subRes.json();
      if (!subRes.ok) throw new Error(subData.error || "Failed to trigger submission");

      setStatusText("Generating report...");
      
      // In a real app we might poll, here we jump to report route and let it handle processing states
      // We know worker runs fast if we hit our test API structure, but the real setup relies on pushing
      // We will simulate hitting the inline test pipeline if WORKER_URL is missing, or just go to report
      // To ensure this works cleanly, we will ping api/worker/process manually for local dev
      
      try {
         await fetch("/api/worker/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ submission_id: subData.submission_id, group_id: detectData.group.id })
         });
      } catch (e) {
         // Silently fail, it might be dev environment where QStash is missing
      }

      router.push(`/report/${subData.submission_id}`);

    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-2xl mx-auto pb-20">
      
      <div>
        <Link href="/dashboard" className="text-white/40 hover:text-white flex items-center gap-2 mb-6 text-sm font-medium transition-colors w-max">
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Run Group Insight</h1>
        <p className="text-white/50 mt-2 font-medium">Link a shared resource to pull contribution history instantly.</p>
      </div>

      <div className="glass-panel p-8 sm:p-10">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="space-y-2">
            <label className="text-xs tracking-widest uppercase font-bold text-white/50 ml-1">GitHub Repository URL</label>
            <div className="relative flex items-center">
              <Terminal size={16} className="absolute left-4 text-white/40" />
              <input 
                name="repo_url" 
                type="text" 
                placeholder="e.g. saumyatiwariexe/Free-rider"
                className="w-full bg-black/50 border border-white/10 rounded-lg py-4 pl-12 pr-4 text-sm font-mono focus:outline-none focus:border-white/30 transition-colors"
                disabled={loading}
              />
            </div>
            <p className="text-xs text-white/30 ml-1 mt-2">Just owner/repo is sufficient. We will extract all commit lines.</p>
          </div>

          {error && (
            <div className="p-4 bg-red-950/20 border border-red-500/20 rounded-md text-red-500/80 text-sm">
              {error}
            </div>
          )}

          <div className="pt-6">
            <button 
              type="submit" 
              disabled={loading}
              className="glass-button w-full py-4 text-sm font-bold tracking-widest uppercase flex items-center justify-center gap-3 border-white/30 disabled:opacity-50"
            >
              {loading ? (
                <> <Loader2 size={16} className="animate-spin" /> {statusText} </>
              ) : (
                "Launch Analysis"
              )}
            </button>
          </div>

        </form>
      </div>

    </div>
  )
}
