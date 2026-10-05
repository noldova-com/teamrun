/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { QualifiedName, Request, SettingKey, SettingValue, ShellMethods } from "@noldova/teamrun-shell-protocol";
import { RuntimeBuild } from "@noldova/teamrun-shell-runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class SettingResetMethodTests {
  @TestMethod
  public resetsASettingToItsDefaultAndPublishesTheChangeButRefusesADeviceSettingWithoutItsDevice(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync(30_000, await fixture.writeModulesAsync([]));
      const [connection] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const mode = new SettingKey(QualifiedName.parse("shell.mode"));

      connection.sendMessages(
        new Request("desktop:1", ShellMethods.setSetting, new SettingValue(mode, "Dark").toJson()),
        new Request("desktop:2", ShellMethods.resetSetting, mode.toJson()),
        new Request("desktop:3", ShellMethods.resetSetting, new SettingKey(QualifiedName.parse("shell.doNotDisturb")).toJson()));
      const [responses, events] = await RuntimeHostFixture.readMessagesAsync(connection, 5);

      Assert.isTrue(["desktop:1", "desktop:2"].every(t => responses.get(t)?.hasFailed === false));
      Assert.areEqual("InvalidParams", responses.get("desktop:3")?.failure?.code);
      Assert.areEqual("{\"name\":\"shell.mode\",\"value\":\"System\",\"isSet\":false}", JSON.stringify(events.at(-1)?.payload));
      Assert.areEqual("shell.settingsChanged,shell.settingsChanged", events.map(t => t.name.text).join(","));
    });
  }
}
