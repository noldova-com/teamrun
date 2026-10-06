/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { QualifiedName, Request, SettingKey, SettingScope, SettingValue, ShellMethods } from "@noldova/teamrun-shell-protocol";
import { RuntimeBuild } from "@noldova/teamrun-shell-runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class SettingReadMethodTests {
  @TestMethod
  public answersTheEntryForAKeyAndRefusesAnUndeclaredSettingAnUnlistedScopeOrADeviceSettingWithoutADevice(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync(30_000, await fixture.writeModulesAsync([]));
      const [connection] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const mode = new SettingKey(QualifiedName.parse("shell.mode"));
      const quiet = (device: string | null): SettingKey => new SettingKey(QualifiedName.parse("shell.doNotDisturb"), null, device);

      connection.sendMessages(
        new Request("desktop:1", ShellMethods.setSetting, new SettingValue(mode, "Dark").toJson()),
        new Request("desktop:2", ShellMethods.readSetting, mode.toJson()),
        new Request("desktop:3", ShellMethods.readSetting, quiet("d1").toJson()),
        new Request("desktop:4", ShellMethods.readSetting, new SettingKey(QualifiedName.parse("shell.speed")).toJson()),
        new Request("desktop:5", ShellMethods.readSetting, new SettingKey(mode.name, new SettingScope(QualifiedName.parse("notes.folder"), "f1")).toJson()),
        new Request("desktop:6", ShellMethods.readSetting, quiet(null).toJson()));
      const [responses] = await RuntimeHostFixture.readMessagesAsync(connection, 7);

      Assert.areEqual(JSON.stringify([
        { name: "shell.mode", value: "Dark", isSet: true },
        { name: "shell.doNotDisturb", value: false, isSet: false }
      ]), JSON.stringify(["desktop:2", "desktop:3"].map(t => responses.get(t)?.payload)));
      Assert.areEqual("NotFound,InvalidParams,InvalidParams", ["desktop:4", "desktop:5", "desktop:6"].map(t => responses.get(t)?.failure?.code).join(","));
    });
  }
}
