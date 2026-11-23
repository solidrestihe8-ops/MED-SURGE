# MED SURGE CBT

## Run locally

Requires Node.js 18 or newer.

```sh
npm start
```

Open the URL printed by the server, usually `http://localhost:3000`.

## Deploy on Vercel

Vercel serves the static site and the API handlers in `api/`. Quiz sessions are stored in Redis for 24 hours so they work across serverless function instances.

1. In Vercel, connect this repository and use the repository root as the project root. The framework preset can be **Other**; leave the build command and output directory blank.
2. Create an Upstash Redis database and connect it to the Vercel project, or add these environment variables in **Project Settings > Environment Variables**:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

   The `KV_REST_API_URL` and `KV_REST_API_TOKEN` names are also supported.
3. Add the variables to Production (and Preview if needed), then redeploy.
4. Open the Vercel deployment URL and check `/api/info`; it should return JSON containing the question count and topics.

The quiz setup page can load without Redis, but starting a quiz returns a clear configuration error until Redis is connected.
