'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatPaise } from '@/lib/money';

/**
 * One chart, one job: show whether money is arriving.
 *
 * Colour carries meaning here (green = received), so it matches the status
 * palette rather than picking a decorative hue. Axis labels use compact
 * currency so a ₹4,15,360 day does not push the axis off screen.
 */
export function RevenueChart({
  data,
  currency,
}: {
  data: { day: string; amountPaise: number }[];
  currency: string;
}) {
  const hasAny = data.some((point) => point.amountPaise > 0);

  if (!hasAny) {
    return (
      <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        No payments received in this window yet.
      </div>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="collected" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.28} />
              <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={(value: string) => value.slice(5)}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(value: number) => formatPaise(value, currency, 'en-IN', { compact: true })}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            width={64}
          />
          <Tooltip
            cursor={{ stroke: 'hsl(var(--border))' }}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid hsl(var(--border))',
              fontSize: 12,
              background: 'hsl(var(--popover))',
            }}
            labelFormatter={(label: string) => label}
            formatter={(value: number) => [formatPaise(value, currency), 'Collected']}
          />
          <Area
            type="monotone"
            dataKey="amountPaise"
            stroke="hsl(var(--success))"
            strokeWidth={2}
            fill="url(#collected)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
