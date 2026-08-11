import { NextResponse } from 'next/server';

/**
 * A failure that a route handler can throw and have turned into a well-formed
 * JSON response with the right status code — so every API route in Invora
 * fails the same way.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  toResponse(): NextResponse {
    return NextResponse.json(
      { error: { code: this.code, message: this.message, details: this.details } },
      { status: this.status },
    );
  }
}

export const unauthorized = (message = 'You need to sign in to do that.') =>
  new ApiError(401, 'unauthorized', message);

export const forbidden = (message = 'You do not have access to this resource.') =>
  new ApiError(403, 'forbidden', message);

export const notFound = (message = 'Not found.') => new ApiError(404, 'not_found', message);

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, 'bad_request', message, details);

export const conflict = (message: string) => new ApiError(409, 'conflict', message);

export const payloadTooLarge = (message: string) => new ApiError(413, 'payload_too_large', message);

export const rateLimited = (retryAfterSeconds: number) =>
  new ApiError(429, 'rate_limited', 'Too many requests. Please slow down.', {
    retryAfterSeconds,
  });

export const paymentRequired = (message: string, details?: unknown) =>
  new ApiError(402, 'payment_required', message, details);

export const upstreamError = (message: string, details?: unknown) =>
  new ApiError(502, 'upstream_error', message, details);

/** Wraps a route handler so thrown ApiErrors become responses and nothing else leaks. */
export function withApiErrors<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ApiError) return error.toResponse();

      // Anything unexpected: log it server-side, tell the client nothing useful.
      console.error('[invora:api] unhandled error', error);
      return NextResponse.json(
        { error: { code: 'internal_error', message: 'Something went wrong on our side.' } },
        { status: 500 },
      );
    }
  };
}
