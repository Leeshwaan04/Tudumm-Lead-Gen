"use client";

import React from "react";
import { Zap, TrendingUp, TrendingDown, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCredits, formatDate } from "@/lib/utils";
import type { CreditBalance } from "@/types";
import { cn } from "@/lib/utils";

interface CreditBalanceCardProps {
  balance: CreditBalance;
}

export function CreditBalanceCard({ balance }: CreditBalanceCardProps) {
  const usagePct = Math.round((balance.used / balance.total) * 100);
  const isHigh = usagePct > 80;
  const isMedium = usagePct > 60 && usagePct <= 80;

  return (
    <Card className="relative overflow-hidden border-violet-500/20 bg-gradient-to-br from-violet-900/30 to-indigo-900/20">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-600/5 to-transparent pointer-events-none" />
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-400">Credit Balance</CardTitle>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/20 border border-violet-500/30">
          <Zap className="h-4 w-4 text-violet-400" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-white mb-1">
          {formatCredits(balance.remaining)}
        </div>
        <div className="text-sm text-slate-400 mb-4">
          of {formatCredits(balance.total)} total
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-500">
            <span>{usagePct}% used</span>
            <span>{formatCredits(balance.used)} consumed</span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700",
                isHigh ? "bg-red-500" : isMedium ? "bg-amber-500" : "bg-violet-500"
              )}
              style={{ width: `${usagePct}%` }}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
          <RotateCcw className="h-3 w-3" />
          Resets {formatDate(balance.resetDate)}
        </div>
      </CardContent>
    </Card>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  icon: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  gradient?: string;
}

export function StatCard({ title, value, subtitle, trend, icon: Icon, iconColor = "text-slate-400", gradient }: StatCardProps) {
  const isPositive = (trend ?? 0) >= 0;
  return (
    <Card className={cn("relative overflow-hidden", gradient)}>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-400">{title}</CardTitle>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 border border-white/10">
          <Icon className={cn("h-4 w-4", iconColor)} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-white">{value}</div>
        {subtitle && <div className="text-sm text-slate-400 mt-1">{subtitle}</div>}
        {trend !== undefined && (
          <div
            className={cn(
              "mt-2 flex items-center gap-1 text-xs font-medium",
              isPositive ? "text-emerald-400" : "text-red-400"
            )}
          >
            {isPositive ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            {Math.abs(trend)}% from last month
          </div>
        )}
      </CardContent>
    </Card>
  );
}
