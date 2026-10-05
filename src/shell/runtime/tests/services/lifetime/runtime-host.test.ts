/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, writeFileSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import {
  BuildIdentity, Event, FailureCode, NotificationBroadcast, NotificationState, NotificationsQuery, QualifiedName, Request, SettingKey, SettingValue, ShellMethods, StopPolicy, StopRequest
} from "@noldova/teamrun-shell-protocol";
import { DataDirectoryOwnedException, DeclarationsFormatException, OwnershipLock, RuntimeBuild, RuntimeEntry, RuntimeHost, RuntimeOptions } from "@noldova/teamrun-shell-runtime";

import { ProgramFixture } from "../../fixtures/program.fixture.js";
import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class RuntimeHostTests {
  private static readonly OTHER: BuildIdentity = new BuildIdentity(RuntimeBuild.identity.productVersion, BuildIdentity.supportedProtocolVersion, "other-build");
  @TestMethod
  public publishesItselfAndStopsOnRequest(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync();
      const discovery = await fixture.readDiscoveryAsync();

      const [connection, answer] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      Assert.isFalse(host.isIdle);
      connection.sendMessages(new Request("desktop:1", ShellMethods.stop, new StopRequest(StopPolicy.IfIdle).toJson()));

      Assert.areEqual("request", await host.waitForStopAsync());
      Assert.areEqual(process.pid, discovery.processId);
      Assert.areEqual(process.execPath, discovery.executablePath);
      Assert.areEqual(RuntimeBuild.identity.fingerprint, discovery.build);
      Assert.areEqual(host.identity, RuntimeBuild.identity);
      Assert.isFalse(answer.hasFailed);
      Assert.areEqual("{\"kind\":\"Response\",\"id\":\"desktop:1\",\"payload\":null}", await connection.readTextAsync());
      Assert.isFalse(OwnershipLock.isOwned(fixture.dataDirectory));
      Assert.isFalse(existsSync(fixture.dataDirectory.discoveryFile));
      Assert.isTrue(existsSync(path.join(fixture.dataDirectory.root, "shell.sqlite")));
    });
  }

  @TestMethod
  public answersAnotherBuildWithTheFrozenExchange(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync();
      const work = host.work.begin("Indexing the project");
      const identity = JSON.stringify(RuntimeBuild.identity.toJson());

      const [connection, answer] = await fixture.handshakeAsync("other", RuntimeHostTests.OTHER);
      connection.send(
        "{\"kind\":\"Request\",\"id\":\"other:1\",\"method\":\"shell.stop\",\"payload\":{\"policy\":\"IfIdle\"}}\n"
        + "{\"kind\":\"Request\",\"id\":\"other:2\",\"method\":\"shell.moveAside\",\"payload\":null}\n");
      const refused = await connection.readTextAsync();
      const conflict = await connection.readTextAsync();
      connection.send("{\"kind\":\"Request\",\"id\":\"other:3\",\"method\":\"shell.stop\",\"payload\":{\"policy\":\"StopWork\"}}\n");
      const stopped = await connection.readTextAsync();

      Assert.areEqual(
        "{\"kind\":\"Response\",\"id\":\"other:0\",\"failure\":{\"code\":\"BuildMismatch\",\"message\":\"Another build of TeamRun owns this data directory.\","
        + `"details":{"identity":${identity},"executablePath":${JSON.stringify(process.execPath)}}}}`,
        answer.toText());
      Assert.areEqual(
        "{\"kind\":\"Response\",\"id\":\"other:1\",\"failure\":{\"code\":\"Conflict\",\"message\":\"Work is in progress; stopping now would interrupt it.\","
        + "\"details\":{\"descriptions\":[\"Indexing the project\"]}}}",
        conflict);
      Assert.areEqual(
        "{\"kind\":\"Response\",\"id\":\"other:2\",\"failure\":{\"code\":\"BuildMismatch\",\"message\":\"A connection from another build may only ask the runtime to stop.\"}}",
        refused);
      Assert.areEqual("{\"kind\":\"Response\",\"id\":\"other:3\",\"payload\":null}", stopped);
      Assert.isTrue(work.signal.aborted);
      Assert.areEqual("request", await host.waitForStopAsync());
    });
  }

  @TestMethod
  public stopsWhenIdle(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync(50);

      Assert.areEqual("idle", await host.waitForStopAsync());
      Assert.isFalse(OwnershipLock.isOwned(fixture.dataDirectory));
    });
  }

  @TestMethod
  public stopsWhileItHoldsDataFromBeforeTheShellAndLetsGoOfItsFiles(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const root = fixture.dataDirectory.root;
      await mkdir(root, { recursive: true });
      await writeFile(path.join(root, "teamrun.db"), "old data");
      const host = await fixture.startAsync();
      const programs = host.programs.length;

      const [refused, answer] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      refused.sendMessages(new Request("desktop:1", ShellMethods.stop, new StopRequest(StopPolicy.StopWork).toJson()));
      const stopped = await refused.readResponseAsync();
      const reason = await host.waitForStopAsync();

      Assert.areEqual(0, programs);
      Assert.areEqual(FailureCode.PreShellData, answer.failure?.code);
      Assert.isFalse(stopped.hasFailed);
      Assert.areEqual("request", reason);
      Assert.isFalse(OwnershipLock.isOwned(fixture.dataDirectory));
      Assert.isFalse(existsSync(fixture.dataDirectory.discoveryFile));
      Assert.isFalse(existsSync(path.join(root, "shell.sqlite")));
      Assert.areEqual("old data", await readFile(path.join(root, "teamrun.db"), "utf8"));
      await rm(root, { recursive: true });
      Assert.isFalse(existsSync(root));
    });
  }

  @TestMethod
  public refusesAtOnceADirectoryARuntimeOwnsAndServes(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      using lock = OwnershipLock.acquire(fixture.dataDirectory);
      await mkdir(fixture.dataDirectory.discoveryFolder, { recursive: true });
      await writeFile(fixture.dataDirectory.discoveryFile, "{}");
      const started = Date.now();

      await Assert.throwsAsync(() => fixture.startAsync(30_000, undefined, 20_000), DataDirectoryOwnedException);

      Assert.isTrue(Date.now() - started < 20_000, "The start ignored the discovery file and refused only when its takeover time ran out.");
      Assert.isTrue(lock.isHeld);
    });
  }

  @TestMethod
  public takesOverADirectoryOnceARuntimeStoppingWithoutDiscoveryLetsGo(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const lock = OwnershipLock.acquire(fixture.dataDirectory);
      const release = setTimeout(() => lock.release(), 200);

      try {
        await fixture.startAsync(30_000, undefined, 20_000);
      }
      finally {
        clearTimeout(release);
        lock.release();
      }

      Assert.isTrue(OwnershipLock.isOwned(fixture.dataDirectory));
      Assert.isTrue(existsSync(fixture.dataDirectory.discoveryFile));
    });
  }

  @TestMethod
  public leavesADirectoryToAStartingRuntimeOnceItPublishesDiscovery(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      using lock = OwnershipLock.acquire(fixture.dataDirectory);
      await mkdir(fixture.dataDirectory.discoveryFolder, { recursive: true });
      const publish = setTimeout(() => writeFileSync(fixture.dataDirectory.discoveryFile, "{}"), 200);
      const started = Date.now();

      try {
        await Assert.throwsAsync(() => fixture.startAsync(30_000, undefined, 20_000), DataDirectoryOwnedException);
      }
      finally {
        clearTimeout(publish);
      }

      Assert.isTrue(Date.now() - started < 20_000, "The start ignored the discovery file and refused only when its takeover time ran out.");
      Assert.isTrue(lock.isHeld);
    });
  }

  @TestMethod
  public refusesADirectoryWhoseOwnerWithoutDiscoveryHoldsItPastTheTakeoverTime(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      using lock = OwnershipLock.acquire(fixture.dataDirectory);
      const started = Date.now();

      await Assert.throwsAsync(() => fixture.startAsync(30_000, undefined, 400), DataDirectoryOwnedException);

      Assert.isTrue(Date.now() - started >= 400);
      Assert.isTrue(lock.isHeld);
    });
  }

  @TestMethod
  public releasesOwnershipWhenTheDatabaseCannotOpen(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await mkdir(path.join(fixture.dataDirectory.root, "shell.sqlite"), { recursive: true });

      await Assert.throwsAsync(() => fixture.startAsync(), Error);

      Assert.isFalse(OwnershipLock.isOwned(fixture.dataDirectory));
    });
  }

  @TestMethod
  public releasesOwnershipWhenItCannotPublish(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const otherPlatform = process.platform === "win32" ? "linux" : "win32";

      await Assert.throwsAsync(() => RuntimeHost.startAsync(new RuntimeOptions(fixture.dataDirectory), otherPlatform, {}), Error);

      Assert.isFalse(OwnershipLock.isOwned(fixture.dataDirectory));
      Assert.isFalse(existsSync(fixture.dataDirectory.discoveryFile));
    });
  }

  @TestMethod
  public reportsAStopThatFails(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync();
      await rm(fixture.dataDirectory.discoveryFile);
      await mkdir(fixture.dataDirectory.discoveryFile);

      host.requestStop("first");
      host.requestStop("second");

      await Assert.throwsAsync(() => host.waitForStopAsync(), Error);
      Assert.isFalse(OwnershipLock.isOwned(fixture.dataDirectory));
      Assert.isTrue((await readFile(fixture.dataDirectory.runtimeLog, "utf8")).includes("EISDIR"), "the stop's failure is in the runtime's log");
    });
  }

  @TestMethod
  public writesItsDiagnosticsToItsLog(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync();

      await new Promise<void>(resolve => host.log.diagnostics.write("The module notes failed.\n", () => resolve()));
      host.requestStop("test");
      await host.waitForStopAsync();

      Assert.isTrue(/^\S+Z The module notes failed\.\n$/.test(await readFile(fixture.dataDirectory.runtimeLog, "utf8")));
    });
  }

  @TestMethod
  public releasesOwnershipWhenItsLogCannotOpen(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await mkdir(fixture.dataDirectory.root, { recursive: true });
      await writeFile(fixture.dataDirectory.logsFolder, "not a folder");

      await Assert.throwsAsync(() => fixture.startAsync(), Error);

      Assert.isFalse(OwnershipLock.isOwned(fixture.dataDirectory));
    });
  }

  @TestMethod
  public removesTheDiscoveryAnEarlierOwnerLeftBeforeItActivatesItsModulesAndListens(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await mkdir(fixture.dataDirectory.discoveryFolder, { recursive: true });
      await writeFile(fixture.dataDirectory.discoveryFile, "{\"token\":\"earlier-token\"}");
      const probed = process.platform === "win32"
        ? [fixture.dataDirectory.discoveryFile]
        : [fixture.dataDirectory.discoveryFile, path.join(fixture.dataDirectory.discoveryFolder, "runtime.sock")];

      const host = await fixture.startAsync(30_000, await fixture.writeModulesAsync([["notes", RuntimeHostTests.createDiscoveryProbePart(probed)]]));
      const discovery = await fixture.readDiscoveryAsync();
      host.requestStop("test");
      await host.waitForStopAsync();

      Assert.areEqual(probed.map(() => "absent").join(","), await readFile(path.join(fixture.dataDirectory.locateModuleFolder("notes"), "probe"), "utf8"));
      Assert.areNotEqual("earlier-token", discovery.token);
      if (process.platform !== "win32")
        Assert.areEqual(probed[1], discovery.endpoint);
    });
  }

  @TestMethod
  public listsTheProgramsItsModulesRunAndEndsThemWhenItStops(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync(30_000, await fixture.writeModulesAsync([["clock", RuntimeHostTests.createProgramPart()]]));

      const programs = host.programs.map(t => `${t.moduleId} ${t.program}`);
      const processId = host.programs[0]?.processId ?? 0;
      host.requestStop("test");
      await host.waitForStopAsync();

      Assert.areEqual(`clock ${process.execPath}`, programs.join(","));
      Assert.isTrue(processId > 0);
      Assert.isFalse(ProgramFixture.isRunning(processId));
      Assert.areEqual(0, host.programs.length);
    });
  }

  @TestMethod
  public followsDoNotDisturbAndMutedModulesFromTheSettingsAcrossARestart(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const declarations = await fixture.writeModulesAsync([["clock", RuntimeHostFixture.createNotificationPart()]]);
      const first = await fixture.startAsync(30_000, declarations);
      const [connection] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const doNotDisturb = (device: string): SettingKey => new SettingKey(QualifiedName.parse("shell.doNotDisturb"), null, device);

      connection.sendMessages(new Request("desktop:1", ShellMethods.setSetting, new SettingValue(doNotDisturb("laptop"), true).toJson()));
      const quiet = [await connection.readEventAsync(), await connection.readEventAsync(), await connection.readResponseAsync()] as const;
      connection.sendMessages(new Request("desktop:2", ShellMethods.setSetting, new SettingValue(new SettingKey(QualifiedName.parse("shell.mutedModules")), ["clock"]).toJson()));
      const muted = [await connection.readEventAsync(), await connection.readEventAsync(), await connection.readResponseAsync()] as const;
      connection.sendMessages(new Request("desktop:3", ShellMethods.setSetting, new SettingValue(new SettingKey(QualifiedName.parse("shell.panelSize"), null, "laptop"), 14).toJson()));
      const unrelated = [await connection.readEventAsync(), await connection.readResponseAsync()] as const;
      first.requestStop("test");
      await first.waitForStopAsync();
      const second = await fixture.startAsync(30_000, declarations);
      const [again] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const laptop = await RuntimeHostFixture.callAsync(again, "desktop:4", ShellMethods.notifications, new NotificationsQuery("laptop").toJson());
      const desk = await RuntimeHostFixture.callAsync(again, "desktop:5", ShellMethods.notifications, new NotificationsQuery("desk").toJson());
      again.sendMessages(new Request("desktop:6", ShellMethods.resetSetting, doNotDisturb("laptop").toJson()));
      const loud = [await again.readEventAsync(), await again.readEventAsync(), await again.readResponseAsync()] as const;
      second.requestStop("test");
      await second.waitForStopAsync();

      const broadcast = (event: Event): NotificationBroadcast => NotificationBroadcast.fromJson(event.payload);
      Assert.areEqual("shell.settingsChanged|laptop||null", `${quiet[0].name.text}|${broadcast(quiet[1]).quietDevices.join(",")}|${broadcast(quiet[1]).mutedModules.join(",")}|${JSON.stringify(quiet[2].payload)}`);
      Assert.areEqual("laptop|clock", `${broadcast(muted[1]).quietDevices.join(",")}|${broadcast(muted[1]).mutedModules.join(",")}`);
      Assert.areEqual("shell.settingsChanged|null", `${unrelated[0].name.text}|${JSON.stringify(unrelated[1].payload)}`);
      Assert.areEqual("true|clock,false|clock", [laptop, desk].map(t => NotificationState.fromJson(t.payload)).map(t => `${String(t.isDoNotDisturb)}|${t.mutedModules.join(",")}`).join(","));
      Assert.areEqual("|clock", `${broadcast(loud[1]).quietDevices.join(",")}|${broadcast(loud[1]).mutedModules.join(",")}`);
    });
  }

  @TestMethod
  public servesAClientThatNeverAsksForModules(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync(30_000, await fixture.writeModulesAsync([["notes", RuntimeHostFixture.PART]]));

      const [connection, answer] = await fixture.handshakeAsync("older", RuntimeBuild.identity);
      connection.send(
        "{\"kind\":\"Request\",\"id\":\"older:1\",\"method\":\"notes.echo\",\"payload\":1}\n"
        + "{\"kind\":\"Request\",\"id\":\"older:2\",\"method\":\"shell.stop\",\"payload\":{\"policy\":\"IfIdle\"}}\n");
      const echoed = await connection.readTextAsync();
      const stopped = await connection.readTextAsync();

      Assert.isFalse(answer.hasFailed);
      Assert.areEqual("{\"kind\":\"Response\",\"id\":\"older:1\",\"payload\":1}", echoed);
      Assert.areEqual("{\"kind\":\"Response\",\"id\":\"older:2\",\"payload\":null}", stopped);
      Assert.areEqual("request", await host.waitForStopAsync());
    });
  }

  @TestMethod
  public activatesItsModulesOnceDataFromBeforeTheShellIsMovedAside(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const declarations = await fixture.writeModulesAsync([["notes", RuntimeHostFixture.PART]]);
      await mkdir(fixture.dataDirectory.root, { recursive: true });
      await writeFile(path.join(fixture.dataDirectory.root, "teamrun.db"), "old data");
      const host = await fixture.startAsync(30_000, declarations);
      const before = host.modules.report.modules.length;

      const [refused] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      refused.sendMessages(new Request("desktop:1", ShellMethods.moveAside, null));
      await refused.readResponseAsync();
      await refused.waitForCloseAsync();
      const [admitted] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      admitted.sendMessages(new Request("desktop:2", new QualifiedName("notes", "echo"), "after"));
      const echoed = await admitted.readResponseAsync();

      Assert.areEqual(0, before);
      Assert.areEqual("\"after\"", JSON.stringify(echoed.payload));
    });
  }

  @TestMethod
  public refusesToStartWithUnreadableDeclarations(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const declarations = path.join(fixture.root, "declarations.json");
      await writeFile(declarations, "{");

      await Assert.throwsAsync(() => fixture.startAsync(30_000, declarations), DeclarationsFormatException);

      Assert.isFalse(existsSync(fixture.dataDirectory.root));
    });
  }

  private static createProgramPart(): string {
    const api = pathToFileURL(path.join(path.dirname(RuntimeEntry.entryPath), "..", "api", "index.js")).href;
    return [
      `import { ProcessRequest } from ${JSON.stringify(api)};`,
      "",
      "export class RuntimePart {",
      "  async activateAsync(context) {",
      `    await context.startProcessAsync(new ProcessRequest(${JSON.stringify(process.execPath)}, [${JSON.stringify(ProgramFixture.file)}, "wait"], ${JSON.stringify(path.dirname(ProgramFixture.file))}));`,
      "  }",
      "",
      "  async deactivateAsync() {",
      "  }",
      "}",
      ""
    ].join("\n");
  }

  private static createDiscoveryProbePart(files: readonly string[]): string {
    return [
      "import { existsSync } from \"node:fs\";",
      "import { mkdir, writeFile } from \"node:fs/promises\";",
      "import path from \"node:path\";",
      "",
      "export class RuntimePart {",
      "  async activateAsync(context) {",
      "    await mkdir(context.moduleFolder, { recursive: true });",
      `    await writeFile(path.join(context.moduleFolder, "probe"), ${JSON.stringify(files)}.map(t => existsSync(t) ? "present" : "absent").join(","));`,
      "  }",
      "",
      "  async deactivateAsync() {",
      "  }",
      "}",
      ""
    ].join("\n");
  }
}
