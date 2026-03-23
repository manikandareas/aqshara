import assert from "node:assert/strict";
import { describe, it } from "node:test";
import app from "./app.js";

describe("api contract", () => {
  it("returns a healthy response from /health", async () => {
    const response = await app.request("http://localhost/health");
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.service, "api");
  });

  it("publishes an OpenAPI document", async () => {
    const response = await app.request("http://localhost/openapi.json");
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(typeof payload.openapi, "string");
    assert.equal(payload.info.title, "Aqshara API");
  });
});
