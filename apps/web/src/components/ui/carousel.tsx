// shadcn/ui-style carousel over Embla.
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import type { UseEmblaCarouselType } from 'embla-carousel-react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@roes/ui'

type Api = UseEmblaCarouselType[1]
type Options = Parameters<typeof useEmblaCarousel>[0]
type Plugins = Parameters<typeof useEmblaCarousel>[1]

interface Ctx {
  ref: UseEmblaCarouselType[0]
  api: Api
  canPrev: boolean
  canNext: boolean
  selected: number
  count: number
}
const CarouselContext = createContext<Ctx | null>(null)
export function useCarousel() {
  const ctx = useContext(CarouselContext)
  if (!ctx) throw new Error('useCarousel must be used inside <Carousel>')
  return ctx
}

export function Carousel({ opts, plugins, className, children, setApi }: { opts?: Options; plugins?: Plugins; className?: string; children: React.ReactNode; setApi?: (api: Api) => void }) {
  const [ref, api] = useEmblaCarousel(opts, plugins)
  const [state, setState] = useState({ canPrev: false, canNext: false, selected: 0, count: 0 })
  const update = useCallback((a: Api) => {
    if (!a) return
    setState({ canPrev: a.canScrollPrev(), canNext: a.canScrollNext(), selected: a.selectedScrollSnap(), count: a.scrollSnapList().length })
  }, [])
  useEffect(() => {
    if (!api) return
    setApi?.(api)
    update(api)
    api.on('select', update).on('reInit', update)
    return () => {
      api.off('select', update).off('reInit', update)
    }
  }, [api, update, setApi])
  return (
    <CarouselContext.Provider value={{ ref, api, ...state }}>
      <div
        className={cn('relative', className)}
        role="region"
        aria-roledescription="carousel"
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') api?.scrollPrev()
          if (e.key === 'ArrowRight') api?.scrollNext()
        }}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  )
}

export function CarouselContent({ className, ...props }: React.ComponentProps<'div'>) {
  const { ref } = useCarousel()
  return (
    <div ref={ref} className="overflow-hidden">
      <div className={cn('flex touch-pan-y', className)} {...props} />
    </div>
  )
}

export function CarouselItem({ className, ...props }: React.ComponentProps<'div'>) {
  return <div role="group" aria-roledescription="slide" className={cn('min-w-0 shrink-0 grow-0 basis-full', className)} {...props} />
}

export function CarouselPrevious({ className }: { className?: string }) {
  const { api, canPrev } = useCarousel()
  return (
    <button
      type="button"
      aria-label="Previous"
      disabled={!canPrev}
      onClick={() => api?.scrollPrev()}
      className={cn('grid size-10 place-items-center rounded-full border bg-card/90 shadow-md backdrop-blur transition hover:bg-card disabled:opacity-0', className)}
    >
      <ChevronLeft className="size-5" />
    </button>
  )
}

export function CarouselNext({ className }: { className?: string }) {
  const { api, canNext } = useCarousel()
  return (
    <button
      type="button"
      aria-label="Next"
      disabled={!canNext}
      onClick={() => api?.scrollNext()}
      className={cn('grid size-10 place-items-center rounded-full border bg-card/90 shadow-md backdrop-blur transition hover:bg-card disabled:opacity-0', className)}
    >
      <ChevronRight className="size-5" />
    </button>
  )
}

export function CarouselDots({ className }: { className?: string }) {
  const { api, selected, count } = useCarousel()
  if (count < 2) return null
  return (
    <div className={cn('flex items-center justify-center gap-2', className)}>
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`Go to slide ${i + 1}`}
          onClick={() => api?.scrollTo(i)}
          className={cn('h-1.5 rounded-full transition-all duration-300', i === selected ? 'w-7 bg-gold' : 'w-1.5 bg-white/60 hover:bg-white')}
        />
      ))}
    </div>
  )
}
