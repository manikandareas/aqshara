import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const outputDir = __dirname;
const samplePdfPath = resolve(outputDir, "sample.pdf");
const samplePdfBuffer = readFileSync(samplePdfPath);
const samplePdfSha256 = createHash("sha256")
  .update(samplePdfBuffer)
  .digest("hex");

const schemaUrl =
  "https://schema.getpostman.com/json/collection/v2.1.0/collection.json";

function lines(source) {
  return source
    .trim()
    .split("\n")
    .map((line) => line.replace(/^\s{6}/, ""));
}

function event(listen, scriptSource) {
  return {
    listen,
    script: {
      type: "text/javascript",
      exec: Array.isArray(scriptSource) ? scriptSource : lines(scriptSource),
    },
  };
}

function jsonHeader() {
  return [
    {
      key: "Content-Type",
      value: "application/json",
      type: "text",
    },
  ];
}

function formHeader() {
  return [
    {
      key: "Content-Type",
      value: "application/x-www-form-urlencoded",
      type: "text",
    },
  ];
}

function clerkSecretHeaders(extra = []) {
  return [
    {
      key: "Authorization",
      value: "Bearer {{clerk_secret_key}}",
      type: "text",
    },
    ...extra,
  ];
}

function requestItem({
  name,
  method,
  url,
  auth,
  headers = [],
  body,
  prerequest,
  test,
  description,
}) {
  const item = {
    name,
    request: {
      method,
      header: headers,
      url,
    },
  };

  if (description) {
    item.request.description = description;
  }

  if (auth) {
    item.request.auth = auth;
  }

  if (body) {
    item.request.body = body;
  }

  const events = [];

  if (prerequest) {
    events.push(event("prerequest", prerequest));
  }

  if (test) {
    events.push(event("test", test));
  }

  if (events.length > 0) {
    item.event = events;
  }

  return item;
}

function folder(name, items) {
  return {
    name,
    item: items,
  };
}

const noauth = { type: "noauth" };
const bearerAuth = {
  type: "bearer",
  bearer: [
    {
      key: "token",
      value: "{{access_token}}",
      type: "string",
    },
  ],
};

const docsSmokeItems = [
  requestItem({
    name: "01. Public - Health",
    method: "GET",
    url: "{{base_url}}/health",
    auth: noauth,
    test: `
      pm.test("health returns 200", function () {
        pm.response.to.have.status(200);
      });
    `,
  }),
  requestItem({
    name: "02. Public - Readiness",
    method: "GET",
    url: "{{base_url}}/v1/system/readiness",
    auth: noauth,
    test: `
      pm.test("readiness returns 200 or 503", function () {
        pm.expect([200, 503]).to.include(pm.response.code);
      });
    `,
  }),
  requestItem({
    name: "03. Docs - OpenAPI JSON",
    method: "GET",
    url: "{{base_url}}/openapi.json",
    auth: noauth,
    test: `
      pm.test("openapi returns 200", function () {
        pm.response.to.have.status(200);
      });
    `,
  }),
  requestItem({
    name: "04. Docs - Swagger",
    method: "GET",
    url: "{{base_url}}/swagger",
    auth: noauth,
    test: `
      pm.test("swagger returns 200", function () {
        pm.response.to.have.status(200);
      });
    `,
  }),
  requestItem({
    name: "05. Docs - Scalar",
    method: "GET",
    url: "{{base_url}}/scalar",
    auth: noauth,
    test: `
      pm.test("scalar returns 200", function () {
        pm.response.to.have.status(200);
      });
    `,
  }),
  requestItem({
    name: "06. Docs - llms.txt",
    method: "GET",
    url: "{{base_url}}/llms.txt",
    auth: noauth,
    test: `
      pm.test("llms.txt returns 200", function () {
        pm.response.to.have.status(200);
      });
    `,
  }),
];

function unauthorizedProtectedItem(name, method, url, body) {
  return requestItem({
    name,
    method,
    url,
    auth: noauth,
    headers: body?.mode === "raw" ? jsonHeader() : [],
    body,
    test: `
      pm.test("protected route rejects missing auth", function () {
        pm.response.to.have.status(401);
      });
    `,
  });
}

