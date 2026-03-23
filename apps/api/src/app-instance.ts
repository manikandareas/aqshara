import { createApp } from "./app.js";
import { createProductionAppContext } from "./lib/app-context.js";

const app = createApp(createProductionAppContext());

export default app;
