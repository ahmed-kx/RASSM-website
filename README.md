# RASSM

E-commerce website of RASSM, an Algerian streetwear brand. pnpm monorepo:

- `frontend/`: the website (Next.js), see `frontend/.env.example`
- `backend/`: the API (Express + MongoDB), see [`backend/README.md`](backend/README.md)
- `shared/`: Zod schemas, types and helpers used by both, see [`shared/README.md`](shared/README.md)

## Quick start

```bash
pnpm install
cp backend/.env.example backend/.env    # fill in MONGODB_URI (MongoDB Atlas)
cp frontend/.env.example frontend/.env.local
pnpm seed                               # products + delivery fees into MongoDB
pnpm dev                                # http://localhost:3000 (site) + http://localhost:4000 (API)
```

Other commands (from the root): `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format`.
Project rules and architecture: [`CLAUDE.md`](CLAUDE.md).