const smokeCollection = {
  info: {
    _postman_id: "8c6e715e-e5cf-4ed3-b9ef-3ca1b6db0190",
    name: "Aqshara API Smoke",
    schema: schemaUrl,
    description:
      "Fast smoke checks for public/docs routes plus negative authorization and webhook verification checks.",
  },
  item: [
    folder("Public & Docs", docsSmokeItems),
    folder("Protected Negative", [
      unauthorizedProtectedItem(
        "07. Negative - Me Without Token",
        "GET",
        "{{base_url}}/v1/me",
      ),
      unauthorizedProtectedItem(
        "08. Negative - Documents List Without Token",
        "GET",
        "{{base_url}}/v1/documents",
      ),
      unauthorizedProtectedItem(
        "09. Negative - Get Document Without Token",
        "GET",
        "{{base_url}}/v1/documents/{{document_id_primary}}",
      ),
      unauthorizedProtectedItem(
        "10. Negative - Save Content Without Token",
        "PUT",
        "{{base_url}}/v1/documents/{{document_id_primary}}/content",
        {
          mode: "raw",
          raw: JSON.stringify(
            {
              contentJson: [],
              baseUpdatedAt: "2026-03-27T00:00:00.000Z",
            },
            null,
            2,
          ),
        },
      ),
      unauthorizedProtectedItem(
        "11. Negative - Bootstrap Without Token",
        "POST",
        "{{base_url}}/v1/documents/bootstrap",
        {
          mode: "raw",
          raw: JSON.stringify(
            {
              title: "Smoke Bootstrap",
              type: "general_paper",
              templateCode: "general_paper",
            },
            null,
            2,
          ),
        },
      ),
      unauthorizedProtectedItem(
        "12. Negative - Outline Generate Without Token",
        "POST",
        "{{base_url}}/v1/documents/{{document_id_primary}}/outline/generate",
        {
          mode: "raw",
          raw: JSON.stringify(
            {
              topic: "Smoke topic",
              idempotencyKey: "smoke-outline-noauth",
            },
            null,
            2,
          ),
        },
      ),
      unauthorizedProtectedItem(
        "13. Negative - Outline Apply Without Token",
        "POST",
        "{{base_url}}/v1/documents/{{document_id_primary}}/outline/apply",
        {
          mode: "raw",
          raw: JSON.stringify(
            {
              outline: {
                title: "Outline",
                nodes: [],
              },
              baseUpdatedAt: "2026-03-27T00:00:00.000Z",
            },
            null,
            2,
          ),
        },
      ),
      unauthorizedProtectedItem(
        "14. Negative - Generate Proposal Without Token",
        "POST",
        "{{base_url}}/v1/documents/{{document_id_primary}}/ai/proposals",
        {
          mode: "raw",
          raw: JSON.stringify(
            {
              action: "rewrite",
              targetBlockIds: ["smoke-block"],
              idempotencyKey: "smoke-proposal-noauth",
            },
            null,
            2,
          ),
        },
      ),
      unauthorizedProtectedItem(
        "15. Negative - Apply Proposal Without Token",
        "POST",
        "{{base_url}}/v1/ai/proposals/{{proposal_id_apply}}/apply",
        {
          mode: "raw",
          raw: JSON.stringify(
            {
              baseUpdatedAt: "2026-03-27T00:00:00.000Z",
              mode: "replace",
            },
            null,
            2,
          ),
        },
      ),
      unauthorizedProtectedItem(
        "16. Negative - Dismiss Proposal Without Token",
        "POST",
        "{{base_url}}/v1/ai/proposals/{{proposal_id_dismiss}}/dismiss",
        {
          mode: "raw",
          raw: "{}",
        },
      ),
      unauthorizedProtectedItem(
        "17. Negative - Export Preflight Without Token",
        "POST",
        "{{base_url}}/v1/documents/{{document_id_primary}}/exports/docx/preflight",
        {
          mode: "raw",
          raw: "{}",
        },
      ),
      unauthorizedProtectedItem(
        "18. Negative - Queue Export Without Token",
        "POST",
        "{{base_url}}/v1/documents/{{document_id_primary}}/exports/docx",
        {
          mode: "raw",
          raw: JSON.stringify(
            {
              idempotencyKey: "smoke-export-noauth",
            },
            null,
            2,
          ),
        },
      ),
      unauthorizedProtectedItem(
        "19. Negative - List Exports Without Token",
        "GET",
        "{{base_url}}/v1/exports",
      ),
      unauthorizedProtectedItem(
        "20. Negative - Get Export Without Token",
        "GET",
        "{{base_url}}/v1/exports/{{export_id}}",
      ),
      unauthorizedProtectedItem(
        "21. Negative - Retry Export Without Token",
        "POST",
        "{{base_url}}/v1/exports/{{export_id}}/retry",
        {
          mode: "raw",
          raw: "{}",
        },
      ),
      unauthorizedProtectedItem(
        "22. Negative - Download Export Without Token",
        "GET",
        "{{base_url}}/v1/exports/{{export_id}}/download",
      ),
      unauthorizedProtectedItem(
        "23. Negative - Upload URL Without Token",
        "POST",
        "{{base_url}}/v1/sources/upload-url",
        {
          mode: "raw",
          raw: "{}",
        },
      ),
      unauthorizedProtectedItem(
        "24. Negative - Register Source Without Token",
        "POST",
        "{{base_url}}/v1/sources/register",
        {
          mode: "raw",
          raw: JSON.stringify(
            {
              documentId: "{{document_id_primary}}",
              sourceId: "{{source_id}}",
              storageKey: "{{storage_key}}",
              originalFileName: "sample.pdf",
              fileSizeBytes: 0,
              checksum: "{{sample_pdf_sha256}}",
              mimeType: "application/pdf",
            },
            null,
            2,
          ),
        },
      ),
      unauthorizedProtectedItem(
        "25. Negative - List Sources Without Token",
        "GET",
        "{{base_url}}/v1/documents/{{document_id_primary}}/sources",
      ),
      unauthorizedProtectedItem(
        "26. Negative - Source Status Without Token",
        "GET",
        "{{base_url}}/v1/sources/{{source_id}}/status",
      ),
      unauthorizedProtectedItem(
        "27. Negative - Retry Source Without Token",
        "POST",
        "{{base_url}}/v1/sources/{{source_id}}/retry",
        {
          mode: "raw",
          raw: "{}",
        },
      ),
      unauthorizedProtectedItem(
        "28. Negative - Delete Source Without Token",
        "DELETE",
        "{{base_url}}/v1/sources/{{source_id}}",
      ),
    ]),
    folder("Webhook Negative", [
      requestItem({
        name: "29. Negative - Invalid Clerk Webhook",
        method: "POST",
        url: "{{base_url}}/webhooks/clerk",
        auth: noauth,
        headers: jsonHeader(),
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              type: "user.created",
              data: {
                id: "smoke-invalid-user",
              },
            },
            null,
            2,
          ),
        },
        prerequest: `
          pm.request.headers.upsert({ key: "svix-id", value: "smoke-invalid" });
          pm.request.headers.upsert({ key: "svix-timestamp", value: String(Math.floor(Date.now() / 1000)) });
          pm.request.headers.upsert({ key: "svix-signature", value: "v1,invalid" });
        `,
        test: `
          pm.test("invalid webhook is rejected", function () {
            pm.response.to.have.status(400);
          });
        `,
      }),
    ]),
  ],
};

