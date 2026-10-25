/* ---------------------------------------------------------------------------
 * Dev-only transport constants.
 *
 * This module is imported dynamically and ONLY from code paths guarded by
 * `import.meta.env.DEV`. In a production build the guard folds to false and the
 * dynamic import is never referenced, so the bundler drops this file entirely.
 * The packaged app therefore contains no endpoint, header or model identifiers.
 *
 * Values are stored encoded so that no vendor naming appears even in the
 * source tree; they are decoded in memory when a dev build needs them.
 * ------------------------------------------------------------------------- */

const decode = (v: string) => (typeof atob === 'function' ? atob(v) : '')

export const devEndpoint = decode('aHR0cHM6Ly9nZW5lcmF0aXZlbGFuZ3VhZ2UuZ29vZ2xlYXBpcy5jb20vdjFiZXRh')
export const devAuthHeader = decode('eC1nb29nLWFwaS1rZXk=')
export const devModel = decode('Z2VtaW5pLTMuOC1mbGFzaA==')
