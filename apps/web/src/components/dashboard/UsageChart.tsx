"use client";

import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import type { UsageDataPoint } from "@/types";
import { formatNumber } from "@/lib/utils";

interface UsageChartProps {
  data: UsageDataPoint[];
  type?: "area" | "bar";
  metric?: "credits" | "runs" | "items" | "all";
  height?: number;
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900 p-3 shadow-2xl text-sm">
      <p className="font-medium text-white mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-400 capitalize">{p.name}:</span>
          <span className="text-white font-medium">{formatNumber(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export function UsageChart({ data, type = "area", metric = "credits", height = 240 }: UsageChartProps) {
  if (type === "bar" || metric === "all") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={formatNumber}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: "12px", color: "#94a3b8", paddingTop: "12px" }}
          />
          <Bar dataKey="credits" fill="#7c3aed" radius={[4, 4, 0, 0]} name="Credits" />
          <Bar dataKey="runs" fill="#6366f1" radius={[4, 4, 0, 0]} name="Runs" />
          <Bar dataKey="items" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Items" />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  const colorMap: Record<string, string> = {
    credits: "#7c3aed",
    runs: "#6366f1",
    items: "#22d3ee",
  };
  const gradientIdMap: Record<string, string> = {
    credits: "creditsGrad",
    runs: "runsGrad",
    items: "itemsGrad",
  };

  const color = colorMap[metric] ?? "#7c3aed";
  const gradientId = gradientIdMap[metric] ?? "grad";

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="date"
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={formatNumber}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey={metric}
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 4, fill: color, stroke: "#0f172a", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