const e2eCollection = {
  info: {
    _postman_id: "cd4182e4-5bbc-49de-a6a2-cfd8f5f4d2df",
    name: "Aqshara API E2E",
    schema: schemaUrl,
    description:
      "Stateful end-to-end sequence for Aqshara local API, Clerk auth, documents, AI, sources, exports, and cleanup.",
  },
  auth: bearerAuth,
  item: [
    folder("Auth & Webhook", [
      requestItem({
        name: "01. Clerk - Resolve User By Email",
        method: "GET",
        url: "{{clerk_api_url}}/users?email_address[]={{clerk_email}}&limit=1",
        prerequest: `
          ["clerk_api_url", "clerk_secret_key", "clerk_email", "clerk_password", "clerk_jwt_template"].forEach(function (key) {
            var value = (pm.environment.get(key) || "").trim();
            if (!value) {
              throw new Error(key + " environment variable is required for Clerk Postman login");
            }
          });
        `,
        auth: noauth,
        headers: clerkSecretHeaders(),
        test: `
          pm.test("clerk user lookup returns 200", function () {
            pm.response.to.have.status(200);
          });
          var users = pm.response.json();
          var user = Array.isArray(users) ? users[0] : null;
          pm.test("clerk user lookup returns a matching user", function () {
            pm.expect(user && user.id).to.not.eql(undefined);
          });
          pm.environment.set("clerk_user_id", user.id);
        `,
      }),
      requestItem({
        name: "02. Clerk - Verify Password",
        method: "POST",
        url: "{{clerk_api_url}}/users/{{clerk_user_id}}/verify_password",
        auth: noauth,
        headers: clerkSecretHeaders(jsonHeader()),
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              password: "{{clerk_password}}",
            },
            null,
            2,
          ),
        },
        test: `
          pm.test("clerk password verification returns 200", function () {
            pm.response.to.have.status(200);
          });
          var json = pm.response.json();
          pm.test("clerk password verification succeeds", function () {
            pm.expect(json.verified).to.eql(true);
          });
        `,
      }),
      requestItem({
        name: "03. Clerk - Create Session",
        method: "POST",
        url: "{{clerk_api_url}}/sessions",
        auth: noauth,
        headers: clerkSecretHeaders(jsonHeader()),
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              user_id: "{{clerk_user_id}}",
            },
            null,
            2,
          ),
        },
        test: `
          pm.test("clerk create session returns 200", function () {
            pm.response.to.have.status(200);
          });
          var json = pm.response.json();
          pm.test("clerk session id is present", function () {
            pm.expect(json.id).to.not.eql("");
          });
          pm.environment.set("clerk_session_id", json.id);
        `,
      }),
      requestItem({
        name: "04. Clerk - Create Token",
        method: "POST",
        url: "{{clerk_api_url}}/sessions/{{clerk_session_id}}/tokens/{{clerk_jwt_template}}",
        auth: noauth,
        headers: clerkSecretHeaders(),
        test: `
          pm.test("clerk create token returns 200", function () {
            pm.response.to.have.status(200);
          });
          var json = pm.response.json();
          var accessToken = (json.jwt || "").trim();
          pm.test("clerk token response includes jwt", function () {
            pm.expect(accessToken).to.not.eql("");
          });
          pm.environment.set("access_token", accessToken);
        `,
      }),
      requestItem({
        name: "05. Session - Me",
        method: "GET",
        url: "{{base_url}}/v1/me",
        test: `
          pm.test("session bootstrap returns 200", function () {
            pm.response.to.have.status(200);
          });
          var json = pm.response.json();
          pm.environment.set("user_id", json.user.id);
          pm.environment.set("workspace_id", json.workspace.id);
        `,
      }),
      requestItem({
        name: "06. Templates - List",
        method: "GET",
        url: "{{base_url}}/v1/templates",
        test: `
          pm.test("templates returns 200", function () {
            pm.response.to.have.status(200);
          });
        `,
      }),
      requestItem({
        name: "07. Webhook - Signed user.created",
        method: "POST",
        url: "{{base_url}}/webhooks/clerk",
        auth: noauth,
        headers: jsonHeader(),
        body: {
          mode: "raw",
          raw: "{{clerk_webhook_payload}}",
        },
        prerequest: `
          var webhookUserId = (pm.environment.get("clerk_webhook_user_id") || "").trim() || ("postman_webhook_" + Date.now());
          var webhookEmail = (pm.environment.get("clerk_webhook_email") || "").trim() || "postman-webhook@example.com";
          var payload = JSON.stringify({
            type: "user.created",
            data: {
              id: webhookUserId,
              primary_email_address_id: webhookUserId + "_primary_email",
              email_addresses: [
                {
                  id: webhookUserId + "_primary_email",
                  email_address: webhookEmail
                }
              ],
              first_name: "Postman",
              last_name: "Webhook",
              username: null,
              image_url: null
            }
          });
          var secret = (pm.environment.get("clerk_webhook_signing_secret") || "").trim();
          if (!secret) {
            throw new Error("clerk_webhook_signing_secret environment variable is required");
          }
          var messageId = "msg_" + Date.now();
          var timestamp = String(Math.floor(Date.now() / 1000));
          var normalizedSecret = secret.replace(/^whsec_/, "");
          var key = CryptoJS.enc.Base64.parse(normalizedSecret);
          var signedContent = messageId + "." + timestamp + "." + payload;
          var signature = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA256(signedContent, key));
          pm.environment.set("clerk_webhook_payload", payload);
          pm.request.headers.upsert({ key: "svix-id", value: messageId });
          pm.request.headers.upsert({ key: "svix-timestamp", value: timestamp });
          pm.request.headers.upsert({ key: "svix-signature", value: "v1," + signature });
        `,
        test: `
          pm.test("signed webhook returns 200", function () {
            pm.response.to.have.status(200);
          });
        `,
      }),
      requestItem({
        name: "08. Webhook - Invalid Signature",
        method: "POST",
        url: "{{base_url}}/webhooks/clerk",
        auth: noauth,
        headers: jsonHeader(),
        body: {
          mode: "raw",
          raw: "{{clerk_webhook_payload}}",
        },
        prerequest: `
          pm.request.headers.upsert({ key: "svix-id", value: "invalid_" + Date.now() });
          pm.request.headers.upsert({ key: "svix-timestamp", value: String(Math.floor(Date.now() / 1000)) });
          pm.request.headers.upsert({ key: "svix-signature", value: "v1,invalid" });
        `,
        test: `
          pm.test("invalid webhook returns 400", function () {
            pm.response.to.have.status(400);
          });
        `,
      }),
    ]),
    folder("Documents & AI", [
      requestItem({
        name: "09. Documents - Create",
        method: "POST",
        url: "{{base_url}}/v1/documents",
        headers: jsonHeader(),
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              title: "Postman Primary Document",
              type: "general_paper",
            },
            null,
            2,
          ),
        },
        test: `
          pm.test("create document returns 201", function () {
            pm.response.to.have.status(201);
          });
          var json = pm.response.json();
          pm.environment.set("document_id_primary", json.document.id);
          pm.environment.set("document_updated_at_primary", json.document.updatedAt);
        `,
      }),
      requestItem({
        name: "10. Documents - Get Primary",
        method: "GET",
        url: "{{base_url}}/v1/documents/{{document_id_primary}}",
        test: `
          pm.test("get document returns 200", function () {
            pm.response.to.have.status(200);
          });
        `,
      }),
      requestItem({
        name: "11. Documents - Patch Primary",
        method: "PATCH",
        url: "{{base_url}}/v1/documents/{{document_id_primary}}",
        headers: jsonHeader(),
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              title: "Postman Primary Document Updated",
            },
            null,
            2,
          ),
        },
        test: `
          pm.test("patch document returns 200", function () {
            pm.response.to.have.status(200);
          });
          var json = pm.response.json();
          pm.environment.set("document_updated_at_primary", json.document.updatedAt);
        `,
      }),
      requestItem({
        name: "12. Documents - Recent",
        method: "GET",
        url: "{{base_url}}/v1/documents/recent?limit=5",
        test: `
          pm.test("recent documents returns 200", function () {
            pm.response.to.have.status(200);
          });
        `,
      }),
      requestItem({
        name: "13. Documents - Bootstrap",
        method: "POST",
        url: "{{base_url}}/v1/documents/bootstrap",
        headers: jsonHeader(),
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              title: "Postman Bootstrap Document",
              type: "general_paper",
              templateCode: "general_paper",
            },
            null,
            2,
          ),
        },
        test: `
          pm.test("bootstrap returns 201", function () {
            pm.response.to.have.status(201);
          });
          var json = pm.response.json();
          pm.environment.set("document_id_bootstrap", json.document.id);
        `,
      }),
      requestItem({
        name: "14. Documents - Archive Bootstrap",
        method: "POST",
        url: "{{base_url}}/v1/documents/{{document_id_bootstrap}}/archive",
        headers: jsonHeader(),
        body: {
          mode: "raw",
          raw: "{}",
        },
        test: `
          pm.test("archive bootstrap returns 200", function () {
            pm.response.to.have.status(200);
          });
        `,
      }),
      requestItem({
        name: "15. Documents - Save Content",
        method: "PUT",
        url: "{{base_url}}/v1/documents/{{document_id_primary}}/content",
        headers: jsonHeader(),
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              contentJson: [
                {
                  type: "paragraph",
                  id: "postman-block-1",
                  children: [{ text: "Konten awal dari suite Postman Aqshara." }],
                },
              ],
              baseUpdatedAt: "{{document_updated_at_primary}}",
            },
            null,
            2,
          ),
        },
        test: `
          pm.test("save content returns 200", function () {
            pm.response.to.have.status(200);
          });
          var json = pm.response.json();
          pm.environment.set("document_updated_at_primary", json.document.updatedAt);
          pm.environment.set("primary_block_id", "postman-block-1");
        `,
      }),
      requestItem({
        name: "16. AI - Generate Outline",
        method: "POST",
        url: "{{base_url}}/v1/documents/{{document_id_primary}}/outline/generate",
        headers: jsonHeader(),
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              topic: "Struktur tulisan akademik untuk riset produktivitas",
              idempotencyKey: "postman-outline-generate",
              templateCode: "general_paper",
            },
            null,
            2,
          ),
        },
        test: `
          pm.test("generate outline returns 200", function () {
            pm.response.to.have.status(200);
          });
          var json = pm.response.json();
          pm.environment.set("generated_outline_json", JSON.stringify(json.outline));
        `,
      }),
      requestItem({
        name: "17. AI - Apply Outline",
        method: "POST",
        url: "{{base_url}}/v1/documents/{{document_id_primary}}/outline/apply",
        headers: jsonHeader(),
        body: {
          mode: "raw",
          raw: '{\n  "outline": {{generated_outline_json}},\n  "baseUpdatedAt": "{{document_updated_at_primary}}"\n}',
        },
        test: `
          pm.test("apply outline returns 200", function () {
            pm.response.to.have.status(200);
          });
          var json = pm.response.json();
          pm.environment.set("document_updated_at_primary", json.document.updatedAt);
        `,
      }),
      requestItem({
        name: "18. AI - Generate Proposal For Apply",
        method: "POST",
        url: "{{base_url}}/v1/documents/{{document_id_primary}}/ai/proposals",
        headers: jsonHeader(),
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              action: "rewrite",
              targetBlockIds: ["{{primary_block_id}}"],
              idempotencyKey: "postman-proposal-apply",
            },
            null,
            2,
          ),
        },
        test: `
          pm.test("generate proposal for apply returns 200", function () {
            pm.response.to.have.status(200);
          });
          var json = pm.response.json();
          pm.environment.set("proposal_id_apply", json.proposal.id);
        `,
      }),
      requestItem({
        name: "19. AI - Apply Proposal",
        method: "POST",
        url: "{{base_url}}/v1/ai/proposals/{{proposal_id_apply}}/apply",
        headers: jsonHeader(),
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              baseUpdatedAt: "{{document_updated_at_primary}}",
              mode: "replace",
            },
            null,
            2,
          ),
        },
        test: `
          pm.test("apply proposal returns 200", function () {
            pm.response.to.have.status(200);
          });
          var json = pm.response.json();
          pm.environment.set("document_updated_at_primary", json.document.updatedAt);
        `,
      }),
      requestItem({
        name: "20. AI - Generate Proposal For Dismiss",
        method: "POST",
        url: "{{base_url}}/v1/documents/{{document_id_primary}}/ai/proposals",
        headers: jsonHeader(),
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              action: "simplify",
              targetBlockIds: ["{{primary_block_id}}"],
              idempotencyKey: "postman-proposal-dismiss",
            },
            null,
            2,
          ),
        },
        test: `
          pm.test("generate proposal for dismiss returns 200", function () {
            pm.response.to.have.status(200);
          });
          var json = pm.response.json();
          pm.environment.set("proposal_id_dismiss", json.proposal.id);
        `,
      }),
      requestItem({
        name: "21. AI - Dismiss Proposal",
        method: "POST",
        url: "{{base_url}}/v1/ai/proposals/{{proposal_id_dismiss}}/dismiss",
        headers: jsonHeader(),
        body: {
          mode: "raw",
          raw: "{}",
        },
        test: `
          pm.test("dismiss proposal returns 200", function () {
            pm.response.to.have.status(200);
          });
        `,
      }),
    ]),
    folder("Sources & Exports", [
      requestItem({
        name: "22. Sources - Create Upload URL",
        method: "POST",
        url: "{{base_url}}/v1/sources/upload-url",
        headers: jsonHeader(),
        body: {
          mode: "raw",
          raw: "{}",
        },
        test: `
          pm.test("upload-url returns 200", function () {
            pm.response.to.have.status(200);
          });
          var json = pm.response.json();
          pm.environment.set("source_id", json.sourceId);
          pm.environment.set("storage_key", json.storageKey);
          pm.environment.set("upload_url", json.uploadUrl);
          pm.environment.set("source_status_poll_attempt", "0");
        `,
      }),
      requestItem({
        name: "23. Sources - Upload Sample PDF",
        method: "PUT",
        url: "{{upload_url}}",
        auth: noauth,
        headers: [
          {
            key: "Content-Type",
            value: "application/pdf",
            type: "text",
          },
        ],
        body: {
          mode: "file",
          file: {
            src: "postman/sample.pdf",
          },
        },
        test: `
          pm.test("sample upload returns success", function () {
            pm.expect([200, 201, 204]).to.include(pm.response.code);
          });
        `,
      }),
      requestItem({
        name: "24. Sources - Register",
        method: "POST",
        url: "{{base_url}}/v1/sources/register",
        headers: jsonHeader(),
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              documentId: "{{document_id_primary}}",
              sourceId: "{{source_id}}",
              storageKey: "{{storage_key}}",
              originalFileName: "sample.pdf",
              fileSizeBytes: Number(samplePdfBuffer.byteLength),
              checksum: samplePdfSha256,
              mimeType: "application/pdf",
              idempotencyKey: "postman-source-register",
            },
            null,
            2,
          ),
        },
        test: `
          pm.test("register source returns 200", function () {
            pm.response.to.have.status(200);
          });
          pm.environment.set("source_status_poll_attempt", "0");
        `,
      }),
      requestItem({
        name: "25. Sources - List For Document",
        method: "GET",
        url: "{{base_url}}/v1/documents/{{document_id_primary}}/sources",
        test: `
          pm.test("list sources returns 200", function () {
            pm.response.to.have.status(200);
          });
        `,
      }),
      requestItem({
        name: "26. Sources - Get Status",
        method: "GET",
        url: "{{base_url}}/v1/sources/{{source_id}}/status",
        test: `
          pm.test("source status returns 200", function () {
            pm.response.to.have.status(200);
          });
          var json = pm.response.json();
          var status = (json.source && json.source.status) || "";
          var attempt = parseInt(pm.environment.get("source_status_poll_attempt") || "0", 10) + 1;
          var maxAttempts = parseInt(pm.environment.get("poll_max_attempts") || "15", 10);
          pm.environment.set("source_status_poll_attempt", String(attempt));
          pm.environment.set("source_status", status);
          if ((status === "queued" || status === "processing") && attempt < maxAttempts) {
            postman.setNextRequest("26. Sources - Get Status");
          } else if (status === "failed") {
            postman.setNextRequest("27. Sources - Retry If Failed");
          } else {
            postman.setNextRequest("28. Exports - Preflight");
          }
        `,
      }),
      requestItem({
        name: "27. Sources - Retry If Failed",
        method: "POST",
        url: "{{base_url}}/v1/sources/{{source_id}}/retry",
        headers: jsonHeader(),
        body: {
          mode: "raw",
          raw: "{}",
        },
        test: `
          pm.test("retry source returns 200 when source failed", function () {
            pm.response.to.have.status(200);
          });
          postman.setNextRequest("28. Exports - Preflight");
        `,
      }),
      requestItem({
        name: "28. Exports - Preflight",
        method: "POST",
        url: "{{base_url}}/v1/documents/{{document_id_primary}}/exports/docx/preflight",
        headers: jsonHeader(),
        body: {
          mode: "raw",
          raw: "{}",
        },
        test: `
          pm.test("export preflight returns 200", function () {
            pm.response.to.have.status(200);
          });
        `,
      }),
      requestItem({
        name: "29. Exports - Queue DOCX Export",
        method: "POST",
        url: "{{base_url}}/v1/documents/{{document_id_primary}}/exports/docx",
        headers: jsonHeader(),
        body: {
          mode: "raw",
          raw: JSON.stringify(
            {
              idempotencyKey: "postman-export-docx",
            },
            null,
            2,
          ),
        },
        test: `
          pm.test("queue export returns 200", function () {
            pm.response.to.have.status(200);
          });
          var json = pm.response.json();
          pm.environment.set("export_id", json.export.id);
          pm.environment.set("export_status_poll_attempt", "0");
        `,
      }),
      requestItem({
        name: "30. Exports - List",
        method: "GET",
        url: "{{base_url}}/v1/exports?limit=20",
        test: `
          pm.test("list exports returns 200", function () {
            pm.response.to.have.status(200);
          });
        `,
      }),
      requestItem({
        name: "31. Exports - Get Status",
        method: "GET",
        url: "{{base_url}}/v1/exports/{{export_id}}",
        test: `
          pm.test("export status returns 200", function () {
            pm.response.to.have.status(200);
          });
          var json = pm.response.json();
          var status = (json.export && json.export.status) || "";
          var attempt = parseInt(pm.environment.get("export_status_poll_attempt") || "0", 10) + 1;
          var maxAttempts = parseInt(pm.environment.get("poll_max_attempts") || "15", 10);
          pm.environment.set("export_status_poll_attempt", String(attempt));
          pm.environment.set("export_status", status);
          if ((status === "queued" || status === "processing") && attempt < maxAttempts) {
            postman.setNextRequest("31. Exports - Get Status");
          } else if (status === "ready") {
            postman.setNextRequest("32. Exports - Download If Ready");
          } else if (status === "failed") {
            postman.setNextRequest("33. Exports - Retry If Failed");
          } else {
            postman.setNextRequest("34. Sources - Delete");
          }
        `,
      }),
      requestItem({
        name: "32. Exports - Download If Ready",
        method: "GET",
        url: "{{base_url}}/v1/exports/{{export_id}}/download",
        test: `
          pm.test("download returns 200 or 302", function () {
            pm.expect([200, 302]).to.include(pm.response.code);
          });
          postman.setNextRequest("34. Sources - Delete");
        `,
      }),
      requestItem({
        name: "33. Exports - Retry If Failed",
        method: "POST",
        url: "{{base_url}}/v1/exports/{{export_id}}/retry",
        headers: jsonHeader(),
        body: {
          mode: "raw",
          raw: "{}",
        },
        test: `
          pm.test("retry export returns 200 when export failed", function () {
            pm.response.to.have.status(200);
          });
          postman.setNextRequest("34. Sources - Delete");
        `,
      }),
      requestItem({
        name: "34. Sources - Delete",
        method: "DELETE",
        url: "{{base_url}}/v1/sources/{{source_id}}",
        test: `
          pm.test("delete source returns 204", function () {
            pm.response.to.have.status(204);
          });
          postman.setNextRequest("35. Cleanup - Delete Bootstrap Document");
        `,
      }),
      requestItem({
        name: "35. Cleanup - Delete Bootstrap Document",
        method: "DELETE",
        url: "{{base_url}}/v1/documents/{{document_id_bootstrap}}",
        test: `
          pm.test("delete bootstrap document returns 204", function () {
            pm.response.to.have.status(204);
          });
          postman.setNextRequest("36. Cleanup - Delete Primary Document");
        `,
      }),
      requestItem({
        name: "36. Cleanup - Delete Primary Document",
        method: "DELETE",
        url: "{{base_url}}/v1/documents/{{document_id_primary}}",
        test: `
          pm.test("delete primary document returns 204", function () {
            pm.response.to.have.status(204);
          });
          [
            "clerk_user_id",
            "clerk_session_id",
            "document_id_primary",
            "document_id_bootstrap",
            "document_updated_at_primary",
            "proposal_id_apply",
            "proposal_id_dismiss",
            "source_id",
            "storage_key",
            "upload_url",
            "source_status",
            "export_id",
            "export_status"
          ].forEach(function (key) {
            pm.environment.unset(key);
          });
        `,
      }),
    ]),
  ],
};

