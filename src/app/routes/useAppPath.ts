import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { isKnownAppPathname } from './app.routes'

type AppPathValue = {
  pathname: string
  search: string
  navigate: (path: string, options?: { replace?: boolean }) => void
}

const AppPathContext = createContext<AppPathValue | null>(null)

function resolvePathname(path: string): string {
  if (isKnownAppPathname(path)) {
    return path
  }

  return '/'
}

function readWindowPath(): string {
  return resolvePathname(window.location.pathname)
}

function pathParts(path: string): { pathname: string; href: string } {
  const queryIndex = path.indexOf('?')
  if (queryIndex < 0) {
    return { pathname: path, href: path }
  }

  return {
    pathname: path.slice(0, queryIndex),
    href: path,
  }
}

export function AppPathProvider({ children }: { children: ReactNode }) {
  const [pathname, setPathname] = useState(readWindowPath)
  const [search, setSearch] = useState(() => window.location.search)

  useEffect(() => {
    const onPopState = () => {
      setPathname(readWindowPath())
      setSearch(window.location.search)
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = useCallback((path: string, options?: { replace?: boolean }) => {
    const parts = pathParts(path)
    const nextPath = resolvePathname(parts.pathname)
    const href =
      nextPath === parts.pathname
        ? parts.href.startsWith(nextPath)
          ? parts.href
          : nextPath
        : nextPath

    if (options?.replace) {
      window.history.replaceState({}, '', href)
    } else {
      window.history.pushState({}, '', href)
    }
    setPathname(nextPath)
    setSearch(href.includes('?') ? href.slice(href.indexOf('?')) : '')
  }, [])

  const value = useMemo(
    () => ({
      pathname,
      search,
      navigate,
    }),
    [navigate, pathname, search],
  )

  return createElement(AppPathContext.Provider, { value }, children)
}

export function useAppPath() {
  const value = useContext(AppPathContext)

  if (!value) {
    throw new Error('useAppPath must be used within AppPathProvider')
  }

  return value
}
