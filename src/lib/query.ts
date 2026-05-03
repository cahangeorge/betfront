// Minimal TanStack Query-compatible shim, just enough for ported components.
// Drop-in for: useQuery, useMutation, useQueryClient.
// No provider needed — uses a module-level cache + event bus.
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

type QueryKey = ReadonlyArray<unknown>;

interface CacheEntry {
  data: unknown;
  error: unknown;
  updatedAt: number;
  promise: Promise<unknown> | null;
}

const cache = new Map<string, CacheEntry>();
const subs = new Map<string, Set<() => void>>();

function keyOf(key: QueryKey): string {
  return JSON.stringify(key);
}

function notify(k: string) {
  const set = subs.get(k);
  if (set) for (const fn of set) fn();
}

function subscribe(k: string, fn: () => void): () => void {
  let set = subs.get(k);
  if (!set) {
    set = new Set();
    subs.set(k, set);
  }
  set.add(fn);
  return () => {
    set!.delete(fn);
    if (set!.size === 0) subs.delete(k);
  };
}

export interface UseQueryOptions<T> {
  queryKey: QueryKey;
  queryFn: () => Promise<T> | T;
  enabled?: boolean;
  staleTime?: number;
  refetchOnWindowFocus?: boolean;
  refetchInterval?:
    | number
    | false
    | ((q: { state: { data: T | undefined } }) => number | false);
  initialData?: T;
}

export interface UseQueryResult<T> {
  data: T | undefined;
  error: unknown;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  isSuccess: boolean;
  refetch: () => Promise<T | undefined>;
}

let inflightFetches = new Map<string, Promise<unknown>>();

