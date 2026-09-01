import assert from "node:assert/strict";
import { test } from "node:test";
import { mcpAuthConfigFromEnv, mcpAuthOk } from "./mcp-auth";

const basic = (u: string, p: string) => `Basic ${Buffer.from(`${u}:${p}`).toString("base64")}`;

test("mcpAuthOk: open only when no credential is configured", () => {
  assert.equal(mcpAuthOk(null, {}), true);
  assert.equal(mcpAuthOk(null, { token: "t0ken" }), false);
  assert.equal(mcpAuthOk(null, { siteUser: "julius", sitePassword: "s3cret" }), false);
});

test("mcpAuthOk: accepts the bearer token", () => {
  const cfg = { token: "t0ken" };
  assert.equal(mcpAuthOk("Bearer t0ken", cfg), true);
  assert.equal(mcpAuthOk("Bearer  t0ken  ", cfg), true);
  assert.equal(mcpAuthOk("Bearer wrong", cfg), false);
  assert.equal(mcpAuthOk("Bearer t0ke", cfg), false);
  assert.equal(mcpAuthOk("t0ken", cfg), false);
});

test("mcpAuthOk: also accepts the site's basic credentials", () => {
  const cfg = { token: "t0ken", siteUser: "julius", sitePassword: "s3cret" };
  assert.equal(mcpAuthOk(basic("julius", "s3cret"), cfg), true);
  assert.equal(mcpAuthOk(basic("julius", "nope"), cfg), false);
  assert.equal(mcpAuthOk(basic("mallory", "s3cret"), cfg), false);
});

test("mcpAuthOk: a site password alone still gates the endpoint", () => {
  const cfg = { siteUser: "julius", sitePassword: "s3cret" };
  assert.equal(mcpAuthOk(basic("julius", "s3cret"), cfg), true);
  assert.equal(mcpAuthOk("Bearer s3cret", cfg), false);
});

test("mcpAuthConfigFromEnv: reads the env, defaulting the basic user", () => {
  assert.deepEqual(mcpAuthConfigFromEnv({ MCP_TOKEN: "t", SITE_PASSWORD: "p" }), {
    token: "t",
    siteUser: "julius",
    sitePassword: "p",
  });
  assert.deepEqual(mcpAuthConfigFromEnv({}), {
    token: undefined,
    siteUser: "julius",
    sitePassword: undefined,
  });
});
