/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { BuildIdentity, ModuleStatusList, QualifiedName, Request, ShellMethods, StopPolicy, StopRequest } from "@noldova/teamrun-shell-protocol";
import { DataDirectoryOwnedException, DeclarationsFormatException, OwnershipLock, RuntimeBuild, RuntimeHost, RuntimeOptions } from "@noldova/teamrun-shell-runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";

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
      Assert.isTrue(existsSync(path.join(root, "shell.sqlite")));
      Assert.isFalse(existsSync(path.join(root, "teamrun.db")));
      const moved = (await readdir(fixture.root)).filter(t => t.startsWith("data-before-shell-"));
      Assert.areEqual(1, moved.length);
      Assert.areEqual("teamrun.db", (await readdir(path.join(fixture.root, String(moved[0])))).join(","));
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

      await Assert.throwsAsync(() => RuntimeHost.startAsync(new RuntimeOptions(fixture.dataDirectory), otherPlatform, {}, new TextOutputFixture()), Error);

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
      Assert.isTrue(fixture.diagnostics.text.startsWith("The module broken: Its runtime part could not be loaded.\nError [ERR_MODULE_NOT_FOUND]"));
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

  private static async runAsync(test: (fixture: RuntimeHostFixture) => Promise<void>): Promise<void> {
    await using fixture = await RuntimeHostFixture.createAsync();
    await test(fixture);
  }
}
