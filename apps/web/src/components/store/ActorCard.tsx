"use client";

import React from "react";
import Link from "next/link";
import { Star, Play, Shield, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";
import type { Actor } from "@/types";

const categoryLabels: Record<string, string> = {
  "social-media": "Social Media",
  "e-commerce": "E-commerce",
  "search-engines": "Search",
  maps: "Maps",
  news: "News",
  "real-estate": "Real Estate",
  finance: "Finance",
  jobs: "Jobs",
  travel: "Travel",
  "lead-generation": "Lead Gen",
  "ai-tools": "AI Tools",
  utilities: "Utilities",
};

interface ActorCardProps {
  actor: Actor;
  compact?: boolean;
}

export function ActorCard({ actor, compact = false }: ActorCardProps) {
  const stars = Math.round(actor.rating);

  return (
    <Card className="group hover:border-violet-500/30 transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/10 cursor-pointer">
      <CardContent className={compact ? "p-4" : "p-5"}>
        <div className="flex items-start gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-900/60 to-indigo-900/60 border border-violet-500/20 shrink-0">
            <span className="text-lg">🤖</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-semibold text-white text-sm group-hover:text-violet-300 transition-colors line-clamp-1">
                {actor.title}
              </h3>
              {actor.isVerified && (
                <Shield className="h-3.5 w-3.5 text-blue-400 shrink-0" />
              )}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">by {actor.authorName}</div>
          </div>
          <Badge variant="outline" className="text-xs shrink-0">
            {categoryLabels[actor.category] ?? actor.category}
          </Badge>
        </div>

        {!compact && (
          <p className="text-xs text-slate-400 mb-3 line-clamp-2 leading-relaxed">
            {actor.description}
          </p>
        )}

        <div className="flex items-center gap-3 mb-3 text-xs">
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-3 w-3 ${i < stars ? "text-amber-400 fill-amber-400" : "text-slate-700"}`}
              />
            ))}
            <span className="text-slate-400 ml-1">{actor.rating.toFixed(1)}</span>
            <span className="text-slate-600">({formatNumber(actor.ratingCount)})</span>
          </div>
          <div className="flex items-center gap-1 text-slate-500">
            <TrendingUp className="h-3 w-3" />
            {formatNumber(actor.totalRuns)} runs
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm">
            {actor.pricePerRun === 0 ? (
              <span className="text-emerald-400 font-medium">Free</span>
            ) : (
              <span className="text-white font-medium">
                ${actor.pricePerRun.toFixed(2)}
                <span className="text-slate-500 text-xs font-normal">/run</span>
              </span>
            )}
          </div>
          <Link href={`/store/${actor.id}`}>
            <Button variant="gradient" size="sm">
              <Play className="h-3 w-3" />
              Try it
            </Button>
          </Link>
        </div>

        {!compact && actor.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-white/5">
            {actor.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="text-xs text-slate-600 bg-white/5 rounded px-1.5 py-0.5">
                {tag}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
