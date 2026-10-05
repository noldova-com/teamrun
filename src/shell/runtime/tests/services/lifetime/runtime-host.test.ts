/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, writeFileSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import {
  BuildIdentity, CommandList, CommandRun, Event, FailureCode, ModuleStatusList, NotificationBroadcast, NotificationPost, NotificationReference, NotificationSeverity,
  NotificationState, NotificationUpdate, NotificationsQuery, QualifiedName, RecentCommandUse, RecentCommands, RecentCommandsQuery, Request, Response, SettingKey, SettingValue, SettingsQuery, SettingsSnapshot, ShellMethods, StopPolicy, StopRequest,
  WindowStateKey, WindowStateWrite, WireDecoder
} from "@noldova/teamrun-shell-protocol";
import { DataDirectoryOwnedException, DeclarationsFormatException, OwnershipLock, RuntimeBuild, RuntimeEntry, RuntimeHost, RuntimeOptions } from "@noldova/teamrun-shell-runtime";

import { ProgramFixture } from "../../fixtures/program.fixture.js";
import type { RawConnectionFixture } from "../../fixtures/raw-connection.fixture.js";
import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class RuntimeHostTests {
  private static readonly OTHER: BuildIdentity = new BuildIdentity(RuntimeBuild.identity.productVersion, BuildIdentity.supportedProtocolVersion, "other-build");
  private static readonly PART: string = [
    "import { mkdir, writeFile } from \"node:fs/promises\";",
    "import path from \"node:path\";",
    "",
    "export class RuntimePart {",
    "  async activateAsync(context) {",
    "    this.folder = context.moduleFolder;",
    "    context.registerMethod(`${context.moduleId}.echo`, { handleAsync: async request => request.payload });",
    "  }",
    "",
    "  async deactivateAsync() {",
    "    await mkdir(this.folder, { recursive: true });",
    "    await writeFile(path.join(this.folder, \"deactivated\"), \"yes\");",
    "  }",
    "}",
    ""
  ].join("\n");

  @TestMethod
  public publishesItselfAndStopsOnRequest(): Promise<void> {
    return RuntimeHostTests.runAsync(async fixture => {
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
    return RuntimeHostTests.runAsync(async fixture => {
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
  public listsTheWorkInProgressWithoutStopping(): Promise<void> {
    return RuntimeHostTests.runAsync(async fixture => {
      const host = await fixture.startAsync();
      const [connection] = await fixture.handshakeAsync("cli", RuntimeBuild.identity);

      connection.sendMessages(new Request("cli:1", ShellMethods.work, null));
      const idle = await connection.readTextAsync();
      const work = host.work.begin("Indexing the project");
      const began = await connection.readTextAsync();
      connection.sendMessages(new Request("cli:2", ShellMethods.work, null));
      const busy = await connection.readTextAsync();
      work[Symbol.dispose]();
      const ended = await connection.readTextAsync();
      connection.sendMessages(new Request("cli:3", ShellMethods.stop, new StopRequest(StopPolicy.IfIdle).toJson()));

      Assert.areEqual("{\"kind\":\"Response\",\"id\":\"cli:1\",\"payload\":{\"descriptions\":[],\"sequence\":0}}", idle);
      Assert.areEqual("{\"kind\":\"Event\",\"name\":\"shell.work\",\"payload\":{\"descriptions\":[\"Indexing the project\"],\"sequence\":1}}", began);
      Assert.areEqual("{\"kind\":\"Response\",\"id\":\"cli:2\",\"payload\":{\"descriptions\":[\"Indexing the project\"],\"sequence\":1}}", busy);
      Assert.areEqual("{\"kind\":\"Event\",\"name\":\"shell.work\",\"payload\":{\"descriptions\":[],\"sequence\":2}}", ended);
      Assert.isFalse(work.signal.aborted);
      Assert.areEqual("request", await host.waitForStopAsync());
    });
  }

  @TestMethod
  public stopsWhenIdle(): Promise<void> {
    return RuntimeHostTests.runAsync(async fixture => {
      const host = await fixture.startAsync(50);

      Assert.areEqual("idle", await host.waitForStopAsync());
      Assert.isFalse(OwnershipLock.isOwned(fixture.dataDirectory));
    });
  }

  @TestMethod
  public refusesUntilDataFromBeforeTheShellIsMovedAside(): Promise<void> {
    return RuntimeHostTests.runAsync(async fixture => {
      const root = fixture.dataDirectory.root;
      await mkdir(root, { recursive: true });
      await writeFile(path.join(root, "teamrun.db"), "old data");
      await fixture.startAsync();
      const expected = `{"code":"PreShellData","message":"This data directory holds data from a TeamRun release that predates the shell; move it aside to continue.","details":{"location":${JSON.stringify(root)}}}`;

      const [refused, answer] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      refused.sendMessages(
        new Request("desktop:1", new QualifiedName("notes", "open"), null),
        new Request("desktop:2", ShellMethods.moveAside, null),
        new Request("desktop:3", ShellMethods.moveAside, null));
      const responses = [await refused.readResponseAsync(), await refused.readResponseAsync(), await refused.readResponseAsync()];
      await refused.waitForCloseAsync();
      const [admitted, admission] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      admitted.sendMessages(new Request("desktop:4", ShellMethods.moveAside, null));
      const again = await admitted.readResponseAsync();

      Assert.areEqual(expected, JSON.stringify(answer.failure?.toJson()));
      Assert.areEqual(expected, JSON.stringify(responses[0]?.failure?.toJson()));
      Assert.areEqual("desktop:2,desktop:3", responses.slice(1).map(t => t.id).sort().join(","));
      Assert.isFalse(responses.slice(1).some(t => t.hasFailed));
      Assert.isFalse(admission.hasFailed);
      Assert.isFalse(again.hasFailed);
      admitted.sendMessages(new Request("desktop:5", ShellMethods.readWindowBounds, new WindowStateKey("device-1", "main").toJson()));
      Assert.areEqual("{\"value\":null}", JSON.stringify((await admitted.readResponseAsync()).payload));
      Assert.isTrue(existsSync(path.join(root, "shell.sqlite")));
      Assert.isFalse(existsSync(path.join(root, "teamrun.db")));
      const moved = (await readdir(fixture.root)).filter(t => t.startsWith("data-before-shell-"));
      Assert.areEqual(1, moved.length);
      Assert.areEqual("teamrun.db", (await readdir(path.join(fixture.root, String(moved[0])))).join(","));
    });
  }

  @TestMethod
  public stopsWhileItHoldsDataFromBeforeTheShellAndLetsGoOfItsFiles(): Promise<void> {
    return RuntimeHostTests.runAsync(async fixture => {
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
  public keepsEachWindowsBoundsAndLayoutForItsDevice(): Promise<void> {
    return RuntimeHostTests.runAsync(async fixture => {
      await fixture.startAsync();
      const [connection] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const main = new WindowStateKey("device-1", "main");
      const other = new WindowStateKey("device-2", "main");

      connection.sendMessages(
        new Request("desktop:1", ShellMethods.readWindowBounds, main.toJson()),
        new Request("desktop:2", ShellMethods.writeWindowBounds, new WindowStateWrite(main, { width: 1000, height: 700 }).toJson()),
        new Request("desktop:3", ShellMethods.writeWindowLayout, new WindowStateWrite(main, { version: 1 }).toJson()),
        new Request("desktop:4", ShellMethods.writeWindowBounds, new WindowStateWrite(main, { width: 1100, height: 700 }).toJson()),
        new Request("desktop:5", ShellMethods.readWindowBounds, main.toJson()),
        new Request("desktop:6", ShellMethods.readWindowLayout, main.toJson()),
        new Request("desktop:7", ShellMethods.readWindowBounds, other.toJson()),
        new Request("desktop:8", ShellMethods.writeWindowLayout, { device: "device-1", window: "main" }));
      const responses = await RuntimeHostTests.readResponsesAsync(connection, 8);

      Assert.areEqual("{\"value\":null}", JSON.stringify(responses.get("desktop:1")?.payload));
      Assert.areEqual("{\"value\":{\"width\":1100,\"height\":700}}", JSON.stringify(responses.get("desktop:5")?.payload));
      Assert.areEqual("{\"value\":{\"version\":1}}", JSON.stringify(responses.get("desktop:6")?.payload));
      Assert.areEqual("{\"value\":null}", JSON.stringify(responses.get("desktop:7")?.payload));
      Assert.areEqual("InvalidParams", responses.get("desktop:8")?.failure?.code);
      Assert.isFalse(["desktop:2", "desktop:3", "desktop:4"].some(t => responses.get(t)?.hasFailed === true));
    });
  }

  @TestMethod
  public keepsWindowStateAcrossRuntimes(): Promise<void> {
    return RuntimeHostTests.runAsync(async fixture => {
      const first = await fixture.startAsync();
      const [writer] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const key = new WindowStateKey("device-1", "main");
      writer.sendMessages(new Request("desktop:1", ShellMethods.writeWindowBounds, new WindowStateWrite(key, { width: 900, height: 600 }).toJson()));
      await writer.readResponseAsync();
      first.requestStop("test");
      await first.waitForStopAsync();

      await fixture.startAsync();
      const [reader] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      reader.sendMessages(new Request("desktop:2", ShellMethods.readWindowBounds, key.toJson()));

      Assert.areEqual("{\"value\":{\"width\":900,\"height\":600}}", JSON.stringify((await reader.readResponseAsync()).payload));
    });
  }

  @TestMethod
  public keepsEachDevicesTwentyNewestCommandsNewestFirstAndPublishesEachUse(): Promise<void> {
    return RuntimeHostTests.runAsync(async fixture => {
      await fixture.startAsync();
      const [connection] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const uses = [...Array.from({ length: 22 }, (_, index) => `c${index}`), "c5"];

      connection.sendMessages(
        new Request("desktop:0", ShellMethods.recentCommands, new RecentCommandsQuery("d1").toJson()),
        ...uses.map((t, index) => new Request(`desktop:${index + 1}`, ShellMethods.recordCommand, new RecentCommandUse("d1", t).toJson())),
        new Request("desktop:24", ShellMethods.recordCommand, new RecentCommandUse("d2", "c0").toJson()),
        new Request("desktop:25", ShellMethods.recentCommands, new RecentCommandsQuery("d1").toJson()),
        new Request("desktop:26", ShellMethods.recentCommands, new RecentCommandsQuery("d2").toJson()),
        new Request("desktop:27", ShellMethods.recordCommand, { device: "d1" }));
      const [responses, events] = await RuntimeHostTests.readMessagesAsync(connection, 28 + 24);
      const expected = ["c5", "c21", "c20", "c19", "c18", "c17", "c16", "c15", "c14", "c13", "c12", "c11", "c10", "c9", "c8", "c7", "c6", "c4", "c3", "c2"];

      Assert.areEqual(JSON.stringify({ ids: [] }), JSON.stringify(responses.get("desktop:0")?.payload));
      Assert.areEqual(JSON.stringify({ ids: expected }), JSON.stringify(responses.get("desktop:25")?.payload));
      Assert.areEqual(JSON.stringify({ ids: ["c0"] }), JSON.stringify(responses.get("desktop:26")?.payload));
      Assert.areEqual("InvalidParams", responses.get("desktop:27")?.failure?.code);
      Assert.areEqual(24, events.filter(t => t.name.text === "shell.recentCommandsChanged").length);
      Assert.areEqual(JSON.stringify({ ids: ["c0"], device: "d2" }), JSON.stringify(events.at(-1)?.payload));
      Assert.areEqual(JSON.stringify({ ids: expected, device: "d1" }), JSON.stringify(events.at(-2)?.payload));
    });
  }

  @TestMethod
  public keepsRecentCommandsAcrossRuntimes(): Promise<void> {
    return RuntimeHostTests.runAsync(async fixture => {
      const first = await fixture.startAsync();
      const [writer] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      writer.sendMessages(
        new Request("desktop:1", ShellMethods.recordCommand, new RecentCommandUse("d1", "notes.newNote").toJson()),
        new Request("desktop:2", ShellMethods.recordCommand, new RecentCommandUse("d1", "shell.openSettings").toJson()));
      await RuntimeHostTests.readMessagesAsync(writer, 4);
      first.requestStop("test");
      await first.waitForStopAsync();

      await fixture.startAsync();
      const [reader] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      reader.sendMessages(new Request("desktop:3", ShellMethods.recentCommands, new RecentCommandsQuery("d1").toJson()));

      Assert.areEqual("shell.openSettings,notes.newNote", RecentCommands.fromJson((await reader.readResponseAsync()).payload).ids.join(","));
    });
  }

  @TestMethod
  public refusesAtOnceADirectoryARuntimeOwnsAndServes(): Promise<void> {
    return RuntimeHostTests.runAsync(async fixture => {
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
    return RuntimeHostTests.runAsync(async fixture => {
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
    return RuntimeHostTests.runAsync(async fixture => {
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
    return RuntimeHostTests.runAsync(async fixture => {
      using lock = OwnershipLock.acquire(fixture.dataDirectory);
      const started = Date.now();

      await Assert.throwsAsync(() => fixture.startAsync(30_000, undefined, 400), DataDirectoryOwnedException);

      Assert.isTrue(Date.now() - started >= 400);
      Assert.isTrue(lock.isHeld);
    });
  }

  @TestMethod
  public releasesOwnershipWhenTheDatabaseCannotOpen(): Promise<void> {
    return RuntimeHostTests.runAsync(async fixture => {
      await mkdir(path.join(fixture.dataDirectory.root, "shell.sqlite"), { recursive: true });

      await Assert.throwsAsync(() => fixture.startAsync(), Error);

      Assert.isFalse(OwnershipLock.isOwned(fixture.dataDirectory));
    });
  }

  @TestMethod
  public releasesOwnershipWhenItCannotPublish(): Promise<void> {
    return RuntimeHostTests.runAsync(async fixture => {
      const otherPlatform = process.platform === "win32" ? "linux" : "win32";

      await Assert.throwsAsync(() => RuntimeHost.startAsync(new RuntimeOptions(fixture.dataDirectory), otherPlatform, {}), Error);

      Assert.isFalse(OwnershipLock.isOwned(fixture.dataDirectory));
      Assert.isFalse(existsSync(fixture.dataDirectory.discoveryFile));
    });
  }

  @TestMethod
  public reportsAStopThatFails(): Promise<void> {
    return RuntimeHostTests.runAsync(async fixture => {
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
    return RuntimeHostTests.runAsync(async fixture => {
      const host = await fixture.startAsync();

      await new Promise<void>(resolve => host.log.diagnostics.write("The module notes failed.\n", () => resolve()));
      host.requestStop("test");
      await host.waitForStopAsync();

      Assert.isTrue(/^\S+Z The module notes failed\.\n$/.test(await readFile(fixture.dataDirectory.runtimeLog, "utf8")));
    });
  }

  @TestMethod
  public releasesOwnershipWhenItsLogCannotOpen(): Promise<void> {
    return RuntimeHostTests.runAsync(async fixture => {
      await mkdir(fixture.dataDirectory.root, { recursive: true });
      await writeFile(fixture.dataDirectory.logsFolder, "not a folder");

      await Assert.throwsAsync(() => fixture.startAsync(), Error);

      Assert.isFalse(OwnershipLock.isOwned(fixture.dataDirectory));
    });
  }

  @TestMethod
  public activatesItsModulesAndReportsThemToAClientThatAsks(): Promise<void> {
    return RuntimeHostTests.runAsync(async fixture => {
      const declarations = await fixture.writeModulesAsync([["notes", RuntimeHostTests.PART], ["broken", null]]);
      const host = await fixture.startAsync(30_000, declarations);

      const [connection] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      connection.sendMessages(new Request("desktop:1", new QualifiedName("notes", "echo"), { text: "hi" }), new Request("desktop:2", ShellMethods.modules, null));
      const responses = [await connection.readResponseAsync(), await connection.readResponseAsync()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
      connection.sendMessages(new Request("desktop:3", ShellMethods.stop, new StopRequest(StopPolicy.IfIdle).toJson()));
      await host.waitForStopAsync();

      Assert.areEqual("{\"text\":\"hi\"}", JSON.stringify(responses[0]?.payload));
      Assert.areEqual(
        "notes notes Active null,broken broken Failed Its runtime part could not be loaded.",
        ModuleStatusList.fromJson(responses[1]?.payload).modules.map(t => `${t.id} ${t.description} ${t.state} ${t.cause}`).join(","));
      Assert.isTrue(existsSync(path.join(fixture.dataDirectory.locateModuleFolder("notes"), "deactivated")));
      Assert.isTrue(/^\S+Z The module broken 0\.0\.1: Its runtime part could not be loaded\.\nError \[ERR_MODULE_NOT_FOUND\]/.test(await readFile(fixture.dataDirectory.runtimeLog, "utf8")));
    });
  }

  @TestMethod
  public removesTheDiscoveryAnEarlierOwnerLeftBeforeItActivatesItsModulesAndListens(): Promise<void> {
    return RuntimeHostTests.runAsync(async fixture => {
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
    return RuntimeHostTests.runAsync(async fixture => {
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
  public reportsAModulesWorkAndStopsItOnlyWhenAskedToStopTheWork(): Promise<void> {
    return RuntimeHostTests.runAsync(async fixture => {
      const host = await fixture.startAsync(30_000, await fixture.writeModulesAsync([["clock", RuntimeHostTests.createWorkPart()]]));
      const [connection] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);

      connection.sendMessages(new Request("desktop:1", ShellMethods.runCommand, new CommandRun(QualifiedName.parse("clock.tick"), null).toJson()));
      const began = [await connection.readEventAsync(), await connection.readResponseAsync()] as const;
      const refused = await RuntimeHostTests.callAsync(connection, "desktop:2", ShellMethods.stop, new StopRequest(StopPolicy.IfIdle).toJson());
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
  public listsAndRunsItsModulesCommands(): Promise<void> {
    return RuntimeHostTests.runAsync(async fixture => {
      const host = await fixture.startAsync(30_000, await fixture.writeModulesAsync([["clock", RuntimeHostTests.createCommandPart()]]));
      const [connection] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);

      const listed = await RuntimeHostTests.callAsync(connection, "desktop:1", ShellMethods.commands, null);
      const ran = await RuntimeHostTests.callAsync(connection, "desktop:2", ShellMethods.runCommand, new CommandRun(QualifiedName.parse("clock.tick"), { by: 2 }).toJson());
      const missing = await RuntimeHostTests.callAsync(connection, "desktop:3", ShellMethods.runCommand, new CommandRun(QualifiedName.parse("clock.reset"), null).toJson());
      const invalid = await RuntimeHostTests.callAsync(connection, "desktop:4", ShellMethods.runCommand, { name: "clock.tick" });
      connection.sendMessages(new Request("desktop:5", ShellMethods.runCommand, new CommandRun(QualifiedName.parse("clock.pause"), null).toJson()));
      const changes = [await connection.readEventAsync(), await connection.readEventAsync()];
      const paused = await connection.readResponseAsync();
      const refused = await RuntimeHostTests.callAsync(connection, "desktop:6", ShellMethods.runCommand, new CommandRun(QualifiedName.parse("clock.tick"), null).toJson());
      host.requestStop("test");
      await host.waitForStopAsync();

      Assert.areEqual(
        "{\"commands\":[{\"name\":\"clock.tick\",\"title\":\"Tick\",\"icon\":\"timer\",\"defaultKey\":\"Mod+Alt+T\"},{\"name\":\"clock.pause\",\"title\":\"Pause\",\"isChecked\":false}],\"sequence\":2}",
        JSON.stringify(CommandList.fromJson(listed.payload).toJson()));
      Assert.areEqual("{\"client\":\"desktop\",\"arguments\":{\"by\":2}}", JSON.stringify(ran.payload));
      Assert.areEqual(FailureCode.NotFound, missing.failure?.code);
      Assert.areEqual("The command clock.reset is not registered; its module may not be active.", missing.failure?.message);
      Assert.areEqual(FailureCode.InvalidParams, invalid.failure?.code);
      Assert.areEqual("shell.commandsChanged,shell.commandsChanged", changes.map(t => t.name.text).join(","));
      Assert.areEqual([
        "{\"commands\":[{\"name\":\"clock.tick\",\"title\":\"Tick\",\"icon\":\"timer\",\"defaultKey\":\"Mod+Alt+T\"},{\"name\":\"clock.pause\",\"title\":\"Pause\",\"isChecked\":true}],\"sequence\":3}",
        "{\"commands\":[{\"name\":\"clock.tick\",\"title\":\"Tick\",\"icon\":\"timer\",\"defaultKey\":\"Mod+Alt+T\",\"isEnabled\":false},{\"name\":\"clock.pause\",\"title\":\"Pause\",\"isChecked\":true}],\"sequence\":4}"
      ].join("|"), changes.map(t => JSON.stringify(t.payload)).join("|"));
      Assert.isFalse(paused.hasFailed);
      Assert.areEqual(FailureCode.Unavailable, refused.failure?.code);
      Assert.areEqual("The command clock.tick is not enabled now.", refused.failure?.message);
    });
  }

  @TestMethod
  public listsPostsUpdatesAndDismissesNotificationsAndReportsEachChange(): Promise<void> {
    return RuntimeHostTests.runAsync(async fixture => {
      const host = await fixture.startAsync(30_000, await fixture.writeModulesAsync([["clock", RuntimeHostTests.createNotificationPart()]]));
      const [connection] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const alarm = (title: string, kind: string = "clock.alarm"): NotificationPost =>
        new NotificationPost(QualifiedName.parse(kind), "window", title, null, NotificationSeverity.Warning, null, [], null);

      const listed = await RuntimeHostTests.callAsync(connection, "desktop:1", ShellMethods.notifications, new NotificationsQuery("laptop").toJson());
      connection.sendMessages(new Request("desktop:2", ShellMethods.postNotification, alarm("Posted").toJson()));
      const posted = [await connection.readEventAsync(), await connection.readResponseAsync()] as const;
      connection.sendMessages(new Request("desktop:3", ShellMethods.updateNotification, new NotificationUpdate(2, alarm("Updated")).toJson()));
      const updated = [await connection.readEventAsync(), await connection.readResponseAsync()] as const;
      const missing = await RuntimeHostTests.callAsync(connection, "desktop:4", ShellMethods.updateNotification, new NotificationUpdate(9, alarm("Gone")).toJson());
      const otherKind = await RuntimeHostTests.callAsync(connection, "desktop:11", ShellMethods.updateNotification, new NotificationUpdate(1, alarm("Other", "clock.other")).toJson());
      const foreign = new NotificationPost(
        QualifiedName.parse("clock.alarm"), "window", "Foreign", null, NotificationSeverity.Info, new CommandRun(QualifiedName.parse("calendar.show"), null), [], null);
      const foreignUpdate = await RuntimeHostTests.callAsync(connection, "desktop:12", ShellMethods.updateNotification, new NotificationUpdate(1, foreign).toJson());
      const undeclared = await RuntimeHostTests.callAsync(connection, "desktop:6", ShellMethods.postNotification, alarm("Other", "clock.other").toJson());
      const absent = await RuntimeHostTests.callAsync(connection, "desktop:7", ShellMethods.postNotification, alarm("Due", "calendar.due").toJson());
      const invalid = await RuntimeHostTests.callAsync(connection, "desktop:8", ShellMethods.postNotification, { kind: "clock.alarm" });
      connection.sendMessages(new Request("desktop:9", ShellMethods.dismissNotification, new NotificationReference(2).toJson()));
      const dismissed = [await connection.readEventAsync(), await connection.readResponseAsync()] as const;
      const again = await RuntimeHostTests.callAsync(connection, "desktop:10", ShellMethods.dismissNotification, new NotificationReference(2).toJson());
      host.requestStop("test");
      await host.waitForStopAsync();

      const titles = (payload: unknown): string => NotificationBroadcast.fromJson(payload).notifications.map(t => `${t.id}:${t.post.title}`).join(",");
      const state = NotificationState.fromJson(listed.payload);
      Assert.areEqual("1:Synced|false|1", `${state.notifications.map(t => `${t.id}:${t.post.title}`).join(",")}|${String(state.isDoNotDisturb)}|${state.sequence}`);
      Assert.areEqual(
        "shell.notifications|2:Posted,1:Synced|2|{\"id\":2}",
        `${posted[0].name.text}|${titles(posted[0].payload)}|${NotificationBroadcast.fromJson(posted[0].payload).sequence}|${JSON.stringify(posted[1].payload)}`);
      Assert.areEqual("2:Updated,1:Synced|null", `${titles(updated[0].payload)}|${JSON.stringify(updated[1].payload)}`);
      Assert.areEqual(`${FailureCode.NotFound}|Notification 9 is gone; it was dismissed or its module stopped.`, `${missing.failure?.code}|${missing.failure?.message}`);
      Assert.areEqual(`${FailureCode.InvalidParams}|Notification 1 is of the kind clock.alarm, which an update keeps.`, `${otherKind.failure?.code}|${otherKind.failure?.message}`);
      Assert.areEqual(
        `${FailureCode.InvalidParams}|The module clock may not offer the command calendar.show in a notification; it must be its own or a dependency's.`,
        `${foreignUpdate.failure?.code}|${foreignUpdate.failure?.message}`);
      Assert.areEqual(`${FailureCode.InvalidParams}|The module clock does not declare clock.other among its notifications.`, `${undeclared.failure?.code}|${undeclared.failure?.message}`);
      Assert.areEqual("The notification kind calendar.due belongs to calendar, which is not an active module.", absent.failure?.message);
      Assert.areEqual(FailureCode.InvalidParams, invalid.failure?.code);
      Assert.areEqual("1:Synced|null|null", `${titles(dismissed[0].payload)}|${JSON.stringify(dismissed[1].payload)}|${JSON.stringify(again.payload)}`);
    });
  }

  @TestMethod
  public followsDoNotDisturbAndMutedModulesFromTheSettingsAcrossARestartAndMarksReadAndClears(): Promise<void> {
    return RuntimeHostTests.runAsync(async fixture => {
      const declarations = await fixture.writeModulesAsync([["clock", RuntimeHostTests.createNotificationPart()]]);
      const first = await fixture.startAsync(30_000, declarations);
      const [connection] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const doNotDisturb = (device: string): SettingKey => new SettingKey(QualifiedName.parse("shell.doNotDisturb"), null, device);

      connection.sendMessages(new Request("desktop:1", ShellMethods.setSetting, new SettingValue(doNotDisturb("laptop"), true).toJson()));
      const quiet = [await connection.readEventAsync(), await connection.readEventAsync(), await connection.readResponseAsync()] as const;
      connection.sendMessages(new Request("desktop:2", ShellMethods.setSetting, new SettingValue(new SettingKey(QualifiedName.parse("shell.mutedModules")), ["clock"]).toJson()));
      const muted = [await connection.readEventAsync(), await connection.readEventAsync(), await connection.readResponseAsync()] as const;
      connection.sendMessages(new Request("desktop:3", ShellMethods.setSetting, new SettingValue(new SettingKey(QualifiedName.parse("shell.panelSize"), null, "laptop"), 14).toJson()));
      const unrelated = [await connection.readEventAsync(), await connection.readResponseAsync()] as const;
      connection.sendMessages(new Request("desktop:4", ShellMethods.markNotificationsRead, null));
      const read = [await connection.readEventAsync(), await connection.readResponseAsync()] as const;
      connection.sendMessages(new Request("desktop:5", ShellMethods.clearNotifications, null));
      const cleared = [await connection.readEventAsync(), await connection.readResponseAsync()] as const;
      first.requestStop("test");
      await first.waitForStopAsync();
      const second = await fixture.startAsync(30_000, declarations);
      const [again] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const laptop = await RuntimeHostTests.callAsync(again, "desktop:6", ShellMethods.notifications, new NotificationsQuery("laptop").toJson());
      const desk = await RuntimeHostTests.callAsync(again, "desktop:7", ShellMethods.notifications, new NotificationsQuery("desk").toJson());
      again.sendMessages(new Request("desktop:8", ShellMethods.resetSetting, doNotDisturb("laptop").toJson()));
      const loud = [await again.readEventAsync(), await again.readEventAsync(), await again.readResponseAsync()] as const;
      second.requestStop("test");
      await second.waitForStopAsync();

      const broadcast = (event: Event): NotificationBroadcast => NotificationBroadcast.fromJson(event.payload);
      Assert.areEqual("shell.settingsChanged|laptop||null", `${quiet[0].name.text}|${broadcast(quiet[1]).quietDevices.join(",")}|${broadcast(quiet[1]).mutedModules.join(",")}|${JSON.stringify(quiet[2].payload)}`);
      Assert.areEqual("laptop|clock", `${broadcast(muted[1]).quietDevices.join(",")}|${broadcast(muted[1]).mutedModules.join(",")}`);
      Assert.areEqual("shell.settingsChanged|null", `${unrelated[0].name.text}|${JSON.stringify(unrelated[1].payload)}`);
      Assert.areEqual("true", broadcast(read[0]).notifications.map(t => String(t.isRead)).join(","));
      Assert.areEqual("0", String(broadcast(cleared[0]).notifications.length));
      Assert.areEqual("true|clock,false|clock", [laptop, desk].map(t => NotificationState.fromJson(t.payload)).map(t => `${String(t.isDoNotDisturb)}|${t.mutedModules.join(",")}`).join(","));
      Assert.areEqual("|clock", `${broadcast(loud[1]).quietDevices.join(",")}|${broadcast(loud[1]).mutedModules.join(",")}`);
    });
  }

  @TestMethod
  public servesAClientThatNeverAsksForModules(): Promise<void> {
    return RuntimeHostTests.runAsync(async fixture => {
      const host = await fixture.startAsync(30_000, await fixture.writeModulesAsync([["notes", RuntimeHostTests.PART]]));

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
    return RuntimeHostTests.runAsync(async fixture => {
      const declarations = await fixture.writeModulesAsync([["notes", RuntimeHostTests.PART]]);
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
    return RuntimeHostTests.runAsync(async fixture => {
      const declarations = path.join(fixture.root, "declarations.json");
      await writeFile(declarations, "{");

      await Assert.throwsAsync(() => fixture.startAsync(30_000, declarations), DeclarationsFormatException);

      Assert.isFalse(existsSync(fixture.dataDirectory.root));
    });
  }

  @TestMethod
  public answersSettingsAndPublishesTheirChanges(): Promise<void> {
    return RuntimeHostTests.runAsync(async fixture => {
      await fixture.startAsync(30_000, await fixture.writeModulesAsync([]));
      const [connection] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const mode = new SettingKey(QualifiedName.parse("shell.mode"));
      const quiet = new SettingKey(QualifiedName.parse("shell.doNotDisturb"), null, "d1");

      connection.sendMessages(
        new Request("desktop:1", ShellMethods.setSetting, new SettingValue(mode, "Dark").toJson()),
        new Request("desktop:2", ShellMethods.setSetting, new SettingValue(quiet, true).toJson()),
        new Request("desktop:3", ShellMethods.settings, new SettingsQuery("d1").toJson()),
        new Request("desktop:4", ShellMethods.resetSetting, mode.toJson()),
        new Request("desktop:5", ShellMethods.setSetting, new SettingValue(mode, "Blue").toJson()),
        new Request("desktop:6", ShellMethods.setSetting, new SettingValue(new SettingKey(QualifiedName.parse("shell.speed")), 1).toJson()),
        new Request("desktop:7", ShellMethods.resetSetting, new SettingKey(QualifiedName.parse("shell.doNotDisturb")).toJson()));
      const [responses, events] = await RuntimeHostTests.readMessagesAsync(connection, 11);
      const snapshot = SettingsSnapshot.fromJson(responses.get("desktop:3")?.payload);
      const changes = events.filter(t => t.name.text === "shell.settingsChanged");
      const entry = (name: string): string => JSON.stringify(snapshot.entries.find(t => t.name.text === name)?.toJson());

      Assert.isTrue(["desktop:1", "desktop:2", "desktop:4"].every(t => responses.get(t)?.hasFailed === false));
      Assert.areEqual("{\"name\":\"shell.mode\",\"value\":\"Dark\",\"isSet\":true}", entry("shell.mode"));
      Assert.areEqual("{\"name\":\"shell.doNotDisturb\",\"value\":true,\"isSet\":true}", entry("shell.doNotDisturb"));
      Assert.areEqual("shell.theme,shell.mode,shell.interfaceFont,shell.codeFont,shell.panelSize,shell.messageSize,shell.codeSize,shell.leftDockStyle,shell.rightDockStyle,shell.menuBar,shell.previewTabs,shell.recentCommandCount,shell.doNotDisturb,shell.mutedModules,shell.keyBindings",
        snapshot.definitions.map(t => t.name.text).join(","));
      Assert.areEqual("InvalidParams,NotFound,InvalidParams", ["desktop:5", "desktop:6", "desktop:7"].map(t => responses.get(t)?.failure?.code).join(","));
      Assert.areEqual(JSON.stringify([
        "{\"name\":\"shell.mode\",\"value\":\"Dark\",\"isSet\":true}",
        "{\"name\":\"shell.doNotDisturb\",\"device\":\"d1\",\"value\":true,\"isSet\":true}",
        "{\"name\":\"shell.mode\",\"value\":\"System\",\"isSet\":false}"
      ]), JSON.stringify(changes.map(t => JSON.stringify(t.payload))));
      Assert.areEqual("shell.settingsChanged,shell.settingsChanged,shell.notifications,shell.settingsChanged", events.map(t => t.name.text).join(","));
    });
  }

  private static async readMessagesAsync(connection: RawConnectionFixture, count: number): Promise<[Map<string, Response>, Event[]]> {
    const responses = new Map<string, Response>();
    const events: Event[] = [];
    for (let index = 0; index < count; index++) {
      const message = new WireDecoder().decode(await connection.readTextAsync());
      if (message instanceof Response)
        responses.set(String(message.id), message);
      else if (message instanceof Event)
        events.push(message);
    }
    return [responses, events];
  }

  private static async readResponsesAsync(connection: RawConnectionFixture, count: number): Promise<Map<string, Response>> {
    const responses = new Map<string, Response>();
    for (let index = 0; index < count; index++) {
      const response = await connection.readResponseAsync();
      responses.set(String(response.id), response);
    }
    return responses;
  }

  private static async callAsync(connection: RawConnectionFixture, id: string, method: QualifiedName, payload: JsonValue): Promise<Response> {
    connection.sendMessages(new Request(id, method, payload));
    return await connection.readResponseAsync();
  }

  private static createNotificationPart(): string {
    const protocol = import.meta.resolve("@noldova/teamrun-shell-protocol");
    return [
      `import { CommandRun, NotificationAction, NotificationPost, QualifiedName } from ${JSON.stringify(protocol)};`,
      "",
      "export class RuntimePart {",
      "  async activateAsync(context) {",
      "    const tick = new NotificationAction(\"Tick\", new CommandRun(QualifiedName.parse(\"clock.tick\"), null));",
      "    context.postNotification(new NotificationPost(QualifiedName.parse(\"clock.alarm\"), null, \"Synced\", null, \"Success\", null, [tick], 1));",
      "  }",
      "",
      "  async deactivateAsync() {",
      "  }",
      "}",
      ""
    ].join("\n");
  }

  private static createCommandPart(): string {
    const api = pathToFileURL(path.join(path.dirname(RuntimeEntry.entryPath), "..", "api", "index.js")).href;
    return [
      `import { RuntimeCommand } from ${JSON.stringify(api)};`,
      "",
      "export class RuntimePart {",
      "  async activateAsync(context) {",
      "    const tick = new RuntimeCommand(\"clock.tick\", \"Tick\", \"timer\", \"Mod+Alt+T\", { handleAsync: async request => ({ client: request.client, arguments: request.payload }) });",
      "    const pause = new RuntimeCommand(\"clock.pause\", \"Pause\", null, null, { handleAsync: async () => {",
      "      pause.setChecked(true);",
      "      tick.setEnabled(false);",
      "      return null;",
      "    } }, false);",
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

  private static createWorkPart(): string {
    const api = pathToFileURL(path.join(path.dirname(RuntimeEntry.entryPath), "..", "api", "index.js")).href;
    return [
      "import { writeFileSync } from \"node:fs\";",
      "import path from \"node:path\";",
      "",
      `import { RuntimeCommand } from ${JSON.stringify(api)};`,
      "",
      "export class RuntimePart {",
      "  async activateAsync(context) {",
      "    context.registerCommand(new RuntimeCommand(\"clock.tick\", \"Tick\", \"timer\", \"Mod+Alt+T\", { handleAsync: async () => {",
      "      const folder = await context.getWorkFolderAsync();",
      "      const work = context.beginWork(\"Ticking\");",
      "      context.log.write(\"Ticking began\");",
      "      work.signal.addEventListener(\"abort\", () => {",
      "        writeFileSync(path.join(folder, \"aborted\"), \"\");",
      "        work[Symbol.dispose]();",
      "      });",
      "      return null;",
      "    } }));",
      "  }",
      "",
      "  async deactivateAsync() {",
      "  }",
      "}",
      ""
    ].join("\n");
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

  private static async runAsync(test: (fixture: RuntimeHostFixture) => Promise<void>): Promise<void> {
    await using fixture = await RuntimeHostFixture.createAsync();
    await test(fixture);
  }
}
