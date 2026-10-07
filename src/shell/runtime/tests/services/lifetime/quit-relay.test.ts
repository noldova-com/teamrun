/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Cancel, QuitAnswer, QuitAnswered, Request, ShellEvents, ShellMethods, StopPolicy, StopRequest } from "@noldova/teamrun-shell-protocol";
import { RuntimeBuild } from "@noldova/teamrun-shell-runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";
import { UpdateBarrierFixture } from "../../fixtures/update-barrier.fixture.js";

@TestClass
export class QuitRelayTests {
  @TestMethod
  public answersQuitWhenItAcceptsTheAskedDesktopsStopAndBeforeTheRuntimeStops(): Promise<void> {
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
  public answersQuitOnceAKeptDesktopsConnectionEndsAndKeepsTheRuntimeRunning(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync();
      const [desktop] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const [cli] = await fixture.handshakeAsync("cli", RuntimeBuild.identity);
      await fixture.handshakeAsync("other", RuntimeBuild.identity);

      cli.sendMessages(new Request("cli:1", ShellMethods.quit, null));
      await UpdateBarrierFixture.readEventAsync(desktop, ShellEvents.quitting);
      const kept = await RuntimeHostFixture.callAsync(desktop, "desktop:1", ShellMethods.stop, new StopRequest(StopPolicy.IfIdle, true).toJson());
      desktop[Symbol.dispose]();
      const answer = await RuntimeHostFixture.readAnswerAsync(cli);
      const work = await RuntimeHostFixture.callAsync(cli, "cli:2", ShellMethods.work, null);

      Assert.areEqual("{\"keptFor\":1}", JSON.stringify(kept.payload));
      Assert.areEqual("{\"outcome\":\"Quit\"}", JSON.stringify(answer.payload));
      Assert.isFalse(work.hasFailed);
      Assert.isFalse(host.isIdle);
    });
  }

  @TestMethod
  public failsWithUnavailableWhenTheAskedDesktopsConnectionEndsBeforeItQuitsEvenWhenADesktopConnectsAgain(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync();
      const [desktop] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const [cli] = await fixture.handshakeAsync("cli", RuntimeBuild.identity);

      cli.sendMessages(new Request("cli:1", ShellMethods.quit, null));
      await UpdateBarrierFixture.readEventAsync(desktop, ShellEvents.quitting);
      const [again] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      desktop[Symbol.dispose]();
      const answer = await RuntimeHostFixture.readAnswerAsync(cli);
      const stopped = await RuntimeHostFixture.callAsync(again, "desktop:1", ShellMethods.stop, new StopRequest(StopPolicy.IfIdle, true).toJson());

      Assert.areEqual("Unavailable|TeamRun did not say whether it quit: its desktop's connection ended before it answered.", `${answer.failure?.code}|${answer.failure?.message}`);
      Assert.isFalse(stopped.hasFailed);
    });
  }

  @TestMethod
  public failsWithUnavailableWhenTheRuntimeStopsForAnotherReasonBeforeTheDesktopQuits(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync();
      const [desktop] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const [cli] = await fixture.handshakeAsync("cli", RuntimeBuild.identity);

      cli.sendMessages(new Request("cli:1", ShellMethods.quit, null));
      await UpdateBarrierFixture.readEventAsync(desktop, ShellEvents.quitting);
      host.requestStop("signal");
      const answer = await RuntimeHostFixture.readAnswerAsync(cli);

      Assert.areEqual("Unavailable|TeamRun did not say whether it quit: its runtime stopped before the desktop answered.", `${answer.failure?.code}|${answer.failure?.message}`);
      Assert.areEqual("signal", await host.waitForStopAsync());
    });
  }

  @TestMethod
  public answersQuitToAQuitThatJoinedOnceTheDesktopQuits(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync();
      const [desktop] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const [first] = await fixture.handshakeAsync("cli", RuntimeBuild.identity);
      const [second] = await fixture.handshakeAsync("cli", RuntimeBuild.identity);

      first.sendMessages(new Request("cli:1", ShellMethods.quit, null));
      await UpdateBarrierFixture.readEventAsync(desktop, ShellEvents.quitting);
      second.sendMessages(new Request("cli:2", ShellMethods.quit, null), new Request("cli:3", ShellMethods.work, null));
      await RuntimeHostFixture.readAnswerAsync(second);
      const stopped = await RuntimeHostFixture.callAsync(desktop, "desktop:1", ShellMethods.stop, new StopRequest(StopPolicy.IfIdle, true).toJson());
      const answers = [await RuntimeHostFixture.readAnswerAsync(first), await RuntimeHostFixture.readAnswerAsync(second)];

      Assert.areEqual("null", JSON.stringify(stopped.payload));
      Assert.areEqual("cli:1|{\"outcome\":\"Quit\"},cli:2|{\"outcome\":\"Quit\"}", answers.map(t => `${t.id}|${JSON.stringify(t.payload)}`).join(","));
      Assert.areEqual("request", await host.waitForStopAsync());
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
      desktop.sendMessages(new Request("desktop:1", ShellMethods.quitAnswered, new QuitAnswered(QuitAnswer.Stayed).toJson()));
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

  @TestMethod
  public answersQuitWhenTheDesktopsStopWasAcceptedBeforeTheQuitAsked(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync();
      const [desktop] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const [cli] = await fixture.handshakeAsync("cli", RuntimeBuild.identity);
      await fixture.handshakeAsync("other", RuntimeBuild.identity);

      const kept = await RuntimeHostFixture.callAsync(desktop, "desktop:1", ShellMethods.stop, new StopRequest(StopPolicy.IfIdle, true).toJson());
      cli.sendMessages(new Request("cli:1", ShellMethods.quit, null));
      await UpdateBarrierFixture.readEventAsync(desktop, ShellEvents.quitting);
      desktop[Symbol.dispose]();
      const answer = await RuntimeHostFixture.readAnswerAsync(cli);

      Assert.areEqual("{\"keptFor\":2}", JSON.stringify(kept.payload));
      Assert.areEqual("cli:1|{\"outcome\":\"Quit\"}", `${answer.id}|${JSON.stringify(answer.payload)}`);
    });
  }

  @TestMethod
  public answersQuitToALaterQuitOnceTheDesktopsStopWasAcceptedInARoundThatWasCancelled(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync();
      const [desktop] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const [cli] = await fixture.handshakeAsync("cli", RuntimeBuild.identity);
      await fixture.handshakeAsync("other", RuntimeBuild.identity);

      cli.sendMessages(new Request("cli:1", ShellMethods.quit, null));
      await UpdateBarrierFixture.readEventAsync(desktop, ShellEvents.quitting);
      await RuntimeHostFixture.callAsync(desktop, "desktop:1", ShellMethods.stop, new StopRequest(StopPolicy.IfIdle, true).toJson());
      cli.sendMessages(new Cancel("cli:1"));
      const cancelled = await RuntimeHostFixture.readAnswerAsync(cli);
      cli.sendMessages(new Request("cli:2", ShellMethods.quit, null));
      await UpdateBarrierFixture.readEventAsync(desktop, ShellEvents.quitting);
      desktop[Symbol.dispose]();
      const answer = await RuntimeHostFixture.readAnswerAsync(cli);

      Assert.areEqual("Cancelled", cancelled.failure?.code);
      Assert.areEqual("cli:2|{\"outcome\":\"Quit\"}", `${answer.id}|${JSON.stringify(answer.payload)}`);
    });
  }
}
