"use client";

/**
 * QueryProvider — global TanStack Query client for the Next.js App Router.
 *
 * Uses useState (not module scope) so each SSR request gets its own client
 * instance — no cache leak across requests in server-side rendering.
 *
 * Defaults:
 *   - staleTime: 30s — reduces redundant refetches on page navigation
 *   - retry: 1     — one retry on transient network errors
 */
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000, // 30 seconds
        retry: 1,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    // Server: always create a new client per request
    return makeQueryClient();
  }
  // Browser: reuse a singleton so the cache survives navigations
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  // useState ensures that if React Suspense re-renders this component,
  // the same client is reused rather than creating a new one mid-render.
  const [queryClient] = useState(getQueryClient);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
