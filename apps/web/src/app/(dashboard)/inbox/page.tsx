"use client";

import { MessageSquare, Mail, Linkedin, Search, Filter, Inbox as InboxIcon, CheckCircle2 } from "lucide-react";
import { useState } from "react";

export default function InboxPage() {
  const [activeTab, setActiveTab] = useState<"all" | "email" | "linkedin">("all");

  return (
    <div className="flex h-full flex-col min-w-0">
      <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <InboxIcon className="h-6 w-6 text-violet-400" />
            Unified Inbox
          </h1>
          <p className="text-sm text-white/50 mt-1">Manage replies across all channels in one place</p>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Thread List */}
        <div className="w-80 border-r border-white/10 flex flex-col bg-white/[0.02]">
          <div className="p-4 border-b border-white/10 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <input
                placeholder="Search messages..."
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:border-violet-500"
              />
            </div>
            <div className="flex bg-white/5 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab("all")}
                className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${activeTab === "all" ? "bg-white/10 text-white shadow" : "text-white/50 hover:text-white"}`}
              >
                All
              </button>
              <button
                onClick={() => setActiveTab("email")}
                className={`flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-md transition-colors ${activeTab === "email" ? "bg-white/10 text-white shadow" : "text-white/50 hover:text-white"}`}
              >
                <Mail className="h-3 w-3" /> Email
              </button>
              <button
                onClick={() => setActiveTab("linkedin")}
                className={`flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-md transition-colors ${activeTab === "linkedin" ? "bg-white/10 text-white shadow" : "text-white/50 hover:text-white"}`}
              >
                <Linkedin className="h-3 w-3" /> LinkedIn
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-white/[0.02] m-4 rounded-2xl border border-white/5 shadow-inner">
            <div className="h-16 w-16 rounded-full bg-violet-500/10 flex items-center justify-center mb-4 ring-1 ring-violet-500/20 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
              <CheckCircle2 className="h-8 w-8 text-violet-400" />
            </div>
            <h3 className="font-semibold text-white">Inbox Zero</h3>
            <p className="text-sm text-white/40 mt-1 max-w-[200px] leading-relaxed">You&apos;re all caught up! No new replies across your active channels.</p>
          </div>
        </div>

        {/* Message Detail (Empty State) */}
        <div className="flex-1 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-900/10 via-black to-black min-w-0">
          <div className="flex flex-col items-center justify-center max-w-sm text-center p-8 rounded-3xl bg-white/[0.02] border border-white/5 shadow-2xl backdrop-blur-xl">
            <div className="h-16 w-16 rounded-full bg-violet-500/10 flex items-center justify-center mb-4">
              <MessageSquare className="h-8 w-8 text-violet-400" />
            </div>
            <h2 className="text-lg font-medium text-white mb-2">No Thread Selected</h2>
            <p className="text-sm text-white/40 leading-relaxed">Select a conversation from the sidebar to view the full message history and reply.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
