// Secrets and local-only vars. They are not in wrangler.jsonc, so declare them here.
// Production: `wrangler secret put SESSION_SECRET`. Local: .dev.vars (see .dev.vars.example).
declare namespace Cloudflare {
  interface Env {
    SESSION_SECRET: string;
    /** "true" enables the fake sign-in routes. Only ever set in .dev.vars. */
    DEV_AUTH: string;
  }
}
