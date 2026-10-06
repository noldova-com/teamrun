/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import GitHubReleaseAsset from "../../release/github-release-asset.ts";
import GitHubException from "../../repository/github.exception.ts";

class GitHubReleaseAssetTests {
  public static register(): void {
    test("an asset is uploaded only in the uploaded state, and its digest may be missing", () => {
      const uploaded = GitHubReleaseAsset.read({ id: 9, name: "TeamRun-windows-x64.exe", size: 3, state: "uploaded", digest: "sha256:ab" }, "asset");
      const starting = GitHubReleaseAsset.read({ id: 10, name: "TeamRun-windows-x64.exe", size: 0, state: "starter", digest: null }, "asset");

      assert.deepEqual([uploaded.id, uploaded.name, uploaded.size, uploaded.isUploaded, uploaded.digest], [9, "TeamRun-windows-x64.exe", 3, true, "sha256:ab"]);
      assert.deepEqual([starting.isUploaded, starting.digest], [false, null]);
    });

    test("an asset without a state is refused", () => {
      assert.throws(() => GitHubReleaseAsset.read({ id: 9, name: "x", size: 3, digest: null }, "asset"), new GitHubException("asset.state must be text."));
    });
  }
}

GitHubReleaseAssetTests.register();
