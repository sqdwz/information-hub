import test from "node:test";
import assert from "node:assert/strict";
import { timingSafeEqual, webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { verifySecret } from "../src/knowledge-security.js";

const nodeSubtle = {
  digest: (...args) => webcrypto.subtle.digest(...args),
  timingSafeEqual: (left, right) => timingSafeEqual(Buffer.from(left), Buffer.from(right))
};

test("verifySecret accepts equal values and rejects different values", async () => {
  assert.equal(await verifySecret("owner-password", "owner-password", nodeSubtle), true);
  assert.equal(await verifySecret("wrong-password", "owner-password", nodeSubtle), false);
  assert.equal(await verifySecret("", "owner-password", nodeSubtle), false);
});

test("verifySecret delegates the final decision to a constant-time comparator", async () => {
  const rejectingSubtle = {
    digest: (...args) => webcrypto.subtle.digest(...args),
    timingSafeEqual: () => false
  };

  assert.equal(await verifySecret("same", "same", rejectingSubtle), false);
});

test("the token endpoint cannot mint an unrestricted master token", async () => {
  const worker = await readFile(resolve("src/worker.js"), "utf8");
  assert.doesNotMatch(worker, /body\.kind\s*===\s*["']share["']/);
  assert.match(worker, /kind:\s*["']share["']/);
  assert.match(worker, /scope:\s*["']limited["']/);
});
