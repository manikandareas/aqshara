import { loadWorkspaceEnv } from "@aqshara/config/load-env";
import { serve } from "@hono/node-server";
import app from "./app-instance.js";

loadWorkspaceEnv();

const port = Number(process.env.API_PORT ?? 9000);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Aqshara API listening on http://localhost:${info.port}`);
  },
);
