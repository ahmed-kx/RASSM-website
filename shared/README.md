# @rassm/shared

The data contract shared by `frontend/` and `backend/`: Zod schemas, inferred types,
constants (wilayas), helpers (`formatPrice`, delivery fee and discount calculation,
collection filters) and the API request / response shapes (`API_PATHS`,
`orderRequestSchema`, `placedOrderSchema`, `apiErrorSchema`…).

- `@rassm/shared`: schemas, types, constants, helpers
- `@rassm/shared/mocks`: mock products and Anderson delivery fees, parsed through the
  schemas when the module loads (any mismatch throws). Used by the seed script and the
  tests only; the website reads the API.

The package ships TypeScript source (no build step). Next.js compiles it through
`transpilePackages`; the API runs it through `tsx`.
