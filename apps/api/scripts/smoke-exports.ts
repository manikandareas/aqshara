import { createProductionAppContext } from "../src/lib/app-context.js";

async function smokeExports() {
  const isProdOrStaging =
    process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging";
  const driverIsR2 = process.env.STORAGE_DRIVER === "r2";
  const { isR2ObjectStorageConfigured } = await import("@aqshara/storage");

  if ((isProdOrStaging || driverIsR2) && !isR2ObjectStorageConfigured()) {
    console.error("Storage not configured for production/staging/r2 driver.");
    process.exit(1);
  }

  const appCtx = createProductionAppContext();
  if (!appCtx.services.exports) {
    console.error("Exports service not initialized");
    process.exit(1);
  }

  console.log("Exports storage configuration looks safe");
  process.exit(0);
}

smokeExports().catch((e) => {
  console.error("Smoke check failed", e);
  process.exit(1);
});
