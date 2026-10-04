/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import LicenseHeader from "../../structure/license-header.ts";

class LicenseHeaderTests {
  public static register(): void {
    test("the block header is the one this file starts with", async () => {
      assert.ok((await readFile(import.meta.filename, "utf8")).startsWith(LicenseHeader.BLOCK));
      assert.ok(LicenseHeader.BLOCK.startsWith("/**\n * @license\n * Copyright (c) Noldova.\n *\n"));
      assert.ok(LicenseHeader.BLOCK.endsWith(" * LICENSE file in the root directory of this source tree.\n */\n"));
    });

    test("the markup and hash headers carry the same notice in their own comments", () => {
      assert.equal(LicenseHeader.MARKUP, [
        "<!--",
        "@license",
        "Copyright (c) Noldova.",
        "",
        "This source code is licensed under the license found in the",
        "LICENSE file in the root directory of this source tree.",
        "-->",
        ""
      ].join("\n"));
      assert.equal(LicenseHeader.HASH, [
        "# @license",
        "# Copyright (c) Noldova.",
        "#",
        "# This source code is licensed under the license found in the",
        "# LICENSE file in the root directory of this source tree.",
        ""
      ].join("\n"));
    });
  }
}

LicenseHeaderTests.register();
