// Vitest stand-in for the `server-only` package.
//
// The real package unconditionally throws when imported outside Next.js's
// webpack build — Next aliases it away for server bundles via a special
// module condition that plain Node/Vitest doesn't apply. Route and lib
// modules import 'server-only' at the top of the file as a guard against
// being bundled into client code; under Vitest there is no bundler doing
// that separation, so the import should simply be a no-op.
export {};
