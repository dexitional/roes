import { Avatar as AvatarPrimitive, Checkbox as CheckboxPrimitive, Separator as SeparatorPrimitive, Slider as SliderPrimitive, Switch as SwitchPrimitive } from 'radix-ui'
import { Check } from 'lucide-react'
import { cn } from '@roes/ui'

export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('skeleton rounded-lg', className)} {...props} />
}

export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('rounded-2xl border bg-card text-card-foreground elevated', className)} {...props} />
}
export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-wrap items-start justify-between gap-3 px-5 pt-5', className)} {...props} />
}
export function CardTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return <h3 className={cn('font-semibold tracking-tight', className)} {...props} />
}
export function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />
}
export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('p-5', className)} {...props} />
}

const tones = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-info/12 text-info',
  warning: 'bg-warning/18 text-[color-mix(in_oklab,var(--warning)_55%,var(--foreground))]',
  success: 'bg-success/14 text-success',
  danger: 'bg-destructive/12 text-destructive',
  gold: 'bg-gold-soft text-[color-mix(in_oklab,var(--gold)_70%,var(--foreground))]',
  primary: 'bg-primary/10 text-primary',
  solid: 'bg-primary text-primary-foreground',
} as const
export type Tone = keyof typeof tones

export function Badge({ tone = 'neutral', className, dot, ...props }: React.ComponentProps<'span'> & { tone?: Tone; dot?: boolean }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold whitespace-nowrap', tones[tone], className)}
      {...props}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {props.children}
    </span>
  )
}

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent bg-input transition-colors outline-none focus-visible:ring-4 focus-visible:ring-ring/20 disabled:opacity-50 data-[state=checked]:bg-primary',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-5 rounded-full bg-white shadow-md ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" />
    </SwitchPrimitive.Root>
  )
}

export function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'peer grid size-[18px] shrink-0 place-items-center rounded-[5px] border border-input bg-card shadow-xs outline-none transition-colors focus-visible:ring-4 focus-visible:ring-ring/20 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="size-3.5" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export function Slider({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const count = (props.value ?? props.defaultValue ?? [0]).length
  return (
    <SliderPrimitive.Root className={cn('relative flex w-full touch-none items-center select-none py-2', className)} {...props}>
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      {Array.from({ length: count }, (_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          className="block size-5 rounded-full border-2 border-primary bg-card shadow-md transition-transform outline-none hover:scale-110 focus-visible:ring-4 focus-visible:ring-ring/25"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export function Separator({ className, orientation = 'horizontal', ...props }: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      orientation={orientation}
      className={cn('shrink-0 bg-border', orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px', className)}
      {...props}
    />
  )
}

export function Avatar({ src, name, className }: { src?: string | null; name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
  return (
    <AvatarPrimitive.Root className={cn('relative flex size-9 shrink-0 overflow-hidden rounded-full bg-accent', className)}>
      {src && <AvatarPrimitive.Image src={src} alt={name} referrerPolicy="no-referrer" className="aspect-square size-full object-cover" />}
      <AvatarPrimitive.Fallback className="grid size-full place-items-center text-xs font-bold text-accent-foreground">{initials}</AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  )
}

export function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
  return <kbd className={cn('rounded-md border bg-muted px-1.5 py-0.5 font-sans text-[0.65rem] font-semibold text-muted-foreground', className)} {...props} />
}