export function useQuery<T>(opts: UseQueryOptions<T>): UseQueryResult<T> {
  const { queryKey, queryFn, enabled = true, staleTime = 0, initialData } = opts;
  const k = keyOf(queryKey);
  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;

  const [, force] = useReducer((n: number) => n + 1, 0);

  // Seed cache with initialData if absent.
  if (initialData !== undefined && !cache.has(k)) {
    cache.set(k, { data: initialData, error: null, updatedAt: Date.now(), promise: null });
  }

  useEffect(() => {
    return subscribe(k, () => force());
  }, [k]);

  const fetch = useCallback(
    async (force_: boolean): Promise<T | undefined> => {
      const entry = cache.get(k);
      if (!force_ && entry && Date.now() - entry.updatedAt < staleTime) {
        return entry.data as T;
      }

      const inflight = inflightFetches.get(k);
      if (inflight) return inflight as Promise<T>;

      const promise = (async () => {
        try {
          const data = await queryFnRef.current();
          cache.set(k, { data, error: null, updatedAt: Date.now(), promise: null });
          notify(k);
          return data;
        } catch (error) {
          const prev = cache.get(k);
          cache.set(k, {
            data: prev?.data,
            error,
            updatedAt: Date.now(),
            promise: null,
          });
          notify(k);
          throw error;
        } finally {
          inflightFetches.delete(k);
        }
      })();
      inflightFetches.set(k, promise);
      cache.set(k, {
        data: entry?.data,
        error: entry?.error ?? null,
        updatedAt: entry?.updatedAt ?? 0,
        promise,
      });
      notify(k);
      return promise as Promise<T>;
    },
    [k, staleTime],
  );

  useEffect(() => {
    if (!enabled) return;
    const entry = cache.get(k);
    if (!entry || (staleTime === 0 || Date.now() - entry.updatedAt >= staleTime)) {
      void fetch(false).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, enabled]);

  // Polling
  const refetchInterval = opts.refetchInterval;
  useEffect(() => {
    if (!enabled || refetchInterval == null || refetchInterval === false) return;
    let cancelled = false;
    function schedule(delay: number) {
      const id = window.setTimeout(async () => {
        if (cancelled) return;
        try {
          await fetch(true);
        } catch {}
        if (cancelled) return;
        const next =
          typeof refetchInterval === 'function'
            ? refetchInterval({ state: { data: cache.get(k)?.data as T | undefined } })
            : (refetchInterval as number);
        if (next && next > 0) schedule(next);
      }, delay);
      return id;
    }
    const initial =
      typeof refetchInterval === 'function'
        ? refetchInterval({ state: { data: cache.get(k)?.data as T | undefined } })
        : refetchInterval;
    if (initial && initial > 0) schedule(initial);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, enabled, refetchInterval]);

  const entry = cache.get(k);
  const isFetching = !!entry?.promise;
  const data = entry?.data as T | undefined;
  const error = entry?.error;
  const isError = !!error && data === undefined;
  return {
    data,
    error,
    isLoading: enabled && data === undefined && !error,
    isFetching,
    isError,
    isSuccess: data !== undefined && !error,
    refetch: () => fetch(true).catch(() => undefined as T | undefined),
  };
}

export interface UseMutationOptions<TData, TVars> {
  mutationFn: (vars: TVars) => Promise<TData> | TData;
  onSuccess?: (data: TData, vars: TVars) => void | Promise<void>;
  onError?: (error: unknown, vars: TVars) => void | Promise<void>;
  onSettled?: (data: TData | undefined, error: unknown, vars: TVars) => void | Promise<void>;
}

export interface UseMutationResult<TData, TVars> {
  mutate: (vars?: TVars) => void;
  mutateAsync: (vars?: TVars) => Promise<TData>;
  isPending: boolean;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  data: TData | undefined;
  error: unknown;
  reset: () => void;
}

export function useMutation<TData = unknown, TVars = void>(
  opts: UseMutationOptions<TData, TVars>,
): UseMutationResult<TData, TVars> {
  const [state, setState] = useState<{
    isPending: boolean;
    data: TData | undefined;
    error: unknown;
  }>({ isPending: false, data: undefined, error: null });
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const mutateAsync = useCallback(async (vars?: TVars): Promise<TData> => {
    setState({ isPending: true, data: undefined, error: null });
    try {
      const data = await optsRef.current.mutationFn(vars as TVars);
      setState({ isPending: false, data, error: null });
      try {
        await optsRef.current.onSuccess?.(data, vars as TVars);
      } catch {}
      try {
        await optsRef.current.onSettled?.(data, null, vars as TVars);
      } catch {}
      return data;
    } catch (error) {
      setState({ isPending: false, data: undefined, error });
      try {
        await optsRef.current.onError?.(error, vars as TVars);
      } catch {}
      try {
        await optsRef.current.onSettled?.(undefined, error, vars as TVars);
      } catch {}
      throw error;
    }
  }, []);

  const mutate = useCallback((vars?: TVars) => {
    void mutateAsync(vars).catch((error) => {
      console.error('[query] useMutation mutate failed:', error);
    });
  }, [mutateAsync]);

  const reset = useCallback(() => {
    setState({ isPending: false, data: undefined, error: null });
  }, []);

  return {
    mutate,
    mutateAsync,
    isPending: state.isPending,
    isLoading: state.isPending,
    isError: !!state.error,
    isSuccess: !state.isPending && state.data !== undefined,
    data: state.data,
    error: state.error,
    reset,
  };
}

export interface QueryClientShim {
  invalidateQueries: (filter: { queryKey: QueryKey; exact?: boolean }) => void;
  setQueryData: <T>(queryKey: QueryKey, updater: T | ((prev: T | undefined) => T)) => void;
  getQueryData: <T>(queryKey: QueryKey) => T | undefined;
}

const client: QueryClientShim = {
  invalidateQueries({ queryKey, exact }) {
    const target = keyOf(queryKey);
    for (const k of Array.from(cache.keys())) {
      const matches = exact ? k === target : k.startsWith(target);
      if (matches) {
        const entry = cache.get(k)!;
        cache.set(k, { ...entry, updatedAt: 0 });
        notify(k);
      }
    }
  },
  setQueryData(queryKey, updater) {
    const k = keyOf(queryKey);
    const entry = cache.get(k);
    const prev = entry?.data;
    const next =
      typeof updater === 'function' ? (updater as (p: unknown) => unknown)(prev) : updater;
    cache.set(k, { data: next, error: null, updatedAt: Date.now(), promise: null });
    notify(k);
  },
  getQueryData(queryKey) {
    return cache.get(keyOf(queryKey))?.data as never;
  },
};

export function useQueryClient(): QueryClientShim {
  return client;
}
