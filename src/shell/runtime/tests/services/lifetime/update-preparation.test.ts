/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { FailureCode, Request, ShellEvents, ShellMethods, UpdateReady, UpdateRequest, UpdateSaved } from "@noldova/teamrun-shell-protocol";
import { ProcessPresence, RuntimeBuild, ServerSettings, UpdateBarrierState } from "@noldova/teamrun-shell-runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";
import { SystemCommandFixture } from "../../fixtures/system-command.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { UpdateBarrierFixture } from "../../fixtures/update-barrier.fixture.js";
import { WindowsProcessApiFixture } from "../../fixtures/windows-process-api.fixture.js";

@TestClass
export class UpdatePreparationTests {
  private static readonly UNIQUE: string = "0f1e2d3c-4b5a-4968-8778-695a4b3c2d1e";
  private static readonly OTHER_UNIQUE: string = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

  @TestMethod
  public reportsAClientThatDoesNotAnswerInTime(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await using folder = await TemporaryFolderFixture.createAsync();
      const installation = UpdateBarrierFixture.open(folder.path);
      await fixture.startAsync(30_000, undefined, undefined, process.env, new ServerSettings(undefined, undefined, undefined, undefined, 50, 1_000), installation.folder);
      const [desktop] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const [cli] = await fixture.handshakeAsync("cli", RuntimeBuild.identity);
      await UpdateBarrierFixture.holdAsync(installation);

      desktop.sendMessages(new Request("desktop:1", ShellMethods.update, new UpdateRequest(installation.folder).toJson()));
      const [responses] = await RuntimeHostFixture.readMessagesAsync(desktop, 2);
      const ready = UpdateReady.fromJson(responses.get("desktop:1")?.payload);
      await UpdateBarrierFixture.readEventAsync(cli, ShellEvents.updating);
      const late = await RuntimeHostFixture.callAsync(cli, "cli:1", ShellMethods.modules, null);
      const updater = await RuntimeHostFixture.callAsync(desktop, "desktop:2", ShellMethods.modules, null);

      Assert.areEqual("A cli client did not answer in time.", ready.problems.join("|"));
      Assert.areEqual(0, ready.processes.length);
      Assert.areEqual(FailureCode.Updating, late.failure?.code);
      Assert.areEqual(FailureCode.Updating, updater.failure?.code);
    });
  }

  @TestMethod
  public listsTheMountOfTheAppImageCopyItsStartLogNamesAmongItsProcesses(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await using folder = await TemporaryFolderFixture.createAsync();
      const installation = UpdateBarrierFixture.open(folder.path);
      await fixture.startAsync(30_000, undefined, undefined, process.env, new ServerSettings(undefined, undefined, undefined, undefined, 5_000, 1_000), installation.folder, undefined,
        `start-${UpdatePreparationTests.UNIQUE}.log`);
      await writeFile(path.join(fixture.dataDirectory.logsFolder, `copy-${UpdatePreparationTests.OTHER_UNIQUE}.log`), `teamrun-copy mount 1 ${process.ppid} /home/person/Other.AppImage\n`);
      await writeFile(path.join(fixture.dataDirectory.logsFolder, `copy-${UpdatePreparationTests.UNIQUE}.log`),
        `teamrun-copy extraction 1 /tmp/teamrun-runtime-AbC123\nteamrun-copy mount 1 ${process.pid} /home/person/TeamRun.AppImage\n`);
      const [desktop] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      await UpdateBarrierFixture.holdAsync(installation);

      desktop.sendMessages(new Request("desktop:1", ShellMethods.update, new UpdateRequest(installation.folder).toJson()));
      const [responses] = await RuntimeHostFixture.readMessagesAsync(desktop, 2);
      const ready = UpdateReady.fromJson(responses.get("desktop:1")?.payload);

      Assert.isTrue(ready.isReady);
      Assert.areEqual(JSON.stringify([[process.pid, "AppImage mount"]]), JSON.stringify(ready.processes.map(t => [t.processId, t.role])));
    });
  }

  @TestMethod
  public async listsNoMountWithoutACopyRecordAndReportsARecordItCannotRead(): Promise<void> {
    for (const isUnreadable of [false, true])
      await RuntimeHostFixture.runAsync(async fixture => {
        await using folder = await TemporaryFolderFixture.createAsync();
        const installation = UpdateBarrierFixture.open(folder.path);
        await fixture.startAsync(30_000, undefined, undefined, process.env, new ServerSettings(undefined, undefined, undefined, undefined, 5_000, 1_000), installation.folder, undefined,
          `start-${UpdatePreparationTests.UNIQUE}.log`);
        const record = path.join(fixture.dataDirectory.logsFolder, `copy-${UpdatePreparationTests.UNIQUE}.log`);
        if (isUnreadable)
          await mkdir(record);
        const [desktop] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
        await UpdateBarrierFixture.holdAsync(installation);

        desktop.sendMessages(new Request("desktop:1", ShellMethods.update, new UpdateRequest(installation.folder).toJson()));
        const [responses] = await RuntimeHostFixture.readMessagesAsync(desktop, 2);
        const ready = UpdateReady.fromJson(responses.get("desktop:1")?.payload);

        Assert.areEqual(0, ready.processes.length);
        Assert.areEqual(isUnreadable ? 1 : 0, ready.problems.length);
        if (isUnreadable)
          Assert.isTrue(ready.problems.join("|").startsWith(`The runtime could not read its AppImage copy record ${record}, so its mount cannot be checked: Error: EISDIR`), ready.problems.join("|"));
      });
  }

  @TestMethod
  public endsOnceTheHolderOfABarrierBeforeItsHandoffHasExited(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await using folder = await TemporaryFolderFixture.createAsync();
      const installation = UpdateBarrierFixture.open(folder.path);
      await fixture.startAsync(30_000, undefined, undefined, process.env, new ServerSettings(undefined, undefined, undefined, undefined, 5_000, 20), installation.folder);
      const [desktop] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const holder = spawn(process.execPath, ["-e", "setInterval(() => undefined, 1000);"], { stdio: "ignore" });
      await once(holder, "spawn");
      await UpdateBarrierFixture.holdAsync(installation, Number(holder.pid), UpdateBarrierState.Closing);
      desktop.sendMessages(new Request("desktop:1", ShellMethods.update, new UpdateRequest(installation.folder).toJson()));
      await RuntimeHostFixture.readMessagesAsync(desktop, 2);

      const [, whileHeld] = await fixture.handshakeAsync("held", RuntimeBuild.identity);
      holder.kill();
      await UpdateBarrierFixture.readEventAsync(desktop, ShellEvents.updateEnded);
      const [, late] = await fixture.handshakeAsync("late", RuntimeBuild.identity);

      Assert.areEqual(FailureCode.Updating, whileHeld.failure?.code);
      Assert.isFalse(late.hasFailed);
      Assert.isTrue(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public keepsUpdatingWhileItsHolderCannotBeLookedUpAndEndsOnceItCanBeSeenToHaveExited(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await using folder = await TemporaryFolderFixture.createAsync();
      const installation = UpdateBarrierFixture.open(folder.path);
      const windows = new WindowsProcessApiFixture();
      const holderRow = `900501\t1\t${Date.now() - 1_000}\tC:\\TeamRun\\TeamRun.exe`;
      windows.rest = () => holderRow;
      const presence = new ProcessPresence("win32", new SystemCommandFixture([]), windows);
      await fixture.startAsync(30_000, undefined, undefined, process.env, new ServerSettings(undefined, undefined, undefined, undefined, 5_000, 20), installation.folder, presence);
      const [desktop] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      await UpdateBarrierFixture.holdAsync(installation, 900_501, UpdateBarrierState.Preparing, presence);
      desktop.sendMessages(new Request("desktop:1", ShellMethods.update, new UpdateRequest(installation.folder).toJson()));
      await RuntimeHostFixture.readMessagesAsync(desktop, 2);
      windows.rest = () => {
        throw new Error("The process table could not be read.");
      };
      await delay(200);
      const [, whileUnknown] = await fixture.handshakeAsync("unknown", RuntimeBuild.identity);
      windows.rest = () => "";
      await UpdateBarrierFixture.readEventAsync(desktop, ShellEvents.updateEnded);
      const [, late] = await fixture.handshakeAsync("late", RuntimeBuild.identity);

      Assert.areEqual(FailureCode.Updating, whileUnknown.failure?.code);
      Assert.isFalse(late.hasFailed);
    });
  }

  @TestMethod
  public keepsUpdatingAfterTheHandoffWhateverItsHolderAndEndsOnceTheBarrierIsGone(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await using folder = await TemporaryFolderFixture.createAsync();
      const installation = UpdateBarrierFixture.open(folder.path);
      await fixture.startAsync(30_000, undefined, undefined, process.env, new ServerSettings(undefined, undefined, undefined, undefined, 5_000, 20), installation.folder);
      const [desktop] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const [cli] = await fixture.handshakeAsync("cli", RuntimeBuild.identity);
      const holder = spawn(process.execPath, ["-e", "setInterval(() => undefined, 1000);"], { stdio: "ignore" });
      await once(holder, "spawn");
      await UpdateBarrierFixture.holdAsync(installation, Number(holder.pid), UpdateBarrierState.HandedOff);
      desktop.sendMessages(new Request("desktop:1", ShellMethods.update, new UpdateRequest(installation.folder).toJson()));
      await UpdateBarrierFixture.readEventAsync(cli, ShellEvents.updating);
      await RuntimeHostFixture.callAsync(cli, "cli:1", ShellMethods.updateSaved, new UpdateSaved(process.pid, []).toJson());
      holder.kill();
      await once(holder, "exit");
      await delay(200);

      const [, whileHeld] = await fixture.handshakeAsync("held", RuntimeBuild.identity);
      await rm(installation.barrierFile);
      const ended = await UpdateBarrierFixture.readEventAsync(cli, ShellEvents.updateEnded);
      const [, late] = await fixture.handshakeAsync("late", RuntimeBuild.identity);
      const modules = await RuntimeHostFixture.callAsync(cli, "cli:2", ShellMethods.modules, null);
      const saved = await RuntimeHostFixture.callAsync(cli, "cli:3", ShellMethods.updateSaved, new UpdateSaved(process.pid, []).toJson());

      Assert.areEqual(FailureCode.Updating, whileHeld.failure?.code);
      Assert.areEqual("null", JSON.stringify(ended.payload));
      Assert.isFalse(late.hasFailed);
      Assert.isFalse(modules.hasFailed);
      Assert.areEqual(FailureCode.Conflict, saved.failure?.code);
    });
  }

  @TestMethod
  public answersAtOnceWithoutOtherClientsAndKeepsUpdatingWhileTheBarrierCannotBeReadOrParsed(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await using folder = await TemporaryFolderFixture.createAsync();
      const installation = UpdateBarrierFixture.open(folder.path);
      await fixture.startAsync(30_000, undefined, undefined, process.env, new ServerSettings(undefined, undefined, undefined, undefined, 5_000, 20), installation.folder);
      const [desktop] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      await UpdateBarrierFixture.holdAsync(installation);

      desktop.sendMessages(new Request("desktop:1", ShellMethods.update, new UpdateRequest(installation.folder).toJson()));
      const [responses] = await RuntimeHostFixture.readMessagesAsync(desktop, 2);
      await rm(installation.barrierFile);
      await mkdir(installation.barrierFile);
      await delay(200);
      const [, unreadable] = await fixture.handshakeAsync("unreadable", RuntimeBuild.identity);
      await rm(installation.barrierFile, { recursive: true });
      await writeFile(installation.barrierFile, "{\"holder\":");
      await delay(200);
      const [, unparsable] = await fixture.handshakeAsync("unparsable", RuntimeBuild.identity);
      await rm(installation.barrierFile);
      await UpdateBarrierFixture.readEventAsync(desktop, ShellEvents.updateEnded);
      const [, late] = await fixture.handshakeAsync("late", RuntimeBuild.identity);

      Assert.isTrue(UpdateReady.fromJson(responses.get("desktop:1")?.payload).isReady);
      Assert.areEqual(FailureCode.Updating, unreadable.failure?.code);
      Assert.areEqual(FailureCode.Updating, unparsable.failure?.code);
      Assert.isFalse(late.hasFailed);
    });
  }
}
