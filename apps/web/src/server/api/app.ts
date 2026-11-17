// The Hono app, mounted at /api/* by routes/api/$.ts (which strips the prefix).
import { Hono } from 'hono'
import { errorHandler } from './lib/errors'
import { accountRoute } from './modules/account'
import { adminCatalogRoute } from './modules/admin-catalog'
import { adminContentRoute } from './modules/admin-content'
import { adminInsightsRoute } from './modules/admin-insights'
import { adminSalesRoute } from './modules/admin-sales'
import { authRoute } from './modules/auth'
import { paymentsRoute } from './modules/payments'
import { storeRoute } from './modules/store'

const app = new Hono()

app.onError(errorHandler)
app.get('/health', (c) => c.json({ ok: true }))

app.route('/auth', authRoute)
app.route('/store', storeRoute)
app.route('/me', accountRoute)
app.route('/payments', paymentsRoute)
app.route('/admin', adminInsightsRoute)
app.route('/admin', adminCatalogRoute)
app.route('/admin', adminSalesRoute)
app.route('/admin', adminContentRoute)

app.notFound((c) => c.json({ error: 'Not found' }, 404))

export { app as apiApp }