const environment = {
  id: "e6f9455c-b4ec-4d09-a91d-eb3b52993e6a",
  name: "Aqshara Local",
  values: [
    ["base_url", "http://localhost:9000"],
    ["clerk_api_url", "https://api.clerk.com/v1"],
    ["clerk_secret_key", ""],
    ["clerk_email", ""],
    ["clerk_password", ""],
    ["clerk_jwt_template", "postman-testing"],
    ["clerk_webhook_signing_secret", ""],
    ["clerk_webhook_user_id", "postman-webhook-user"],
    ["clerk_webhook_email", "postman-webhook@example.com"],
    ["access_token", ""],
    ["clerk_user_id", ""],
    ["clerk_session_id", ""],
    ["user_id", ""],
    ["workspace_id", ""],
    ["document_id_primary", ""],
    ["document_id_bootstrap", ""],
    ["document_updated_at_primary", ""],
    ["generated_outline_json", ""],
    ["primary_block_id", "postman-block-1"],
    ["proposal_id_apply", ""],
    ["proposal_id_dismiss", ""],
    ["source_id", ""],
    ["storage_key", ""],
    ["upload_url", ""],
    ["source_status", ""],
    ["source_status_poll_attempt", "0"],
    ["export_id", ""],
    ["export_status", ""],
    ["export_status_poll_attempt", "0"],
    ["sample_pdf_sha256", samplePdfSha256],
    ["sample_pdf_bytes", String(samplePdfBuffer.byteLength)],
    ["poll_max_attempts", "15"],
    ["poll_delay_ms", "1500"],
  ].map(([key, value]) => ({
    key,
    value,
    enabled: true,
  })),
  _postman_variable_scope: "environment",
  _postman_exported_at: new Date().toISOString(),
  _postman_exported_using: "Codex GPT-5",
};

