/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { RecentCommandUse, RecentCommandsQuery, Request, ShellMethods } from "@noldova/teamrun-shell-protocol";
import { RuntimeBuild } from "@noldova/teamrun-shell-runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class RecentCommandsMethodTests {
  @TestMethod
  public answersNoCommandsForADeviceThatUsedNoneAndEachDevicesOwnOtherwise(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync();
      const [connection] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);

      connection.sendMessages(
        new Request("desktop:1", ShellMethods.recentCommands, new RecentCommandsQuery("d1").toJson()),
        new Request("desktop:2", ShellMethods.recordCommand, new RecentCommandUse("d1", "c1").toJson()),
        new Request("desktop:3", ShellMethods.recordCommand, new RecentCommandUse("d2", "c0").toJson()),
        new Request("desktop:4", ShellMethods.recentCommands, new RecentCommandsQuery("d2").toJson()));
      const [responses] = await RuntimeHostFixture.readMessagesAsync(connection, 4 + 2);

      Assert.areEqual(JSON.stringify({ ids: [] }), JSON.stringify(responses.get("desktop:1")?.payload));
      Assert.areEqual(JSON.stringify({ ids: ["c0"] }), JSON.stringify(responses.get("desktop:4")?.payload));
    });
  }
}
