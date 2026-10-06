/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { SettingsQuery, SettingsSnapshot, ShellMethods } from "@noldova/teamrun-shell-protocol";
import { RuntimeBuild } from "@noldova/teamrun-shell-runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class ShellSettingsTests {
  @TestMethod
  public declaresTheShellsSettingsInOrderWithTheirDefaultsWhereEachIsKeptAndTheModesInOrder(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync(30_000, await fixture.writeModulesAsync([]));
      const [connection] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);

      const snapshot = SettingsSnapshot.fromJson((await RuntimeHostFixture.callAsync(connection, "desktop:1", ShellMethods.settings, new SettingsQuery("d1").toJson())).payload);

      Assert.areEqual("shell.theme,shell.mode,shell.interfaceFont,shell.codeFont,shell.panelSize,shell.messageSize,shell.codeSize,shell.leftDockStyle,shell.rightDockStyle,shell.menuBar,shell.previewTabs,shell.recentCommandCount,shell.spellCheck,shell.spellCheckLanguages,shell.doNotDisturb,shell.mutedModules,shell.keyBindings,shell.updateChecks",
        snapshot.definitions.map(t => t.name.text).join(","));
      Assert.areEqual(
        "\"shell.default\" Shared,\"System\" Shared,\"Noldova\" Device,\"Noldova\" Device,13 Device,14 Device,14 Device,\"Tabs\" Shared,\"Tabs\" Shared,\"Inline\" Shared,true Shared,5 Shared,true Shared,[] Device,false Device,[] Shared,{} Shared,true Device",
        snapshot.definitions.map(t => `${JSON.stringify(t.defaultValue)} ${t.locality}`).join(","));
      Assert.areEqual("Boolean Spelling,Languages Spelling", snapshot.definitions.filter(t => t.name.text.startsWith("shell.spellCheck")).map(t => `${t.type.kind} ${t.group}`).join(","));
      Assert.areEqual("About Updates", snapshot.definitions.filter(t => t.name.text === "shell.updateChecks").map(t => `${t.page} ${t.group}`).join(","));
      Assert.areEqual("System,Light,Dark", snapshot.definitions.find(t => t.name.text === "shell.mode")?.type.options.map(t => t.value).join(","));
    });
  }
}
