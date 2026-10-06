/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import GitHubRelease from "../../release/github-release.ts";
import GitHubException from "../../repository/github.exception.ts";

class GitHubReleaseTests {
  public static register(): void {
    test("a release is read with its tag, target, draft state and assets", () => {
      const release = GitHubRelease.read({
        id: 7, tag_name: "v0.0.2", target_commitish: "abc", draft: true,
        assets: [{ id: 9, name: "TeamRun-linux-x64.AppImage", size: 3, state: "uploaded", digest: "sha256:ab" }]
      }, "release");

      assert.deepEqual([release.id, release.tag, release.target, release.isDraft, release.assets.map(t => t.name)], [7, "v0.0.2", "abc", true, ["TeamRun-linux-x64.AppImage"]]);
    });

    test("a release without assets or with a malformed asset is refused with the field's place", () => {
      const release = { id: 7, tag_name: "v0.0.2", target_commitish: "abc", draft: false };

      assert.throws(() => GitHubRelease.read(release, "release"), new GitHubException("release.assets must be an array."));
      assert.throws(() => GitHubRelease.read({ ...release, assets: [{ id: 9 }] }, "release"), new GitHubException("release.assets[0].name must be text."));
    });
  }
}

GitHubReleaseTests.register();
