"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import {
  predefinedTasksService,
  CompletionStatus,
  PredefinedTaskAssignment,
} from "@/services/predefined-tasks.service";

interface UseUpdateAssignmentStatusOptions {
  /** Appelé après une mise à jour réussie — usage typique : silentRefetch() */
  onSuccess?: (updated: PredefinedTaskAssignment) => void;
}

interface MutateArgs {
  assignmentId: string;
  status: CompletionStatus;
  reason?: string;
}

/**
 * Hook pour mettre à jour le statut d'une assignation de tâche prédéfinie.
 *
 * Gestion des toasts :
 * - 200 → "Statut mis à jour"
 * - 403 → "Permission refusée"
 * - 409 → "Transition invalide"
 * - 400 → message du backend
 * - autre → "Erreur lors de la mise à jour"
 */
export function useUpdateAssignmentStatus(
  options: UseUpdateAssignmentStatusOptions = {},
) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  async function mutate(args: MutateArgs): Promise<PredefinedTaskAssignment | undefined> {
    setIsPending(true);
    setError(null);

    try {
      const updated = await predefinedTasksService.updateCompletionStatus(
        args.assignmentId,
        { status: args.status, reason: args.reason },
      );

      toast.success("Statut mis à jour");
      options.onSuccess?.(updated);
      return updated;
    } catch (err: unknown) {
      const axiosError = err as {
        response?: { status?: number; data?: { message?: string | string[] } };
      };
      const status = axiosError?.response?.status;
      const backendMessage = axiosError?.response?.data?.message;

      if (status === 403) {
        toast.error("Permission refusée");
      } else if (status === 409) {
        toast.error("Transition invalide");
      } else if (status === 400 && backendMessage) {
        const msg = Array.isArray(backendMessage)
          ? backendMessage.join(", ")
          : backendMessage;
        toast.error(msg);
      } else {
        toast.error("Erreur lors de la mise à jour");
      }

      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      return undefined;
    } finally {
      setIsPending(false);
    }
  }

  return { mutate, isPending, error };
}
