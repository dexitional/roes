// Admin charts built on the shadcn-style ChartContainer.
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { cn } from '@roes/ui'
import { compact, date, money } from '#/lib/format'
import { ChartContainer, ChartLegend, ChartTooltip } from '#/components/ui/chart'
import type { ChartConfig } from '#/components/ui/chart'

const dayLabel = (d: string | number) => date(String(d), { day: 'numeric', month: 'short' })

export function TrendChart({
  data,
  series,
  height = 300,
  kind = 'area',
  rightAxis,
}: {
  data: Array<Record<string, number | string>>
  series: ChartConfig
  height?: number
  kind?: 'area' | 'line'
  rightAxis?: string
}) {
  const keys = Object.keys(series)
  const Chart = kind === 'area' ? AreaChart : LineChart
  return (
    <ChartContainer config={series} height={height}>
      <Chart data={data} margin={{ top: 8, right: rightAxis ? 4 : 8, left: -12, bottom: 0 }}>
        <defs>
          {keys.map((k) => (
            <linearGradient key={k} id={`fill-${k}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={`var(--color-${k})`} stopOpacity={0.28} />
              <stop offset="100%" stopColor={`var(--color-${k})`} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={28} tickFormatter={dayLabel} />
        <YAxis yAxisId="left" tickLine={false} axisLine={false} tickFormatter={(v) => compact(Number(v))} width={44} />
        {rightAxis && <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tickFormatter={(v) => compact(Number(v))} width={44} />}
        <ChartTooltip labelFormatter={dayLabel} />
        <ChartLegend />
        {keys.map((k) =>
          kind === 'area' ? (
            <Area key={k} yAxisId={k === rightAxis ? 'right' : 'left'} dataKey={k} type="monotone" stroke={`var(--color-${k})`} strokeWidth={2} fill={`url(#fill-${k})`} />
          ) : (
            <Line key={k} yAxisId={k === rightAxis ? 'right' : 'left'} dataKey={k} type="monotone" stroke={`var(--color-${k})`} strokeWidth={2} dot={false} />
          ),
        )}
      </Chart>
    </ChartContainer>
  )
}

export function BarsChart({
  data,
  series,
  categoryKey,
  height = 300,
  horizontal = false,
  stacked = false,
}: {
  data: Array<Record<string, number | string>>
  series: ChartConfig
  categoryKey: string
  height?: number
  horizontal?: boolean
  stacked?: boolean
}) {
  const keys = Object.keys(series)
  return (
    <ChartContainer config={series} height={height}>
      <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 4, right: 12, left: horizontal ? 8 : -12, bottom: 0 }} barCategoryGap="22%">
        <CartesianGrid vertical={horizontal} horizontal={!horizontal} strokeDasharray="3 3" />
        {horizontal ? (
          <>
            <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v) => compact(Number(v))} />
            <YAxis type="category" dataKey={categoryKey} tickLine={false} axisLine={false} width={130} tick={{ fontSize: 11 }} />
          </>
        ) : (
          <>
            <XAxis dataKey={categoryKey} tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => compact(Number(v))} width={44} />
          </>
        )}
        <ChartTooltip />
        {keys.length > 1 && <ChartLegend />}
        {keys.map((k, i) => (
          <Bar key={k} dataKey={k} fill={`var(--color-${k})`} radius={stacked ? (i === keys.length - 1 ? [6, 6, 0, 0] : 0) : 6} stackId={stacked ? 'a' : undefined} />
        ))}
      </BarChart>
    </ChartContainer>
  )
}

const PALETTE = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', '#a78bfa', '#94a3b8']

export function Donut({ data, height = 220, centerLabel, format }: { data: Array<{ name: string; value: number }>; height?: number; centerLabel?: string; format?: (v: number) => string }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const config: ChartConfig = Object.fromEntries(data.map((d, i) => [d.name, { label: d.name, color: PALETTE[i % PALETTE.length]!, format }]))
  return (
    <div className="grid items-center gap-4 sm:grid-cols-[1fr_1fr]">
      <div className="relative">
        <ChartContainer config={config} height={height}>
          <PieChart>
            <ChartTooltip cursor={false} />
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={2} strokeWidth={0}>
              {data.map((d, i) => (
                <Cell key={d.name} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-xl font-bold tabular-nums">{format ? format(total) : compact(total)}</p>
            {centerLabel && <p className="text-[0.65rem] text-muted-foreground uppercase">{centerLabel}</p>}
          </div>
        </div>
      </div>
      <ul className="grid gap-2 text-sm">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="size-2.5 rounded-[3px]" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="flex-1 capitalize">{d.name}</span>
            <span className="font-semibold tabular-nums">{format ? format(d.value) : d.value.toLocaleString()}</span>
            <span className="w-10 text-right text-xs text-muted-foreground">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Conversion funnel: each stage's bar, count and drop-off from the previous stage. */
export function Funnel({ stages }: { stages: Array<{ stage: string; value: number }> }) {
  const top = stages[0]?.value || 1
  return (
    <div className="grid gap-3">
      {stages.map((s, i) => {
        const prev = i ? stages[i - 1]!.value : s.value
        const rate = prev ? (s.value / prev) * 100 : 0
        return (
          <div key={s.stage}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-medium">{s.stage}</span>
              <span className="tabular-nums">
                <span className="font-bold">{s.value.toLocaleString()}</span>
                {i > 0 && <span className="ml-2 text-xs text-muted-foreground">{rate.toFixed(1)}% of previous</span>}
              </span>
            </div>
            <div className="h-9 overflow-hidden rounded-xl bg-muted">
              <div
                className="h-full rounded-xl transition-all duration-700"
                style={{ width: `${Math.max(2, (s.value / top) * 100)}%`, background: `color-mix(in oklab, var(--chart-1) ${100 - i * 18}%, var(--chart-2))` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Day-of-week × hour heatmap of product views: when shoppers browse. */
export function Heatmap({ cells }: { cells: Array<{ dow: number; hour: number; views: number }> }) {
  const max = Math.max(1, ...cells.map((c) => c.views))
  const at = (dow: number, hour: number) => cells.find((c) => c.dow === dow && c.hour === hour)?.views ?? 0
  return (
    <div className="overflow-x-auto">
      <div className="inline-grid min-w-full grid-cols-[2.5rem_repeat(24,minmax(14px,1fr))] gap-[3px] text-[0.6rem] text-muted-foreground">
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="text-center">
            {h % 3 === 0 ? h : ''}
          </span>
        ))}
        {DAYS.map((d, i) => (
          <div key={d} className="contents">
            <span className="self-center">{d}</span>
            {Array.from({ length: 24 }, (_, h) => {
              const v = at(i + 1, h)
              return (
                <span
                  key={h}
                  title={`${d} ${h}:00 · ${v} views`}
                  className={cn('aspect-square rounded-[3px]', !v && 'bg-muted')}
                  style={v ? { background: `color-mix(in oklab, var(--chart-1) ${15 + (v / max) * 85}%, transparent)` } : undefined}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export const revenueSeries: ChartConfig = { revenue: { label: 'Revenue', color: 'var(--chart-1)', format: (v) => money(v, true) } }
