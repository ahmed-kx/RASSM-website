# @rassm/shared

The data contract shared by `frontend/` and `backend/`: Zod schemas, inferred types,
constants (wilayas) and small helpers (`formatPrice`).

- `@rassm/shared`: schemas, types, constants, helpers
- `@rassm/shared/mocks`: mock products and delivery fees, parsed through the schemas when
  the module loads (any mismatch throws)

The package ships TypeScript source (no build step). Next.js compiles it through
`transpilePackages`; the API will run it through its own TS tooling.
