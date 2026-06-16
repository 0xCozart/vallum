# Next.js API Route Example

This example shows how a Next.js backend route can keep the Vallum app credential server-side while exposing safe reserve and execute endpoints to browser code.

The maintained `vallum-route.ts` file is framework-light: it uses the standard `Request` and `Response` APIs that Next.js route handlers support, and it injects an SDK-shaped server-owned client for deterministic tests. No real IOTA network, sponsor key, Docker service, or app API key is required for the example tests.

## App Router usage

Create one route file for reserve after copying both maintained helpers into a server-only helper path:

- `examples/nextjs-api-route/route.ts` -> `app/api/vallum/_lib/route.ts`
- `examples/node-backend/backend.ts` -> `app/api/vallum/_lib/backend.ts`

Those source files use repo-local imports so they can be tested in this monorepo. In an app, update the copied helper imports before running Next.js:

- in `vallum-route.ts`, import SDK types from `@vallum/sdk` and import `createVallumBackendHandlers` from `./backend.js`;
- in `vallum-backend.ts`, import SDK client/errors/types from `@vallum/sdk`; keep or replace the small policy reason-code allowlist with your installed Vallum shared type package if your app depends on it.

Then create the reserve route file:

```ts
// app/api/vallum/reserve/route.ts
import { createVallumClient } from "@vallum/sdk";
import { createVallumNextApiRoutes } from "../_lib/route.js";

const routes = createVallumNextApiRoutes({
  client: createVallumClient({
    baseUrl: process.env.VALLUM_GATEWAY_URL!,
    apiKey: process.env.VALLUM_DEMO_APP_KEY!,
  }),
});

export const POST = routes.reserve;
```

Create a second route file for execute:

```ts
// app/api/vallum/execute/route.ts
import { createVallumClient } from "@vallum/sdk";
import { createVallumNextApiRoutes } from "../_lib/route.js";

const routes = createVallumNextApiRoutes({
  client: createVallumClient({
    baseUrl: process.env.VALLUM_GATEWAY_URL!,
    apiKey: process.env.VALLUM_DEMO_APP_KEY!,
  }),
});

export const POST = routes.execute;
```

Your real app should keep `VALLUM_DEMO_APP_KEY` on the server. Browser callers send only transaction metadata, transaction bytes, and user signatures needed for the sponsorship flow.

## Safety behavior

The route helpers:

- accept only `POST` and return `Allow: POST` for other methods;
- require JSON requests with an `application/json` content type;
- reject malformed JSON, arrays, primitive request bodies, empty required strings, invalid numeric fields, and present-but-wrong-type optional fields before calling the SDK client;
- forward only the allowlisted SDK request fields;
- return only reservation IDs, optional sponsor address, execution digest, and sanitized error codes/messages;
- forward only known Vallum policy reason codes in error responses;
- omit app API keys, bearer tokens, raw upstream bodies, gas coin internals, transaction bytes, and user signatures from responses.

Run the example tests from the repo root:

```bash
node --import tsx --test examples/nextjs-api-route/route.test.ts
```

The root `npm test` command also includes checked example tests, and `npm run typecheck` includes `examples/**/*.ts`.