const readme = `# Aqshara Postman

Collection dan environment ini dipakai untuk mengetes seluruh surface API Aqshara dari root repo.

## Files

- \`aqshara-smoke.postman_collection.json\`
- \`aqshara-e2e.postman_collection.json\`
- \`aqshara-local.postman_environment.json\`
- \`sample.pdf\`

## Prasyarat

- API aktif di \`http://localhost:9000\` atau sesuaikan \`base_url\`.
- Clerk instance aktif dan memiliki user test email/password.
- Anda butuh \`clerk_secret_key\` dan JWT template name untuk Postman login flow.
- \`clerk_webhook_signing_secret\` diisi dengan secret webhook Clerk yang sama dengan API.
- Untuk flow source/export sampai status terminal, worker dan dependency pendukung harus aktif: Postgres, Redis, storage, OpenAI, dan worker Aqshara.

## Cara pakai di Postman UI

1. Import kedua collection dan environment dari folder \`postman/\`.
2. Pilih environment \`Aqshara Local\`.
3. Isi variabel: \`clerk_secret_key\`, \`clerk_email\`, \`clerk_password\`, \`clerk_jwt_template\`, dan \`clerk_webhook_signing_secret\`.
4. Jalankan \`Aqshara API Smoke\` untuk validasi cepat route publik, docs, dan negative auth checks.
5. Jalankan \`Aqshara API E2E\`. Empat request awal akan:
   - resolve user Clerk by email
   - verify password
   - create session
   - mint JWT template token ke \`access_token\`
6. Jika source/export masih \`queued\` atau \`processing\`, jalankan collection dari Runner dengan delay sekitar \`1000-3000 ms\` agar polling tidak terlalu rapat.

## Catatan suite E2E

- Flow auth mengikuti pola reference Postman seperti Paperview: token didapat di awal collection lewat credential request, lalu dipakai untuk seluruh request berikutnya.
- Clerk login di Postman memakai Clerk Backend API dengan urutan:
  - \`01. Clerk - Resolve User By Email\`
  - \`02. Clerk - Verify Password\`
  - \`03. Clerk - Create Session\`
  - \`04. Clerk - Create Token\`
- Positive webhook menggunakan header Svix yang ditandatangani dari \`clerk_webhook_signing_secret\`.
- \`Sources - Retry If Failed\` hanya dijalankan jika status source berakhir di \`failed\`.
- \`Exports - Download If Ready\` hanya dijalankan jika export berstatus \`ready\`.
- \`Exports - Retry If Failed\` hanya dijalankan jika export berstatus \`failed\`.
- JWT template name di \`clerk_jwt_template\` harus sudah dibuat di Clerk Dashboard sebelum run collection.

## Newman

Jalankan dari root repo:

\`\`\`bash
newman run postman/aqshara-smoke.postman_collection.json \\
  -e postman/aqshara-local.postman_environment.json

newman run postman/aqshara-e2e.postman_collection.json \\
  -e postman/aqshara-local.postman_environment.json
\`\`\`
`;

function writeJson(fileName, value) {
  writeFileSync(resolve(outputDir, fileName), `${JSON.stringify(value, null, 2)}\n`);
}

mkdirSync(outputDir, { recursive: true });
writeJson("aqshara-smoke.postman_collection.json", smokeCollection);
writeJson("aqshara-e2e.postman_collection.json", e2eCollection);
writeJson("aqshara-local.postman_environment.json", environment);
writeFileSync(resolve(outputDir, "README.md"), readme);
