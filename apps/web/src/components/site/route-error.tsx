import { Link, useRouter } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { RefreshCw } from 'lucide-react'
import { Button } from '#/components/ui/button'

export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  const notFound = (error as { status?: number }).status === 404
  return (
    <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center px-6 py-20 text-center">
      <div>
        <p className="eyebrow">{notFound ? 'Not found' : 'Something went wrong'}</p>
        <h1 className="font-display mt-3 text-4xl font-semibold">{notFound ? 'This piece has moved on' : 'We hit a snag'}</h1>
        <p className="mt-3 text-muted-foreground">{notFound ? 'It may have sold out or been renamed.' : error instanceof Error ? error.message : 'Please try again.'}</p>
        <div className="mt-8 flex justify-center gap-3">
          {!notFound && (
            <Button
              variant="outline"
              onClick={() => {
                reset()
                void router.invalidate()
              }}
            >
              <RefreshCw /> Try again
            </Button>
          )}
          <Button asChild>
            <Link to="/shop">Browse the shop</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
