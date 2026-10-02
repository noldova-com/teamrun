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
import { BuildIdentity, QualifiedName, Request, ShellMethods, StopPolicy, StopRequest } from "@noldova/teamrun-shell-protocol";
import { DataDirectoryOwnedException, OwnershipLock, RuntimeBuild, RuntimeHost, RuntimeOptions } from "@noldova/teamrun-shell-runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class RuntimeHostTests {
  private static readonly OTHER: BuildIdentity = new BuildIdentity(RuntimeBuild.identity.productVersion, BuildIdentity.supportedProtocolVersion, "other-build");

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
    });
  }

  private static async runAsync(test: (fixture: RuntimeHostFixture) => Promise<void>): Promise<void> {
    await using fixture = await RuntimeHostFixture.createAsync();
    await test(fixture);
  }
}
