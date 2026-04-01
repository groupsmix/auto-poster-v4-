"use client";

import { useState, useCallback } from "react";

interface UseFormStateOptions<T> {
  initialValues: T;
  onSubmit: (values: T) => Promise<void>;
  onSuccess?: () => void;
}

interface UseFormStateResult<T> {
  values: T;
  saving: boolean;
  setValue: <K extends keyof T>(key: K, value: T[K]) => void;
  reset: () => void;
  handleSubmit: () => Promise<void>;
}

/**
 * Custom hook for managing form state with submit handling.
 * Reduces boilerplate across webhook, bundle, and pricing forms.
 */
export function useFormState<T extends Record<string, unknown>>(
  options: UseFormStateOptions<T>
): UseFormStateResult<T> {
  const [values, setValues] = useState<T>(options.initialValues);
  const [saving, setSaving] = useState(false);

  const setValue = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => {
    setValues(options.initialValues);
  }, [options.initialValues]);

  const handleSubmit = useCallback(async () => {
    setSaving(true);
    try {
      await options.onSubmit(values);
      reset();
      options.onSuccess?.();
    } finally {
      setSaving(false);
    }
  }, [values, options, reset]);

  return { values, saving, setValue, reset, handleSubmit };
}
