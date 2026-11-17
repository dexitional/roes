// shadcn/ui-style chart primitives over Recharts: a config maps each series to
// a label and a theme colour, exposed as --color-<key> for the chart to use.
import { createContext, useContext, useId } from 'react'
import { Legend, ResponsiveContainer, Tooltip } from 'recharts'
import { cn } from '@roes/ui'

export type ChartConfig = Record<string, { label: string; color: string; format?: (v: number) => string }>

const ChartContext = createContext<ChartConfig>({})
export const useChartConfig = () => useContext(ChartContext)

export function ChartContainer({
  config,
  className,
  children,
  height = 280,
}: {
  config: ChartConfig
  className?: string
  children: React.ReactElement
  height?: number
}) {
  const id = useId().replace(/:/g, '')
  const vars = Object.entries(config)
    .map(([key, c]) => `--color-${key}: ${c.color};`)
    .join(' ')
  return (
    <ChartContext.Provider value={config}>
      <div
        data-chart={id}
        className={cn(
          'w-full text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/70 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted/60 [&_.recharts-surface]:outline-none [&_.recharts-sector]:outline-none',
          className,
        )}
        style={{ height }}
      >
        <style>{`[data-chart=${id}] { ${vars} }`}</style>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

interface TooltipPayload {
  dataKey?: string | number
  name?: string | number
  value?: number | string
  color?: string
  payload?: Record<string, unknown>
}

function TooltipBody({
  active,
  payload,
  label,
  labelFormatter,
}: {
  active?: boolean
  payload?: Array<TooltipPayload>
  label?: string | number
  labelFormatter?: (label: string | number) => React.ReactNode
}) {
  const config = useChartConfig()
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-40 rounded-xl border bg-popover/95 px-3 py-2.5 text-xs shadow-xl backdrop-blur">
      {label !== undefined && <div className="mb-1.5 font-semibold">{labelFormatter ? labelFormatter(label) : label}</div>}
      <div className="grid gap-1">
        {payload.map((item) => {
          const key = String(item.dataKey ?? item.name)
          const c = config[key]
          const value = Number(item.value ?? 0)
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="size-2.5 rounded-[3px]" style={{ background: item.color ?? c?.color }} />
              <span className="text-muted-foreground">{c?.label ?? item.name}</span>
              <span className="ml-auto pl-3 font-mono font-semibold tabular-nums">{c?.format ? c.format(value) : value.toLocaleString()}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ChartTooltip({ labelFormatter, cursor = true }: { labelFormatter?: (label: string | number) => React.ReactNode; cursor?: boolean }) {
  return <Tooltip cursor={cursor} content={(props) => <TooltipBody {...(props as object)} labelFormatter={labelFormatter} />} />
}

function LegendBody({ payload }: { payload?: Array<{ dataKey?: string | number; value?: string; color?: string }> }) {
  const config = useChartConfig()
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 pt-3">
      {payload?.map((item) => {
        const key = String(item.dataKey ?? item.value)
        return (
          <div key={key} className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2.5 rounded-[3px]" style={{ background: item.color }} />
            {config[key]?.label ?? item.value}
          </div>
        )
      })}
    </div>
  )
}

export function ChartLegend() {
  return <Legend content={(props) => <LegendBody {...(props as object)} />} />
}
