import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import app from "../src/app.js";

const outputDirectory = join(process.cwd(), "openapi");
const outputFile = join(outputDirectory, "openapi.json");

async function main() {
  const response = await app.request("http://localhost/openapi.json");
  const spec = await response.text();

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputFile, spec);

  console.log(`OpenAPI spec written to ${outputFile}`);
}

void main();
