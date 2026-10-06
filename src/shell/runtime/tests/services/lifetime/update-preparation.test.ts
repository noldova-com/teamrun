/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, rm } from "node:fs/promises";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { FailureCode, Request, ShellEvents, ShellMethods, UpdateReady, UpdateRequest, UpdateSaved } from "@noldova/teamrun-shell-protocol";
import { RuntimeBuild, ServerSettings } from "@noldova/teamrun-shell-runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { UpdateBarrierFixture } from "../../fixtures/update-barrier.fixture.js";

@TestClass
export class UpdatePreparationTests {
  @TestMethod
  public reportsAClientThatDoesNotAnswerInTime(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await using folder = await TemporaryFolderFixture.createAsync();
      const installation = UpdateBarrierFixture.open(folder.path);
      await fixture.startAsync(30_000, undefined, undefined, process.env, new ServerSettings(undefined, undefined, undefined, undefined, 50, 1_000), installation.folder);
      const [desktop] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      await fixture.handshakeAsync("cli", RuntimeBuild.identity);
      await UpdateBarrierFixture.holdAsync(installation);

      desktop.sendMessages(new Request("desktop:1", ShellMethods.update, new UpdateRequest(installation.folder).toJson()));
      const [responses] = await RuntimeHostFixture.readMessagesAsync(desktop, 2);
      const ready = UpdateReady.fromJson(responses.get("desktop:1")?.payload);

      Assert.areEqual("A cli client did not answer in time.", ready.problems.join("|"));
      Assert.areEqual(0, ready.processes.length);
    });
  }

  @TestMethod
  public goesBackToNormalWhenTheBarriersHolderExits(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await using folder = await TemporaryFolderFixture.createAsync();
      const installation = UpdateBarrierFixture.open(folder.path);
      await fixture.startAsync(30_000, undefined, undefined, process.env, new ServerSettings(undefined, undefined, undefined, undefined, 5_000, 20), installation.folder);
      const [desktop] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const [cli] = await fixture.handshakeAsync("cli", RuntimeBuild.identity);
      const holder = spawn(process.execPath, ["-e", "const end = Date.now() + 500; setInterval(() => end < Date.now() && process.exit(0), 10);"], { stdio: "ignore" });
      await once(holder, "spawn");
      await UpdateBarrierFixture.holdAsync(installation, Number(holder.pid));
      desktop.sendMessages(new Request("desktop:1", ShellMethods.update, new UpdateRequest(installation.folder).toJson()));
      await UpdateBarrierFixture.readEventAsync(cli, ShellEvents.updating);
      await RuntimeHostFixture.callAsync(cli, "cli:1", ShellMethods.updateSaved, new UpdateSaved(process.pid, []).toJson());

      const ended = await UpdateBarrierFixture.readEventAsync(cli, ShellEvents.updateEnded);
      const [, late] = await fixture.handshakeAsync("late", RuntimeBuild.identity);
      const modules = await RuntimeHostFixture.callAsync(cli, "cli:2", ShellMethods.modules, null);
      const saved = await RuntimeHostFixture.callAsync(cli, "cli:3", ShellMethods.updateSaved, new UpdateSaved(process.pid, []).toJson());

      Assert.areEqual("null", JSON.stringify(ended.payload));
      Assert.isFalse(late.hasFailed);
      Assert.isFalse(modules.hasFailed);
      Assert.areEqual(FailureCode.Conflict, saved.failure?.code);
    });
  }

  @TestMethod
  public answersAtOnceWithoutOtherClientsAndGoesBackToNormalWhenTheBarrierCannotBeRead(): Promise<void> {
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
      await UpdateBarrierFixture.readEventAsync(desktop, ShellEvents.updateEnded);
      const [, late] = await fixture.handshakeAsync("late", RuntimeBuild.identity);

      Assert.isTrue(UpdateReady.fromJson(responses.get("desktop:1")?.payload).isReady);
      Assert.isFalse(late.hasFailed);
    });
  }
}
