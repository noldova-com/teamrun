/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Cancel, Request, ShellEvents, ShellMethods, StayCause, StayedOpen, StopPolicy, StopRequest } from "@noldova/teamrun-shell-protocol";
import { RuntimeBuild } from "@noldova/teamrun-shell-runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";
import { UpdateBarrierFixture } from "../../fixtures/update-barrier.fixture.js";

@TestClass
export class QuitRelayTests {
  @TestMethod
  public asksTheDesktopToQuitAndAnswersBeforeTheRuntimeItStopsWhileWaitingEnds(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync();
      const [desktop] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const [cli] = await fixture.handshakeAsync("cli", RuntimeBuild.identity);

      cli.sendMessages(new Request("cli:1", ShellMethods.quit, null));
      const quitting = await UpdateBarrierFixture.readEventAsync(desktop, ShellEvents.quitting);
      const stopped = await RuntimeHostFixture.callAsync(desktop, "desktop:1", ShellMethods.stop, new StopRequest(StopPolicy.IfIdle, true).toJson());
      const answer = await RuntimeHostFixture.readAnswerAsync(cli);
      await host.waitForStopAsync();

      Assert.isNull(quitting.payload);
      Assert.areEqual("null", JSON.stringify(stopped.payload));
      Assert.areEqual("cli:1|{\"outcome\":\"Quit\"}", `${answer.id}|${JSON.stringify(answer.payload)}`);
    });
  }

  @TestMethod
  public answersQuitOnceTheDesktopsConnectionEndsAndKeepsTheRuntimeRunning(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync();
      const [desktop] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const [cli] = await fixture.handshakeAsync("cli", RuntimeBuild.identity);

      cli.sendMessages(new Request("cli:1", ShellMethods.quit, null));
      await UpdateBarrierFixture.readEventAsync(desktop, ShellEvents.quitting);
      desktop[Symbol.dispose]();
      const answer = await RuntimeHostFixture.readAnswerAsync(cli);
      const work = await RuntimeHostFixture.callAsync(cli, "cli:2", ShellMethods.work, null);

      Assert.areEqual("{\"outcome\":\"Quit\"}", JSON.stringify(answer.payload));
      Assert.isFalse(work.hasFailed);
      Assert.isFalse(host.isIdle);
    });
  }

  @TestMethod
  public failsEveryWaitingQuitWhenTheDesktopStaysOpenAndAsksTheDesktopOnceForAQuitThatJoins(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync();
      const [desktop] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const [first] = await fixture.handshakeAsync("cli", RuntimeBuild.identity);
      const [second] = await fixture.handshakeAsync("cli", RuntimeBuild.identity);

      first.sendMessages(new Request("cli:1", ShellMethods.quit, null));
      await UpdateBarrierFixture.readEventAsync(desktop, ShellEvents.quitting);
      second.sendMessages(new Request("cli:2", ShellMethods.quit, null));
      second.sendMessages(new Request("cli:3", ShellMethods.work, null));
      await RuntimeHostFixture.readAnswerAsync(second);
      desktop.sendMessages(new Request("desktop:1", ShellMethods.stayedOpen, new StayedOpen(StayCause.Kept).toJson()));
      const [responses, events] = await RuntimeHostFixture.readMessagesAsync(desktop, 1);
      const answers = [await RuntimeHostFixture.readAnswerAsync(first), await RuntimeHostFixture.readAnswerAsync(second)];

      Assert.areEqual("null", JSON.stringify(responses.get("desktop:1")?.payload));
      Assert.areEqual(0, events.length);
      Assert.areEqual(
        "cli:1|Cancelled|TeamRun stayed open: it was kept open while work was in progress.,cli:2|Cancelled|TeamRun stayed open: it was kept open while work was in progress.",
        answers.map(t => `${t.id}|${t.failure?.code}|${t.failure?.message}`).join(","));
    });
  }

  @TestMethod
  public countsAWaitingClientAsSharingTheRuntimeAgainOnceItsQuitIsCancelled(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync();
      const [desktop] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const [cli] = await fixture.handshakeAsync("cli", RuntimeBuild.identity);

      cli.sendMessages(new Request("cli:1", ShellMethods.quit, null), new Request("cli:2", ShellMethods.quit, null));
      await UpdateBarrierFixture.readEventAsync(desktop, ShellEvents.quitting);
      cli.sendMessages(new Cancel("cli:1"), new Cancel("cli:2"));
      const cancelled = [await RuntimeHostFixture.readAnswerAsync(cli), await RuntimeHostFixture.readAnswerAsync(cli)];
      const kept = await RuntimeHostFixture.callAsync(desktop, "desktop:1", ShellMethods.stop, new StopRequest(StopPolicy.IfIdle, true).toJson());

      Assert.areEqual("Cancelled,Cancelled", cancelled.map(t => t.failure?.code).join(","));
      Assert.areEqual("{\"keptFor\":1}", JSON.stringify(kept.payload));
    });
  }
}
