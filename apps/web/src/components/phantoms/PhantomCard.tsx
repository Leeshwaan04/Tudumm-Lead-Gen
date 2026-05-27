"use client";

import React from "react";
import Link from "next/link";
import { Play, Star, Zap, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";
import type { Phantom } from "@/types";

const platformColors: Record<string, string> = {
  linkedin: "bg-blue-600/20 text-blue-400 border-blue-500/30",
  instagram: "bg-pink-600/20 text-pink-400 border-pink-500/30",
  twitter: "bg-sky-600/20 text-sky-400 border-sky-500/30",
  facebook: "bg-indigo-600/20 text-indigo-400 border-indigo-500/30",
  google: "bg-red-600/20 text-red-400 border-red-500/30",
  youtube: "bg-red-600/20 text-red-400 border-red-500/30",
  tiktok: "bg-slate-600/20 text-slate-300 border-slate-500/30",
  github: "bg-purple-600/20 text-purple-400 border-purple-500/30",
  reddit: "bg-orange-600/20 text-orange-400 border-orange-500/30",
};

const platformEmojis: Record<string, string> = {
  linkedin: "💼",
  instagram: "📸",
  twitter: "🐦",
  facebook: "👤",
  google: "🔍",
  youtube: "▶️",
  tiktok: "🎵",
  github: "🐙",
  reddit: "🤖",
};

interface PhantomCardProps {
  phantom: Phantom;
}

export function PhantomCard({ phantom }: PhantomCardProps) {
  const platformColor = platformColors[phantom.platform] ?? "bg-white/5 text-slate-300 border-white/10";
  const emoji = platformEmojis[phantom.platform] ?? "🤖";

  return (
    <Card className="group hover:border-violet-500/30 transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/10">
      <CardContent className="p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 text-xl shrink-0">
            {emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-white text-sm leading-tight group-hover:text-violet-300 transition-colors line-clamp-1">
                {phantom.name}
              </h3>
              {phantom.isPopular && (
                <Badge variant="purple" className="text-xs shrink-0">Popular</Badge>
              )}
            </div>
            <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border mt-1 ${platformColor}`}>
              {phantom.platform}
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-400 mb-4 line-clamp-2 leading-relaxed">
          {phantom.description}
        </p>

        <div className="flex flex-wrap gap-1 mb-4">
          {phantom.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-xs text-slate-500 bg-white/5 rounded px-1.5 py-0.5">
              {tag}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4 text-xs text-center">
          <div className="rounded-lg bg-white/5 p-2">
            <div className="flex items-center justify-center gap-1 text-amber-400 font-semibold">
              <Zap className="h-3 w-3" />
              {phantom.unitsPerRun}
            </div>
            <div className="text-slate-500 mt-0.5">runs/unit</div>
          </div>
          <div className="rounded-lg bg-white/5 p-2">
            <div className="flex items-center justify-center gap-1 text-slate-300 font-semibold">
              <Clock className="h-3 w-3" />
              {phantom.averageDuration}m
            </div>
            <div className="text-slate-500 mt-0.5">avg time</div>
          </div>
          <div className="rounded-lg bg-white/5 p-2">
            <div className="flex items-center justify-center gap-1 text-emerald-400 font-semibold">
              <Play className="h-3 w-3" />
              {formatNumber(phantom.totalLaunches)}
            </div>
            <div className="text-slate-500 mt-0.5">launches</div>
          </div>
        </div>

        <Link href={`/phantoms/${phantom.id}`}>
          <Button variant="gradient" size="sm" className="w-full group-hover:shadow-violet-500/25">
            <Play className="h-3.5 w-3.5" />
            Launch Phantom
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
