'use client';

import * as React from 'react';
import { useFormStatus } from 'react-dom';
import { Button, type ButtonProps } from '@/components/ui/button';

/**
 * A submit button for a plain `<form action={serverAction}>` with no other
 * client state. `useFormStatus` only reports `pending` inside a descendant of
 * the form it belongs to, which is why the page rendering the form can't just
 * pass a `loading` prop itself — this wrapper is that descendant.
 */
export const SubmitButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, ...props }, ref) => {
    const { pending } = useFormStatus();
    return (
      <Button ref={ref} type="submit" loading={pending} {...props}>
        {children}
      </Button>
    );
  },
);
SubmitButton.displayName = 'SubmitButton';
