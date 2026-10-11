// The one Node API a client test uses (design-tokens.test.tsx reads styles.css from disk). Declared here rather than
// adding Node's types to the client tsconfig, which would let browser code use Node APIs without a type error.
declare module "node:fs" {
  export function readFileSync(path: string, encoding: "utf8"): string;
}
