/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { rename } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import ContentHash from "../../packages/content-hash.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class ContentHashTests {
  public static register(): void {
    test("parts hash to a stable SHA-256 that keeps their boundaries", () => {
      assert.equal(ContentHash.ofParts([]), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
      assert.match(ContentHash.ofParts(["a"]), /^[0-9a-f]{64}$/);
      assert.equal(ContentHash.ofParts(["a", "b"]), ContentHash.ofParts(["a", "b"]));
      assert.notEqual(ContentHash.ofParts(["ab"]), ContentHash.ofParts(["a", "b"]));
    });

    test("a file hashes to the SHA-256 of its bytes", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ "a.txt": "abc" });

      assert.equal(await ContentHash.ofFileAsync(path.join(repository.directory, "a.txt")), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    });

    test("a tree's hash follows its files' paths and contents, but not installed dependencies or empty folders", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ "tree/src/a.ts": "a\n", "tree/src/deep/b.ts": "b\n" });
      const tree = path.join(repository.directory, "tree");
      const original = await ContentHash.ofTreeAsync(tree);

      await repository.writeAsync({ "tree/node_modules/x/index.js": "x\n", "tree/src/node_modules/y.js": "y\n" });
      assert.equal(await ContentHash.ofTreeAsync(tree), original);
      await repository.writeAsync({ "tree/src/deep/b.ts": "changed\n" });
      const changed = await ContentHash.ofTreeAsync(tree);
      assert.notEqual(changed, original);
      await rename(path.join(tree, "src", "deep", "b.ts"), path.join(tree, "src", "deep", "c.ts"));
      assert.notEqual(await ContentHash.ofTreeAsync(tree), changed);
    });
  }
}

ContentHashTests.register();
