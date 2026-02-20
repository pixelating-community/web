"use client";

import { useCallback, useEffect, useState } from "react";

type UseConfirmActionArgs = {
  enabled: boolean;
  onConfirm: () => void;
  resetKey?: string | number | boolean | null;
  timeoutMs?: number;
};

export const useConfirmAction = ({
  enabled,
  onConfirm,
  resetKey,
  timeoutMs = 2500,
}: UseConfirmActionArgs) => {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => {
      setArmed(false);
    }, timeoutMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [armed, timeoutMs]);

  useEffect(() => {
    if (!enabled) {
      setArmed(false);
    }
  }, [enabled]);

  useEffect(() => {
    setArmed(false);
  }, [resetKey]);

  const reset = useCallback(() => {
    setArmed(false);
  }, []);

  const trigger = useCallback(() => {
    if (!enabled) return false;
    if (!armed) {
      setArmed(true);
      return false;
    }
    setArmed(false);
    onConfirm();
    return true;
  }, [armed, enabled, onConfirm]);

  return {
    armed,
    reset,
    trigger,
  };
};
