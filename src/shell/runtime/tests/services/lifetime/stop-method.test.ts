/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { CommandRun, FailureCode, QualifiedName, Request, ShellMethods, StopPolicy, StopRequest } from "@noldova/teamrun-shell-protocol";
import { RuntimeBuild } from "@noldova/teamrun-shell-runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class StopMethodTests {
  @TestMethod
  public reportsAModulesWorkAndStopsItOnlyWhenAskedToStopTheWork(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync(30_000, await fixture.writeModulesAsync([["clock", RuntimeHostFixture.createWorkPart()]]));
      const [connection] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);

      connection.sendMessages(new Request("desktop:1", ShellMethods.runCommand, new CommandRun(QualifiedName.parse("clock.tick"), null).toJson()));
      const began = [await connection.readEventAsync(), await connection.readResponseAsync()] as const;
      const refused = await RuntimeHostFixture.callAsync(connection, "desktop:2", ShellMethods.stop, new StopRequest(StopPolicy.IfIdle).toJson());
      connection.sendMessages(new Request("desktop:3", ShellMethods.stop, new StopRequest(StopPolicy.StopWork).toJson()));
      const ended = [await connection.readEventAsync(), await connection.readResponseAsync()] as const;
      await host.waitForStopAsync();

      Assert.areEqual("shell.work|{\"descriptions\":[\"Ticking\"],\"sequence\":1}|null", `${began[0].name.text}|${JSON.stringify(began[0].payload)}|${JSON.stringify(began[1].payload)}`);
      Assert.areEqual(`${FailureCode.Conflict}|{"descriptions":["Ticking"]}`, `${refused.failure?.code}|${JSON.stringify(refused.failure?.details)}`);
      Assert.areEqual("shell.work|{\"descriptions\":[],\"sequence\":2}|null", `${ended[0].name.text}|${JSON.stringify(ended[0].payload)}|${JSON.stringify(ended[1].payload)}`);
      Assert.isTrue(existsSync(path.join(fixture.dataDirectory.locateWorkFolder("clock"), "aborted")));
      Assert.isTrue((await readFile(fixture.dataDirectory.runtimeLog, "utf8")).includes("clock: Ticking began\n"));
    });
  }

  @TestMethod
  public keepsTheRuntimeAndItsWorkForAClientThatConnectedFirstWhileTheCliStopStaysUnchanged(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync(30_000, await fixture.writeModulesAsync([["clock", RuntimeHostFixture.createWorkPart()]]));
      const [cli] = await fixture.handshakeAsync("cli", RuntimeBuild.identity);
      const [desktop] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);

      desktop.sendMessages(new Request("desktop:1", ShellMethods.runCommand, new CommandRun(QualifiedName.parse("clock.tick"), null).toJson()));
      await RuntimeHostFixture.readMessagesAsync(desktop, 2);
      const kept = await RuntimeHostFixture.callAsync(desktop, "desktop:2", ShellMethods.stop, new StopRequest(StopPolicy.StopWork, true).toJson());
      const descriptions = [...host.work.descriptions];
      cli.sendMessages(new Request("cli:1", ShellMethods.stop, new StopRequest(StopPolicy.StopWork).toJson()));
      const [responses, events] = await RuntimeHostFixture.readMessagesAsync(cli, 3);
      await host.waitForStopAsync();

      Assert.areEqual("{\"keptFor\":1}", JSON.stringify(kept.payload));
      Assert.areEqual("[\"Ticking\"]", JSON.stringify(descriptions));
      Assert.areEqual("null", JSON.stringify(responses.get("cli:1")?.payload));
      Assert.areEqual("[{\"descriptions\":[\"Ticking\"],\"sequence\":1},{\"descriptions\":[],\"sequence\":2}]", JSON.stringify(events.map(t => t.payload)));
      Assert.isTrue(existsSync(path.join(fixture.dataDirectory.locateWorkFolder("clock"), "aborted")));
    });
  }

  @TestMethod
  public appliesThePolicyToAClientAloneAndKeepsTheRuntimeOnceAnotherConnectsEvenOfTheSameName(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync(30_000, await fixture.writeModulesAsync([["clock", RuntimeHostFixture.createWorkPart()]]));
      const [desktop] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);

      desktop.sendMessages(new Request("desktop:1", ShellMethods.runCommand, new CommandRun(QualifiedName.parse("clock.tick"), null).toJson()));
      await RuntimeHostFixture.readMessagesAsync(desktop, 2);
      const refused = await RuntimeHostFixture.callAsync(desktop, "desktop:2", ShellMethods.stop, new StopRequest(StopPolicy.IfIdle, true).toJson());
      await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const kept = await RuntimeHostFixture.callAsync(desktop, "desktop:3", ShellMethods.stop, new StopRequest(StopPolicy.StopWork, true).toJson());
      const descriptions = [...host.work.descriptions];
      desktop.sendMessages(new Request("desktop:4", ShellMethods.stop, new StopRequest(StopPolicy.StopWork).toJson()));
      const [responses] = await RuntimeHostFixture.readMessagesAsync(desktop, 2);
      await host.waitForStopAsync();

      Assert.areEqual(`${FailureCode.Conflict}|{"descriptions":["Ticking"]}`, `${refused.failure?.code}|${JSON.stringify(refused.failure?.details)}`);
      Assert.areEqual("{\"keptFor\":1}", JSON.stringify(kept.payload));
      Assert.areEqual("[\"Ticking\"]", JSON.stringify(descriptions));
      Assert.areEqual("null", JSON.stringify(responses.get("desktop:4")?.payload));
    });
  }
}
