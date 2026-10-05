/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import { test } from "node:test";

import PackageDigest from "../../release/package-digest.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class PackageDigestTests {
  public static register(): void {
    test("a file's SHA-256 in hexadecimal, SHA-512 in base64 and size are read from its bytes", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const content = "package\n".repeat(20_000);
      await repository.writeAsync({ "TeamRun-linux-x64.AppImage": content });

      const digest = await PackageDigest.readAsync(path.join(repository.directory, "TeamRun-linux-x64.AppImage"));

      assert.deepEqual([digest.sha256, digest.sha512, digest.size],
        [createHash("sha256").update(content).digest("hex"), createHash("sha512").update(content).digest("base64"), Buffer.byteLength(content)]);
    });
  }
}

PackageDigestTests.register();
