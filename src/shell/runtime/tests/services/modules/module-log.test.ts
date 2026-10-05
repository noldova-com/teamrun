/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { EventRegistry, MethodRegistry, ServiceRegistry } from "@noldova/teamrun-shell-runtime";

import { ModuleContextFixture } from "../../fixtures/module-context.fixture.js";
import { SettingsFixture } from "../../fixtures/settings.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";

@TestClass
export class ModuleLogTests {
  @TestMethod
  public async writesTheModulesLinesRedactedAndWithoutControlCharactersEachStartingWithItsId(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const diagnostics = new TextOutputFixture();
    const context = ModuleContextFixture.create(
      settings, new MethodRegistry(), new EventRegistry({ broadcast: () => undefined }), new ServiceRegistry(), undefined, undefined, undefined, diagnostics);
    const token = "a".repeat(40);

    context.log.write(`Synced ${path.join(ModuleContextFixture.HOME, "notes")}\r\nwith ${token}\r2026-10-04T12:00:00.000Z shell: faked\u2028\u001b[31mred\u001b[0m\tdone\n`);

    Assert.areEqual(
      `notes: Synced ${path.join("~", "notes")}\nnotes: with [redacted]\nnotes: 2026-10-04T12:00:00.000Z shell: faked\nnotes: [31mred[0m\tdone\n`, diagnostics.text);
  }
}
