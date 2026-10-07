/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { FailureCode, Request, ShellEvents, ShellMethods, StayCause, StayedOpen } from "@noldova/teamrun-shell-protocol";
import { RuntimeBuild } from "@noldova/teamrun-shell-runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";
import { UpdateBarrierFixture } from "../../fixtures/update-barrier.fixture.js";

@TestClass
export class StayedOpenMethodTests {
  @TestMethod
  public failsWithAConflictWhenTheDesktopsSaveFailedAndIgnoresAnAnswerNoQuitAwaits(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync();
      const [desktop] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const [cli] = await fixture.handshakeAsync("cli", RuntimeBuild.identity);

      const early = await RuntimeHostFixture.callAsync(desktop, "desktop:1", ShellMethods.stayedOpen, new StayedOpen(StayCause.Kept).toJson());
      const stranger = await RuntimeHostFixture.callAsync(cli, "cli:1", ShellMethods.stayedOpen, new StayedOpen(StayCause.Kept).toJson());
      cli.sendMessages(new Request("cli:2", ShellMethods.quit, null));
      await UpdateBarrierFixture.readEventAsync(desktop, ShellEvents.quitting);
      await RuntimeHostFixture.callAsync(desktop, "desktop:2", ShellMethods.stayedOpen, new StayedOpen(StayCause.SaveFailed).toJson());
      const answer = await RuntimeHostFixture.readAnswerAsync(cli);
      const invalid = await RuntimeHostFixture.callAsync(desktop, "desktop:3", ShellMethods.stayedOpen, { cause: "Quit" });

      Assert.areEqual("null|null", `${JSON.stringify(early.payload)}|${JSON.stringify(stranger.payload)}`);
      Assert.areEqual("Conflict|TeamRun stayed open: a window could not save.", `${answer.failure?.code}|${answer.failure?.message}`);
      Assert.areEqual(FailureCode.InvalidParams, invalid.failure?.code);
    });
  }
}
