/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
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
  public answersWithWhatEveryOtherClientSavedAndTheirProcessesAndRefusesNewWorkMeanwhile(): Promise<void> {
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
      const refused = await RuntimeHostFixture.callAsync(cli, "cli:1", ShellMethods.modules, null);
      const work = await RuntimeHostFixture.callAsync(cli, "cli:2", ShellMethods.work, null);
      const saved = await RuntimeHostFixture.callAsync(cli, "cli:3", ShellMethods.updateSaved, new UpdateSaved(process.pid, ["The draft could not be saved."]).toJson());
      const [responses] = await RuntimeHostFixture.readMessagesAsync(desktop, 2);
      const ready = UpdateReady.fromJson(responses.get("desktop:1")?.payload);
      const again = await RuntimeHostFixture.callAsync(desktop, "desktop:2", ShellMethods.update, new UpdateRequest(installation.folder).toJson());

      Assert.areEqual("null", JSON.stringify(updating.payload));
      Assert.areEqual(`${FailureCode.Updating}|TeamRun is preparing to install an update.`, `${late.failure?.code}|${late.failure?.message}`);
      Assert.areEqual(FailureCode.Updating, refused.failure?.code);
      Assert.isFalse(work.hasFailed);
      Assert.isFalse(saved.hasFailed);
      Assert.areEqual("The draft could not be saved.", ready.problems.join("|"));
      Assert.areEqual(`${process.pid} cli`, ready.processes.map(t => `${t.processId} ${t.role}`).join("|"));
      Assert.areEqual(`${FailureCode.Updating}|TeamRun is preparing to install an update.`, `${again.failure?.code}|${again.failure?.message}`);
    });
  }
}
