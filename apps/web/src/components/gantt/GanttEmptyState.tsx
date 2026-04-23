"use client";

interface GanttEmptyStateProps {
  message?: string;
}

export default function GanttEmptyState({ message }: GanttEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <svg
        className="mb-3 h-12 w-12 text-gray-300"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 6A2.25 2.25 0 0 1 6 3.75h12A2.25 2.25 0 0 1 20.25 6v12A2.25 2.25 0 0 1 18 20.25H6A2.25 2.25 0 0 1 3.75 18V6Z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75v16.5" />
      </svg>
      <p className="text-sm">{message ?? "Aucun élément à afficher"}</p>
    </div>
  );
}
