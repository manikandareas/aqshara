import { loadWorkspaceEnv } from "@aqshara/config/load-env";
loadWorkspaceEnv();

import { serve } from "@hono/node-server";

async function main() {
  const { default: app } = await import("./app-instance.js");

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
}

main();
