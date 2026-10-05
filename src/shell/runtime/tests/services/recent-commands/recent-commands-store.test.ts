/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { RecentCommandUse, RecentCommands, RecentCommandsQuery, Request, ShellMethods } from "@noldova/teamrun-shell-protocol";
import { RuntimeBuild } from "@noldova/teamrun-shell-runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class RecentCommandsStoreTests {
  @TestMethod
  public keepsRecentCommandsAcrossRuntimes(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const first = await fixture.startAsync();
      const [writer] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      writer.sendMessages(
        new Request("desktop:1", ShellMethods.recordCommand, new RecentCommandUse("d1", "notes.newNote").toJson()),
        new Request("desktop:2", ShellMethods.recordCommand, new RecentCommandUse("d1", "shell.openSettings").toJson()));
      await RuntimeHostFixture.readMessagesAsync(writer, 4);
      first.requestStop("test");
      await first.waitForStopAsync();

      await fixture.startAsync();
      const [reader] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      reader.sendMessages(new Request("desktop:3", ShellMethods.recentCommands, new RecentCommandsQuery("d1").toJson()));

      Assert.areEqual("shell.openSettings,notes.newNote", RecentCommands.fromJson((await reader.readResponseAsync()).payload).ids.join(","));
    });
  }
}
