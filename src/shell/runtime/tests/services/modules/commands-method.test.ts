/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { CommandList, CommandRun, QualifiedName, Request, ShellMethods } from "@noldova/teamrun-shell-protocol";
import { RuntimeBuild } from "@noldova/teamrun-shell-runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class CommandsMethodTests {
  @TestMethod
  public listsItsModulesCommandsAndPublishesEachChange(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync(30_000, await fixture.writeModulesAsync([["clock", RuntimeHostFixture.createCommandPart()]]));
      const [connection] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);

      const listed = await RuntimeHostFixture.callAsync(connection, "desktop:1", ShellMethods.commands, null);
      connection.sendMessages(new Request("desktop:2", ShellMethods.runCommand, new CommandRun(QualifiedName.parse("clock.pause"), null).toJson()));
      const changes = [await connection.readEventAsync(), await connection.readEventAsync()];
      const paused = await connection.readResponseAsync();
      host.requestStop("test");
      await host.waitForStopAsync();

      Assert.areEqual(
        "{\"commands\":[{\"name\":\"clock.tick\",\"title\":\"Tick\",\"icon\":\"timer\",\"defaultKey\":\"Mod+Alt+T\"},{\"name\":\"clock.pause\",\"title\":\"Pause\",\"isChecked\":false}],\"sequence\":2}",
        JSON.stringify(CommandList.fromJson(listed.payload).toJson()));
      Assert.areEqual("shell.commandsChanged,shell.commandsChanged", changes.map(t => t.name.text).join(","));
      Assert.areEqual([
        "{\"commands\":[{\"name\":\"clock.tick\",\"title\":\"Tick\",\"icon\":\"timer\",\"defaultKey\":\"Mod+Alt+T\"},{\"name\":\"clock.pause\",\"title\":\"Pause\",\"isChecked\":true}],\"sequence\":3}",
        "{\"commands\":[{\"name\":\"clock.tick\",\"title\":\"Tick\",\"icon\":\"timer\",\"defaultKey\":\"Mod+Alt+T\",\"isEnabled\":false},{\"name\":\"clock.pause\",\"title\":\"Pause\",\"isChecked\":true}],\"sequence\":4}"
      ].join("|"), changes.map(t => JSON.stringify(t.payload)).join("|"));
      Assert.isFalse(paused.hasFailed);
    });
  }
}
