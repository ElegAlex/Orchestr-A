"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import {
  predefinedTasksService,
  GenerateBalancedDto,
  BalancerResult,
} from "@/services/predefined-tasks.service";

interface UsePlanningBalancerOptions {
  onApplied?: () => void;
}

interface AxiosError {
  response?: {
    status?: number;
    data?: { message?: string };
  };
}

function isAxiosError(err: unknown): err is AxiosError {
  return typeof err === "object" && err !== null && "response" in err;
}

export function usePlanningBalancer(options?: UsePlanningBalancerOptions) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleError = (err: unknown) => {
    if (isAxiosError(err)) {
      const status = err.response?.status;
      if (status === 403) {
        toast.error("Permission refusée");
        return;
      }
      if (status === 400) {
        const msg = err.response?.data?.message ?? "Erreur lors de la génération";
        toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
        return;
      }
    }
    toast.error("Erreur lors de la génération");
  };

  const preview = async (
    args: GenerateBalancedDto,
  ): Promise<BalancerResult | undefined> => {
    setIsPending(true);
    setError(null);
    try {
      const result = await predefinedTasksService.generateBalanced({
        ...args,
        mode: "preview",
      });
      return result;
    } catch (err) {
      handleError(err);
      setError("preview failed");
      return undefined;
    } finally {
      setIsPending(false);
    }
  };

  const apply = async (
    args: GenerateBalancedDto,
  ): Promise<BalancerResult | undefined> => {
    setIsPending(true);
    setError(null);
    try {
      const result = await predefinedTasksService.generateBalanced({
        ...args,
        mode: "apply",
      });
      const count = result.assignmentsCreated;
      if (count === 0) {
        toast.success("Aucune nouvelle assignation (plage déjà couverte)");
      } else {
        toast.success(`${count} assignation(s) créée(s)`);
      }
      options?.onApplied?.();
      return result;
    } catch (err) {
      handleError(err);
      setError("apply failed");
      return undefined;
    } finally {
      setIsPending(false);
    }
  };

  return {
    preview,
    apply,
    isPending,
    error,
  };
}
