/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { StressChatProject } from "@noldova/teamrun.runtime/development";

import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class StressChatProjectTests {
  @TestMethod
  public writesTheSourcesAndTheImagesAndReturnsTheImagesToAttach(): void {
    using folder = new TemporaryDirectory();
    const root = folder.resolve("stress-chat");
    const project = new StressChatProject(root);
    writeFileSync(folder.resolve("unrelated.txt"), "kept");

    const first = project.write();
    writeFileSync(join(root, "src", "example.ts"), "changed by hand\n");
    const inputs = project.write();
    const sizes = inputs.map(t => {
      const file = readFileSync(join(root, "images", t.name));
      return `${t.name} ${file.readUInt32BE(16)}x${file.readUInt32BE(20)} ${t.mediaType} ${t.data === file.toString("base64")} ${t.path}`;
    });

    Assert.areEqual(root, project.root);
    Assert.areEqual(4, first.length);
    Assert.areEqual(
      "opaque.png 1280x720 image/png true null,transparent.png 512x512 image/png true null,wide.png 3000x600 image/png true null,"
      + "4k.png 3840x2160 image/png true null", sizes.join(","));
    Assert.areEqual("added.ts,example.ts,extra-1.ts,extra-2.ts,extra-3.ts,renamed.ts", readdirSync(join(root, "src")).sort().join(","));
    Assert.areEqual("export function total(values: number[]): number {\n  return values.reduce((sum, value) => sum + value, 0);\n}\n",
      readFileSync(join(root, "src", "example.ts"), "utf8"));
    Assert.areEqual("kept", readFileSync(folder.resolve("unrelated.txt"), "utf8"));
  }
}
