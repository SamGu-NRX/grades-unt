# UNT Grade Distribution

Next.js app for browsing UNT grade distributions by course and instructor.

## Data model at runtime

The public app uses encrypted static files served from `public/encrypted/`:

- `manifest.json` contains searchable course/instructor metadata and blob IDs.
- `blobs/*.bin` contains AES-GCM encrypted course payloads.
- `blobs/*.meta.json` contains the IV, salt, and PBKDF2 settings for each blob.
- `src/lib/encryptedData.ts` loads the manifest, fetches the selected blob, derives a key with WebCrypto, decrypts the payload, and returns typed course/section data.

Prisma/Postgres is still supported for data import, migrations, validation, and backend/API compatibility routes, but normal user-facing course and instructor page reads should stay on the encrypted static-data path.

## MCP server

The Vercel deployment exposes a read-only Streamable HTTP MCP endpoint at `https://untgrades.app/api/mcp`. Configure this URL as a remote MCP server in your client's MCP settings. The endpoint reads the deployed encrypted data and uses `NEXT_PUBLIC_DATA_KEY`, the same value used to encrypt the files.

Set `NEXT_PUBLIC_DATA_KEY` in the Vercel project to the value used for the deployed data, then redeploy the app. The endpoint provides these tools:

- `search_grades` accepts a `query` with at least two characters and returns matching courses and instructors.
- `get_course_grades` accepts a course `prefix` and `number`. Optional `offset` and `limit` fields page through sections. The default page size is 25, and the maximum is 50.
- `get_instructor_courses` accepts an exact `firstName` and `lastName`. Optional `offset` and `limit` fields page through that instructor's courses. The default page size is 25, and the maximum is 50.

Course results include section grade counts, aggregate counts, and GPA. GPA uses A through F grades. MCP clients send Streamable HTTP requests with POST.

Approved browser apps can call `/api/mcp` directly, so requests use each student's client-IP quota instead of one shared app-server quota. `MCP_CORS_ORIGINS` defaults to `https://untangleapp.vercel.app` (UNTangle). Browser clients must omit credentials.

To change browser access, set `MCP_CORS_ORIGINS` to comma-separated exact origins, such as `https://untangleapp.vercel.app,http://localhost:3000`, or `*` to allow any site. Origins include the scheme and optional port, with no path or trailing slash. Whitespace around entries is ignored. An explicit empty value disables browser CORS. Disallowed origins receive the same HTTP status without access-control headers. CORS is not authentication, and non-browser clients can still call the endpoint.

Preflight requests return 204 without consuming quota. Browser clients can read `MCP-Session-Id`, `Retry-After`, and `X-RateLimit-Remaining` from actual responses, including errors. This policy applies only to `/api/mcp`; extension origin validation and other API CORS policies are unchanged.

## Request protection

Website manifest/blob reads, compatibility APIs, MCP transport, and search logging have shared IP-based minute/hour budgets. MCP continues to return useful numeric answers within its quota; over-limit requests return 429 with `Retry-After`. Website encryption does not make public data secret.

**Before deployment, configure the server-only shared Redis REST counter. Production fails closed with 503 if it is missing or unavailable.** See [RATE_LIMITS.md](RATE_LIMITS.md) for defaults, campus/NAT tradeoffs, trusted-IP requirements, caching behavior, and preview verification. No production service is provisioned by this change.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

If the encrypted blobs were generated with a data key, set the matching public key in `.env` for local development:

```bash
NEXT_PUBLIC_DATA_KEY="same-value-used-for-encryption"
```

## Validation commands

```bash
npm test
npx tsc --noEmit
DATABASE_URL="postgresql://user:***@localhost:5432/db" DIRECT_URL="postgresql://user:***@localhost:5432/db" npm run build
```

`npm run lint` may report existing lint debt unrelated to a focused change; do not hide that result in PR notes.

## Contribution workflow

Use branches, PRs, checks, and review:

1. Branch from `main`.
2. Make and test the change locally.
3. Commit with a conventional commit message.
4. Push the branch.
5. Open a PR into `main`.
6. Review CI/Vercel checks and address failures before merge.
