// Tiny URL-search helpers replacing TanStack Router's useSearch/useNavigate.
// Designed for Astro + React islands. SSR-safe.
import { useEffect, useState, useCallback } from 'react';

function readSearch(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

export function useUrlSearchParam(key: string, fallback = ''): [string, (v: string) => void] {
  const [value, setValue] = useState<string>(() => {
    if (typeof window === 'undefined') return fallback;
    return readSearch().get(key) ?? fallback;
  });

  useEffect(() => {
    function onPop() {
      setValue(readSearch().get(key) ?? fallback);
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [key, fallback]);

  const set = useCallback(
    (v: string) => {
      const params = readSearch();
      if (v === '' || v === fallback) params.delete(key);
      else params.set(key, v);
      const qs = params.toString();
      const url = window.location.pathname + (qs ? '?' + qs : '');
      window.history.replaceState(null, '', url);
      setValue(v);
    },
    [key, fallback],
  );

  return [value, set];
}

export function useUrlSearch<T extends Record<string, string>>(
  defaults: T,
): [T, (updater: Partial<T> | ((prev: T) => Partial<T>)) => void] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return { ...defaults };
    const params = readSearch();
    const next = { ...defaults };
    for (const k of Object.keys(defaults)) {
      const v = params.get(k);
      if (v !== null) (next as Record<string, string>)[k] = v;
    }
    return next;
  });

  useEffect(() => {
    function onPop() {
      const params = readSearch();
      const next = { ...defaults };
      for (const k of Object.keys(defaults)) {
        const v = params.get(k);
        if (v !== null) (next as Record<string, string>)[k] = v;
      }
      setState(next);
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [defaults]);

  const update = useCallback(
    (updater: Partial<T> | ((prev: T) => Partial<T>)) => {
      setState((prev) => {
        const patch = typeof updater === 'function' ? updater(prev) : updater;
        const next = { ...prev, ...patch } as T;
        const params = readSearch();
        for (const [k, v] of Object.entries(next)) {
          if (v == null || v === '' || v === defaults[k as keyof T]) params.delete(k);
          else params.set(k, String(v));
        }
        const qs = params.toString();
        const url = window.location.pathname + (qs ? '?' + qs : '');
        window.history.replaceState(null, '', url);
        return next;
      });
    },
    [defaults],
  );

  return [state, update];
}
