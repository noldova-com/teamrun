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
export class SettingWriteMethodTests {
  @TestMethod
  public writesASettingAndPublishesTheChangeButRefusesAnInvalidValueOrAnUndeclaredSetting(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync(30_000, await fixture.writeModulesAsync([]));
      const [connection] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const mode = new SettingKey(QualifiedName.parse("shell.mode"));
      const quiet = new SettingKey(QualifiedName.parse("shell.doNotDisturb"), null, "d1");

      connection.sendMessages(
        new Request("desktop:1", ShellMethods.setSetting, new SettingValue(mode, "Dark").toJson()),
        new Request("desktop:2", ShellMethods.setSetting, new SettingValue(quiet, true).toJson()),
        new Request("desktop:3", ShellMethods.setSetting, new SettingValue(mode, "Blue").toJson()),
        new Request("desktop:4", ShellMethods.setSetting, new SettingValue(new SettingKey(QualifiedName.parse("shell.speed")), 1).toJson()));
      const [responses, events] = await RuntimeHostFixture.readMessagesAsync(connection, 7);
      const changes = events.filter(t => t.name.text === "shell.settingsChanged");

      Assert.isTrue(["desktop:1", "desktop:2"].every(t => responses.get(t)?.hasFailed === false));
      Assert.areEqual("InvalidParams,NotFound", ["desktop:3", "desktop:4"].map(t => responses.get(t)?.failure?.code).join(","));
      Assert.areEqual(JSON.stringify([
        "{\"name\":\"shell.mode\",\"value\":\"Dark\",\"isSet\":true}",
        "{\"name\":\"shell.doNotDisturb\",\"device\":\"d1\",\"value\":true,\"isSet\":true}"
      ]), JSON.stringify(changes.map(t => JSON.stringify(t.payload))));
      Assert.areEqual("shell.settingsChanged,shell.settingsChanged,shell.notifications", events.map(t => t.name.text).join(","));
    });
  }
}
