"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function MailTrafficChart({
  data,
}: {
  data: { label: string; mail: number; spam: number }[];
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="mailFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2f6fed" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#2f6fed" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="spamFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d4af37" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#d4af37" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(139,149,168,0.12)" vertical={false} />
          <XAxis dataKey="label" stroke="#8b95a8" fontSize={12} tickLine={false} />
          <YAxis stroke="#8b95a8" fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              background: "#0b1220",
              border: "1px solid rgba(212,175,55,0.2)",
              borderRadius: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="mail"
            stroke="#2f6fed"
            fill="url(#mailFill)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="spam"
            stroke="#d4af37"
            fill="url(#spamFill)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
