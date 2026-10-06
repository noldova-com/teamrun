/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import { pathToFileURL } from "node:url";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { CommandList, CommandRun, ProgramStatusList, QualifiedName, Request, ShellMethods } from "@noldova/teamrun-shell-protocol";
import { RuntimeBuild, RuntimeEntry } from "@noldova/teamrun-shell-runtime";

import { ProgramFixture } from "../../fixtures/program.fixture.js";
import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class ProgramsMethodTests {
  @TestMethod
  public listsTheProgramsAndPublishesEachChangeInTheOrderItHappensWithTheCommandChanges(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync(30_000, await fixture.writeModulesAsync([["clock", ProgramsMethodTests.createPart()]]));
      const [connection] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);

      const before = await RuntimeHostFixture.callAsync(connection, "desktop:1", ShellMethods.programs, null);
      connection.sendMessages(new Request("desktop:2", ShellMethods.runCommand, new CommandRun(QualifiedName.parse("clock.tick"), null).toJson()));
      const [started, startEvents] = await RuntimeHostFixture.readMessagesAsync(connection, 3);
      const listed = await RuntimeHostFixture.callAsync(connection, "desktop:3", ShellMethods.programs, null);
      connection.sendMessages(new Request("desktop:4", ShellMethods.runCommand, new CommandRun(QualifiedName.parse("clock.pause"), null).toJson()));
      const [stopped, stopEvents] = await RuntimeHostFixture.readMessagesAsync(connection, 2);
      host.requestStop("test");
      await host.waitForStopAsync();
      const processId = Number(started.get("desktop:2")?.payload);
      const describe = (payload: unknown): string => {
        const list = ProgramStatusList.fromJson(payload);
        return [list.sequence, ...list.programs.map(t => `${t.moduleId} ${t.program} ${t.processId} ${t.hasExited}`)].join(" ");
      };

      Assert.areEqual("{\"programs\":[],\"sequence\":0}", JSON.stringify(before.payload));
      Assert.areEqual("shell.programsChanged,shell.commandsChanged", startEvents.map(t => t.name.text).join(","));
      Assert.areEqual(`1 clock ${process.execPath} ${processId} false`, describe(startEvents[0]?.payload));
      Assert.areEqual(3, CommandList.fromJson(startEvents[1]?.payload).sequence);
      Assert.areEqual(JSON.stringify(startEvents[0]?.payload), JSON.stringify(listed.payload));
      Assert.areEqual("shell.programsChanged", stopEvents.map(t => t.name.text).join(","));
      Assert.areEqual("2", describe(stopEvents[0]?.payload));
      Assert.isFalse(stopped.get("desktop:4")?.hasFailed ?? true);
      Assert.isFalse(ProgramFixture.isRunning(processId));
    });
  }

  private static createPart(): string {
    const api = pathToFileURL(path.join(path.dirname(RuntimeEntry.entryPath), "..", "api", "index.js")).href;
    const request = `new ProcessRequest(${JSON.stringify(process.execPath)}, [${JSON.stringify(ProgramFixture.file)}, ${JSON.stringify(ProgramFixture.WAIT)}], ${JSON.stringify(path.dirname(ProgramFixture.file))})`;
    return [
      `import { ProcessRequest, RuntimeCommand } from ${JSON.stringify(api)};`,
      "",
      "export class RuntimePart {",
      "  async activateAsync(context) {",
      "    let owned = null;",
      "    const tick = new RuntimeCommand(\"clock.tick\", \"Start\", null, null, { handleAsync: async () => {",
      `      owned = await context.startProcessAsync(${request});`,
      "      tick.setEnabled(false);",
      "      return owned.processId;",
      "    } });",
      "    const pause = new RuntimeCommand(\"clock.pause\", \"Stop\", null, null, { handleAsync: async () => {",
      "      await owned.stopAsync();",
      "      return null;",
      "    } });",
      "    context.registerCommand(tick);",
      "    context.registerCommand(pause);",
      "  }",
      "",
      "  async deactivateAsync() {",
      "  }",
      "}",
      ""
    ].join("\n");
  }
}
