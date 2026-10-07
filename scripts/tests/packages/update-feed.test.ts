/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import UpdateFeed from "../../packages/update-feed.ts";

class UpdateFeedTests {
  public static register(): void {
    test("a feed is an http or https URL ending in a slash", () => {
      const feeds = ["http://127.0.0.1:8080/", "https://example.com/releases/", "http://127.0.0.1:8080", "ftp://example.com/", "file:///tmp/feed/", "local/", ""];

      assert.deepEqual(feeds.map(t => UpdateFeed.isValid(t)), [true, true, false, false, false, false, false]);
    });

    test("a repository's feed is its latest release's downloads", () => {
      assert.equal(UpdateFeed.ofRepository("owner/name"), "https://github.com/owner/name/releases/latest/download/");
    });
  }
}

UpdateFeedTests.register();
