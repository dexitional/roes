import { Link } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { Logo } from './logo'

export function NotFound() {
  return (
    <div className="grid min-h-[70vh] place-items-center px-6 py-16 text-center">
      <div>
        <Logo height={110} className="mx-auto" />
        <p className="eyebrow mt-6">Error 404</p>
        <h1 className="font-display mt-2 text-5xl font-semibold">This page slipped away</h1>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">The piece or page you’re looking for doesn’t exist, or it may have sold out.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild variant="outline">
            <Link to="/">Home</Link>
          </Button>
          <Button asChild>
            <Link to="/shop">Shop jewelry</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
