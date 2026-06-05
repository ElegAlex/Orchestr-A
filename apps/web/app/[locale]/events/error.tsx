"use client";

// OBS-018 — Next.js App Router error boundary for the /events route segment.
// Catches render-time errors and shows a user-facing fallback with a retry
// button rather than a blank page.

import { useEffect } from "react";
import { logger } from "@/lib/logger";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function EventsError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    logger.error("Events page render error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-full bg-red-100 p-4">
        <svg
          className="h-8 w-8 text-red-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
          />
        </svg>
      </div>
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          Une erreur est survenue
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          La page des événements n&apos;a pas pu se charger.
        </p>
      </div>
      <button
        onClick={reset}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
      >
        Réessayer
      </button>
    </div>
  );
}
