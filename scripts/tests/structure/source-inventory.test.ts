/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import SourceFile from "../../structure/source-file.ts";
import SourceInventory from "../../structure/source-inventory.ts";

class SourceInventoryTests {
  public static register(): void {
    test("an inventory keeps the module ids and the source files", () => {
      const files = [new SourceFile("src/shell/ui/src/a.ts", "shell", true, "src/shell/ui", "")];

      const inventory = new SourceInventory(["alpha"], files);

      assert.deepEqual(inventory.moduleIds, ["alpha"]);
      assert.equal(inventory.files, files);
    });
  }
}

SourceInventoryTests.register();
