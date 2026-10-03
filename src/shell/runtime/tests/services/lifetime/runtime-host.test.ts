/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import {
  BuildIdentity, CommandList, CommandRun, FailureCode, ModuleStatusList, DoNotDisturbChange, NotificationBroadcast, NotificationPost, NotificationReference, NotificationSeverity, NotificationState, NotificationUpdate, NotificationsQuery, QualifiedName, Request, type Response, ShellMethods, StopPolicy, StopRequest, WindowStateKey, WindowStateWrite
} from "@noldova/teamrun-shell-protocol";
import { DataDirectoryOwnedException, DeclarationsFormatException, OwnershipLock, RuntimeBuild, RuntimeEntry, RuntimeHost, RuntimeOptions } from "@noldova/teamrun-shell-runtime";

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
  public refusesADirectoryAnotherRuntimeOwns(): Promise<void> {
    return RuntimeHostTests.runAsync(async fixture => {
      using lock = OwnershipLock.acquire(fixture.dataDirectory);

      await Assert.throwsAsync(() => fixture.startAsync(), DataDirectoryOwnedException);

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

      Assert.areEqual("The module notes failed.\n", await readFile(fixture.dataDirectory.runtimeLog, "utf8"));
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
        "{\"modules\":[{\"id\":\"notes\",\"state\":\"Active\"},{\"id\":\"broken\",\"state\":\"Failed\",\"cause\":\"Its runtime part could not be loaded.\"}]}",
        JSON.stringify(ModuleStatusList.fromJson(responses[1]?.payload).toJson()));
      Assert.isTrue(existsSync(path.join(fixture.dataDirectory.locateModuleFolder("notes"), "deactivated")));
      Assert.isTrue((await readFile(fixture.dataDirectory.runtimeLog, "utf8")).startsWith("The module broken: Its runtime part could not be loaded.\nError [ERR_MODULE_NOT_FOUND]"));
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
      host.requestStop("test");
      await host.waitForStopAsync();

      Assert.areEqual(
        "{\"commands\":[{\"name\":\"clock.tick\",\"title\":\"Tick\",\"icon\":\"timer\",\"defaultKey\":\"Mod+Alt+T\"}]}",
        JSON.stringify(CommandList.fromJson(listed.payload).toJson()));
      Assert.areEqual("{\"client\":\"desktop\",\"arguments\":{\"by\":2}}", JSON.stringify(ran.payload));
      Assert.areEqual(FailureCode.NotFound, missing.failure?.code);
      Assert.areEqual("The command clock.reset is not registered; its module may not be active.", missing.failure?.message);
      Assert.areEqual(FailureCode.InvalidParams, invalid.failure?.code);
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
      Assert.areEqual("1:Synced|false", `${NotificationState.fromJson(listed.payload).notifications.map(t => `${t.id}:${t.post.title}`).join(",")}|${String(NotificationState.fromJson(listed.payload).isDoNotDisturb)}`);
      Assert.areEqual("shell.notifications|2:Posted,1:Synced|{\"id\":2}", `${posted[0].name.text}|${titles(posted[0].payload)}|${JSON.stringify(posted[1].payload)}`);
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
  public keepsDoNotDisturbPerDeviceAcrossARestartAndMarksReadAndClears(): Promise<void> {
    return RuntimeHostTests.runAsync(async fixture => {
      const declarations = await fixture.writeModulesAsync([["clock", RuntimeHostTests.createNotificationPart()]]);
      const first = await fixture.startAsync(30_000, declarations);
      const [connection] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);

      connection.sendMessages(new Request("desktop:1", ShellMethods.setDoNotDisturb, new DoNotDisturbChange("laptop", true).toJson()));
      const quiet = [await connection.readEventAsync(), await connection.readResponseAsync()] as const;
      connection.sendMessages(new Request("desktop:2", ShellMethods.markNotificationsRead, null));
      const read = [await connection.readEventAsync(), await connection.readResponseAsync()] as const;
      connection.sendMessages(new Request("desktop:3", ShellMethods.clearNotifications, null));
      const cleared = [await connection.readEventAsync(), await connection.readResponseAsync()] as const;
      first.requestStop("test");
      await first.waitForStopAsync();
      const second = await fixture.startAsync(30_000, declarations);
      const [again] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const laptop = await RuntimeHostTests.callAsync(again, "desktop:4", ShellMethods.notifications, new NotificationsQuery("laptop").toJson());
      const desk = await RuntimeHostTests.callAsync(again, "desktop:5", ShellMethods.notifications, new NotificationsQuery("desk").toJson());
      const invalid = await RuntimeHostTests.callAsync(again, "desktop:6", ShellMethods.setDoNotDisturb, { isOn: true });
      again.sendMessages(new Request("desktop:7", ShellMethods.setDoNotDisturb, new DoNotDisturbChange("laptop", false).toJson()));
      const loud = [await again.readEventAsync(), await again.readResponseAsync()] as const;
      second.requestStop("test");
      await second.waitForStopAsync();

      Assert.areEqual("laptop|null", `${NotificationBroadcast.fromJson(quiet[0].payload).quietDevices.join(",")}|${JSON.stringify(quiet[1].payload)}`);
      Assert.areEqual("true", NotificationBroadcast.fromJson(read[0].payload).notifications.map(t => String(t.isRead)).join(","));
      Assert.areEqual("0", String(NotificationBroadcast.fromJson(cleared[0].payload).notifications.length));
      Assert.areEqual("true,false", [NotificationState.fromJson(laptop.payload).isDoNotDisturb, NotificationState.fromJson(desk.payload).isDoNotDisturb].join(","));
      Assert.areEqual("|null", `${NotificationBroadcast.fromJson(loud[0].payload).quietDevices.join(",")}|${JSON.stringify(loud[1].payload)}`);
      Assert.areEqual(FailureCode.InvalidParams, invalid.failure?.code);
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
      "    context.registerCommand(new RuntimeCommand(\"clock.tick\", \"Tick\", \"timer\", \"Mod+Alt+T\", { handleAsync: async request => ({ client: request.client, arguments: request.payload }) }));",
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
