import assert from "node:assert/strict";
import { test } from "node:test";
import { basicAuthOk, clientIp } from "./auth";

const header = (u: string, p: string) => `Basic ${Buffer.from(`${u}:${p}`).toString("base64")}`;

test("basicAuthOk: accepts the correct user/password", () => {
  assert.equal(basicAuthOk(header("grounded", "s3cret"), "grounded", "s3cret"), true);
});

test("basicAuthOk: rejects wrong password, wrong user, and missing/blank header", () => {
  assert.equal(basicAuthOk(header("grounded", "nope"), "grounded", "s3cret"), false);
  assert.equal(basicAuthOk(header("mallory", "s3cret"), "grounded", "s3cret"), false);
  assert.equal(basicAuthOk(null, "grounded", "s3cret"), false);
  assert.equal(basicAuthOk("Bearer xyz", "grounded", "s3cret"), false);
});

test("basicAuthOk: malformed base64 does not throw", () => {
  assert.equal(basicAuthOk("Basic @@@notbase64@@@", "grounded", "s3cret"), false);
});

test("clientIp: first x-forwarded-for entry, else anon", () => {
  const h = (v: string | null) => ({ get: () => v });
  assert.equal(clientIp(h("1.2.3.4, 5.6.7.8")), "1.2.3.4");
  assert.equal(clientIp(h("  9.9.9.9 ")), "9.9.9.9");
  assert.equal(clientIp(h(null)), "anon");
});
