'use client';

import * as React from 'react';
import * as yup from 'yup';
import { toast } from 'sonner';

/**
 * Runs a Yup schema against a form's data before it reaches the server.
 *
 * This is a UX layer only — every field validated here is validated again,
 * independently, by the matching Zod schema in lib/validation/schemas.ts on
 * the server, which is the copy that actually decides whether data is
 * written. Client-side validation exists so a visitor sees "enter a valid
 * email" instantly instead of after a round trip, not to replace the check
 * that matters.
 *
 * One hook, reused across every form, rather than each form hand-rolling its
 * own submit-time validation:
 *
 *   const { errors, validate, clearError } = useClientValidation(loginSchema);
 *   <form onSubmit={(e) => { if (!validate(new FormData(e.currentTarget))) e.preventDefault(); }}>
 *     <Field error={errors.email ?? state.errors?.email}>
 *
 * Client errors are read first, server errors as the fallback — so a field
 * the client already flagged doesn't flash a different server-worded message
 * a moment later, but a rule only the server can check (a duplicate email,
 * an over-quota document) still surfaces once the round trip completes.
 */
export function useClientValidation<T extends yup.AnyObject>(schema: yup.ObjectSchema<T>) {
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const validate = React.useCallback(
    (input: FormData | Record<string, unknown>): boolean => {
      const data = input instanceof FormData ? Object.fromEntries(input.entries()) : input;

      try {
        schema.validateSync(data, { abortEarly: false, stripUnknown: true });
        setErrors({});
        return true;
      } catch (error) {
        if (error instanceof yup.ValidationError) {
          const next: Record<string, string> = {};
          for (const issue of error.inner.length ? error.inner : [error]) {
            const key = issue.path ?? '_form';
            // First message per field wins, same convention as
            // lib/validation/common.ts's fieldErrors() on the server side.
            if (!next[key]) next[key] = issue.message;
          }
          setErrors(next);
          // One toast per submit attempt, not per field — validate() only
          // runs on submit, never on keystroke, so this can't spam.
          toast.warning('Please fix the highlighted fields.');
          return false;
        }
        // Not a validation error — a bug in the schema itself. Fail open
        // rather than block every submission on a defect in the UX layer;
        // the server's own validation is still the real gate.
        console.error('[invora:validation] unexpected error from Yup schema', error);
        setErrors({});
        return true;
      }
    },
    [schema],
  );

  const clearError = React.useCallback((field: string) => {
    setErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }, []);

  return { errors, validate, clearError };
}
