/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { FailureCode, Request, ShellEvents, ShellMethods, UpdateReady, UpdateRequest, UpdateSaved } from "@noldova/teamrun-shell-protocol";
import { RuntimeBuild, ServerSettings } from "@noldova/teamrun-shell-runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { UpdateBarrierFixture } from "../../fixtures/update-barrier.fixture.js";

@TestClass
export class UpdateMethodTests {
  @TestMethod
  public answersWithWhatEveryOtherClientSavedAndTheirProcessesAndRefusesEachClientOnceItSaved(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await using folder = await TemporaryFolderFixture.createAsync();
      const installation = UpdateBarrierFixture.open(folder.path);
      await fixture.startAsync(30_000, undefined, undefined, process.env, new ServerSettings(undefined, undefined, undefined, undefined, 5_000, 20), installation.folder);
      const [desktop] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const [cli] = await fixture.handshakeAsync("cli", RuntimeBuild.identity);
      await UpdateBarrierFixture.holdAsync(installation);

      desktop.sendMessages(new Request("desktop:1", ShellMethods.update, new UpdateRequest(installation.folder).toJson()));
      const updating = await UpdateBarrierFixture.readEventAsync(cli, ShellEvents.updating);
      const [, late] = await fixture.handshakeAsync("late", RuntimeBuild.identity);
      const beforeSaving = await RuntimeHostFixture.callAsync(cli, "cli:1", ShellMethods.modules, null);
      const second = await RuntimeHostFixture.callAsync(cli, "cli:5", ShellMethods.update, new UpdateRequest(installation.folder).toJson());
      const saved = await RuntimeHostFixture.callAsync(cli, "cli:2", ShellMethods.updateSaved, new UpdateSaved(process.pid, ["The draft could not be saved."]).toJson());
      const refused = await RuntimeHostFixture.callAsync(cli, "cli:3", ShellMethods.modules, null);
      const work = await RuntimeHostFixture.callAsync(cli, "cli:4", ShellMethods.work, null);
      const [responses] = await RuntimeHostFixture.readMessagesAsync(desktop, 2);
      const ready = UpdateReady.fromJson(responses.get("desktop:1")?.payload);
      const coordinating = await RuntimeHostFixture.callAsync(desktop, "desktop:2", ShellMethods.modules, null);
      const again = await RuntimeHostFixture.callAsync(desktop, "desktop:3", ShellMethods.update, new UpdateRequest(installation.folder).toJson());

      Assert.areEqual("null", JSON.stringify(updating.payload));
      Assert.areEqual(`${FailureCode.Updating}|TeamRun is preparing to install an update.`, `${late.failure?.code}|${late.failure?.message}`);
      Assert.isFalse(beforeSaving.hasFailed);
      Assert.areEqual(`${FailureCode.Updating}|TeamRun is preparing to install an update.`, `${second.failure?.code}|${second.failure?.message}`);
      Assert.isFalse(saved.hasFailed);
      Assert.areEqual(FailureCode.Updating, refused.failure?.code);
      Assert.isFalse(work.hasFailed);
      Assert.areEqual(FailureCode.Updating, coordinating.failure?.code);
      Assert.areEqual("The draft could not be saved.", ready.problems.join("|"));
      Assert.areEqual(`${process.pid} cli`, ready.processes.map(t => `${t.processId} ${t.role}`).join("|"));
      Assert.areEqual(`${FailureCode.Updating}|TeamRun is preparing to install an update.`, `${again.failure?.code}|${again.failure?.message}`);
    });
  }

  @TestMethod
  public refusesAnInstallationFolderThatIsNotAnAbsolutePath(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync(30_000);
      const [desktop] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);

      const refused = await RuntimeHostFixture.callAsync(desktop, "desktop:1", ShellMethods.update, new UpdateRequest("installations/0123456789abcdef").toJson());
      const withoutOwn = await RuntimeHostFixture.callAsync(desktop, "desktop:2", ShellMethods.update, new UpdateRequest(path.resolve("installations", "0123456789abcdef")).toJson());
      const modules = await RuntimeHostFixture.callAsync(desktop, "desktop:3", ShellMethods.modules, null);

      Assert.areEqual(`${FailureCode.InvalidParams}|The installation's folder must be an absolute path.`, `${refused.failure?.code}|${refused.failure?.message}`);
      Assert.areEqual(`${FailureCode.InvalidParams}|The update names another installation than the one this runtime belongs to.`, `${withoutOwn.failure?.code}|${withoutOwn.failure?.message}`);
      Assert.isFalse(modules.hasFailed);
    });
  }

  @TestMethod
  public refusesAnUpdateOfAnotherInstallationAndKeepsWorking(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await using folder = await TemporaryFolderFixture.createAsync();
      const installation = UpdateBarrierFixture.open(folder.path);
      await fixture.startAsync(30_000, undefined, undefined, process.env, undefined, installation.folder);
      const [desktop] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);

      const refused = await RuntimeHostFixture.callAsync(desktop, "desktop:1", ShellMethods.update, new UpdateRequest(path.join(folder.path, "other")).toJson());
      const [, late] = await fixture.handshakeAsync("late", RuntimeBuild.identity);

      Assert.areEqual(`${FailureCode.InvalidParams}|The update names another installation than the one this runtime belongs to.`, `${refused.failure?.code}|${refused.failure?.message}`);
      Assert.isFalse(late.hasFailed);
    });
  }
}
