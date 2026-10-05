/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { QualifiedName, Request, SettingKey, SettingValue, SettingsQuery, SettingsSnapshot, ShellMethods } from "@noldova/teamrun-shell-protocol";
import { RuntimeBuild } from "@noldova/teamrun-shell-runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class SettingsReadMethodTests {
  @TestMethod
  public answersTheValuesADeviceSees(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync(30_000, await fixture.writeModulesAsync([]));
      const [connection] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const mode = new SettingKey(QualifiedName.parse("shell.mode"));
      const quiet = new SettingKey(QualifiedName.parse("shell.doNotDisturb"), null, "d1");

      connection.sendMessages(
        new Request("desktop:1", ShellMethods.setSetting, new SettingValue(mode, "Dark").toJson()),
        new Request("desktop:2", ShellMethods.setSetting, new SettingValue(quiet, true).toJson()),
        new Request("desktop:3", ShellMethods.settings, new SettingsQuery("d1").toJson()));
      const [responses] = await RuntimeHostFixture.readMessagesAsync(connection, 6);
      const snapshot = SettingsSnapshot.fromJson(responses.get("desktop:3")?.payload);
      const entry = (name: string): string => JSON.stringify(snapshot.entries.find(t => t.name.text === name)?.toJson());

      Assert.areEqual("{\"name\":\"shell.mode\",\"value\":\"Dark\",\"isSet\":true}", entry("shell.mode"));
      Assert.areEqual("{\"name\":\"shell.doNotDisturb\",\"value\":true,\"isSet\":true}", entry("shell.doNotDisturb"));
    });
  }
}
