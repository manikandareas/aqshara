import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function readJson(path) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
}

function flattenItems(items, acc = []) {
  for (const item of items ?? []) {
    if (item.request) {
      acc.push(item);
    }

    if (item.item) {
      flattenItems(item.item, acc);
    }
  }

  return acc;
}

function requestUrl(item) {
  const rawUrl = item.request?.url;

  if (typeof rawUrl === "string") {
    return rawUrl;
  }

  return rawUrl?.raw ?? "";
}

test("postman collections cover all API routes and docs surfaces", () => {
  const smoke = readJson("./aqshara-smoke.postman_collection.json");
  const e2e = readJson("./aqshara-e2e.postman_collection.json");
  const openapi = JSON.parse(
    readFileSync(
      new URL("../apps/api/openapi/openapi.json", import.meta.url),
      "utf8",
    ),
  );

  const requests = [...flattenItems(smoke.item), ...flattenItems(e2e.item)];
  const urls = new Set(
    requests
      .map(requestUrl)
      .map((url) =>
        url
          .replace(/\{\{base_url\}\}/g, "")
          .replace(/https:\/\/[^/]+/g, "")
          .replace(/\{\{document_id_[^}]+\}\}/g, "{documentId}")
          .replace(/\{\{proposal_id_[^}]+\}\}/g, "{proposalId}")
          .replace(/\{\{export_id\}\}/g, "{exportId}")
          .replace(/\{\{source_id\}\}/g, "{sourceId}")
          .replace(/\?.*$/, ""),
      ),
  );

  for (const path of Object.keys(openapi.paths)) {
    assert.ok(urls.has(path), `missing Postman coverage for ${path}`);
  }

  for (const extraPath of ["/openapi.json", "/swagger", "/scalar", "/llms.txt"]) {
    assert.ok(urls.has(extraPath), `missing docs route ${extraPath}`);
  }
});

test("e2e collection contains stateful happy-path requests", () => {
  const e2e = readJson("./aqshara-e2e.postman_collection.json");
  const requests = flattenItems(e2e.item);
  const names = new Set(requests.map((item) => item.name));

  for (const requiredName of [
    "01. Clerk - Start Sign In",
    "02. Clerk - Attempt Password",
    "03. Clerk - Read Client Session",
    "04. Webhook - Signed user.created",
    "08. Documents - Create",
    "13. Documents - Save Content",
    "14. AI - Generate Outline",
    "16. AI - Generate Proposal For Apply",
    "17. AI - Apply Proposal",
    "18. AI - Generate Proposal For Dismiss",
    "19. AI - Dismiss Proposal",
    "20. Sources - Create Upload URL",
    "21. Sources - Upload Sample PDF",
    "22. Sources - Register",
    "26. Exports - Preflight",
    "27. Exports - Queue DOCX Export",
    "30. Exports - Download If Ready",
    "34. Cleanup - Delete Primary Document",
  ]) {
    assert.ok(names.has(requiredName), `missing request ${requiredName}`);
  }
});

test("postman environment exposes required credentials and runtime variables", () => {
  const environment = readJson("./aqshara-local.postman_environment.json");
  const keys = new Set((environment.values ?? []).map((entry) => entry.key));

  for (const requiredKey of [
    "base_url",
    "clerk_frontend_api_url",
    "clerk_email",
    "clerk_password",
    "clerk_webhook_signing_secret",
    "access_token",
    "user_id",
    "workspace_id",
    "document_id_primary",
    "document_id_bootstrap",
    "proposal_id_apply",
    "proposal_id_dismiss",
    "source_id",
    "storage_key",
    "export_id",
    "poll_max_attempts",
    "poll_delay_ms",
  ]) {
    assert.ok(keys.has(requiredKey), `missing environment variable ${requiredKey}`);
  }
});
