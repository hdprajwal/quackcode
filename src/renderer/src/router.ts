import { createRootRoute, createRoute, createRouter, createMemoryHistory } from '@tanstack/react-router'
import App from './App'
import { AppLayout } from './components/layout/AppLayout'
import { SettingsPage } from './pages/SettingsPage'

const rootRoute = createRootRoute({ component: App })

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: AppLayout
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage
})

const routeTree = rootRoute.addChildren([indexRoute, settingsRoute])

export const router = createRouter({
  routeTree,
  history: createMemoryHistory({ initialEntries: ['/'] })
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
