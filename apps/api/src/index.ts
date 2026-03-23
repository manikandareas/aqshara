import { serve } from "@hono/node-server";
import app from "./app.js";

const port = Number(process.env.API_PORT ?? 3002);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Aqshara API listening on http://localhost:${info.port}`);
  },
);
