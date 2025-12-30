'use client';

import { useState } from 'react';
import { DateConflict, formatConflictMessage } from '@/utils/dependencyValidation';

interface DependencyValidationBannerProps {
  conflicts: DateConflict[];
  onDismiss?: () => void;
  compact?: boolean;
}

export function DependencyValidationBanner({
  conflicts,
  onDismiss,
  compact = false,
}: DependencyValidationBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (conflicts.length === 0) {
    return null;
  }

  const displayedConflicts = isExpanded ? conflicts : conflicts.slice(0, 2);
  const hasMore = conflicts.length > 2;

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
        <svg
          className="w-4 h-4 text-amber-600 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span className="text-sm text-amber-800">
          {conflicts.length} conflit{conflicts.length > 1 ? 's' : ''} de dates
        </span>
      </div>
    );
  }

  return (
    <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="flex items-start gap-3">
        <svg
          className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>

        <div className="flex-1">
          <h4 className="text-sm font-medium text-amber-800 mb-2">
            Attention : incoherences de dates detectees
          </h4>

          <ul className="space-y-1">
            {displayedConflicts.map((conflict) => (
              <li
                key={conflict.dependencyTaskId}
                className="text-sm text-amber-700"
              >
                {formatConflictMessage(conflict)}
              </li>
            ))}
          </ul>

          {hasMore && !isExpanded && (
            <button
              onClick={() => setIsExpanded(true)}
              className="mt-2 text-sm text-amber-600 hover:text-amber-800 font-medium"
            >
              Voir {conflicts.length - 2} autre{conflicts.length - 2 > 1 ? 's' : ''} conflit{conflicts.length - 2 > 1 ? 's' : ''}
            </button>
          )}

          {isExpanded && hasMore && (
            <button
              onClick={() => setIsExpanded(false)}
              className="mt-2 text-sm text-amber-600 hover:text-amber-800 font-medium"
            >
              Reduire
            </button>
          )}
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-amber-500 hover:text-amber-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
