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

test("generated postman requests keep importable non-empty string urls", () => {
  const smoke = readJson("./aqshara-smoke.postman_collection.json");
  const e2e = readJson("./aqshara-e2e.postman_collection.json");

  for (const item of [...flattenItems(smoke.item), ...flattenItems(e2e.item)]) {
    assert.equal(typeof item.request?.url, "string", `${item.name} should use string url`);
    assert.notEqual(item.request.url.trim(), "", `${item.name} should not have empty url`);
  }
});

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
    "01. Clerk - Resolve User By Email",
    "02. Clerk - Verify Password",
    "03. Clerk - Create Session",
    "04. Clerk - Create Token",
    "05. Session - Me",
    "06. Templates - List",
    "07. Webhook - Signed user.created",
    "09. Documents - Create",
    "15. Documents - Save Content",
    "16. AI - Generate Outline",
    "18. AI - Generate Proposal For Apply",
    "19. AI - Apply Proposal",
    "20. AI - Generate Proposal For Dismiss",
    "21. AI - Dismiss Proposal",
    "22. Sources - Create Upload URL",
    "23. Sources - Upload Sample PDF",
    "24. Sources - Register",
    "28. Exports - Preflight",
    "29. Exports - Queue DOCX Export",
    "32. Exports - Download If Ready",
    "36. Cleanup - Delete Primary Document",
  ]) {
    assert.ok(names.has(requiredName), `missing request ${requiredName}`);
  }
});

test("postman environment exposes required credentials and runtime variables", () => {
  const environment = readJson("./aqshara-local.postman_environment.json");
  const keys = new Set((environment.values ?? []).map((entry) => entry.key));

  for (const requiredKey of [
    "base_url",
    "clerk_api_url",
    "clerk_secret_key",
    "clerk_email",
    "clerk_password",
    "clerk_jwt_template",
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

  for (const removedKey of [
    "clerk_frontend_api_url",
    "clerk_sign_in_id",
  ]) {
    assert.ok(!keys.has(removedKey), `unexpected legacy Clerk login variable ${removedKey}`);
  }
});

test("e2e collection uses Clerk backend api login instead of Clerk frontend api login", () => {
  const e2e = readJson("./aqshara-e2e.postman_collection.json");
  const urls = flattenItems(e2e.item).map(requestUrl);

  assert.ok(
    !urls.some((url) => url.includes("clerk_frontend_api_url")),
    "e2e collection should not call Clerk Frontend API from Postman",
  );
  assert.ok(
    urls.some((url) => url.includes("clerk_api_url")),
    "e2e collection should call Clerk Backend API from Postman",
  );
});
