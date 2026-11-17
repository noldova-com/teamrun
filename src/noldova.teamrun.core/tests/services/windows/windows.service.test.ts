/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { EventHub, WindowsService } from "@noldova/teamrun.core";
import {
  ErrorCode,
  EventName,
  PanelAnsweredParams,
  PanelName,
  PanelOutcome,
  PanelRequestedPayload,
  WindowFocusedParams,
  WindowIdParams
} from "@noldova/teamrun.protocol";
import { ServiceException } from "@noldova/teamrun.services";

import { CoreHost } from "../../fixtures/core-host.fixture.js";
import { RecordingEventListener } from "../../fixtures/recording-event-listener.fixture.js";

@TestClass
export class WindowsServiceTests {
  @TestMethod
  public async asksTheWindowShowingTheCallersChatElseTheOneFocusedLast(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const [mine, other] = [await host.createConversationAsync(), await host.createConversationAsync()];
    const { service, listener } = WindowsServiceTests.create(host);
    service.focus(new WindowFocusedParams("w1", mine.id, true));
    service.focus(new WindowFocusedParams("w2", other.id, true));
    WindowsServiceTests.answerAll(service, listener);

    const showing = await service.requestAsync(PanelName.Providers, null, true, mine.id);
    const last = await service.requestAsync(PanelName.Teammates, null, false, "elsewhere");
    service.focus(new WindowFocusedParams("w1", other.id, true));
    const refocused = await service.requestAsync(PanelName.Chat, mine.id, true, null);

    Assert.areEqual(JSON.stringify(["w1", "w2", "w1"]), JSON.stringify([showing, last, refocused]));
    const sent = WindowsServiceTests.requests(listener);
    Assert.areEqual(JSON.stringify([[PanelName.Providers, null, true], [PanelName.Teammates, null, false], [PanelName.Chat, mine.id, true]]),
      JSON.stringify(sent.map(t => [t.panel, t.conversationId, t.open])));
    Assert.areEqual(3, new Set(sent.map(t => t.requestId)).size);
  }

  @TestMethod
  public async keepsTheFocusedWindowFirstWhenABackgroundWindowReportsItsChat(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const shown = await host.createConversationAsync();
    const { service, listener } = WindowsServiceTests.create(host);
    service.focus(new WindowFocusedParams("background", null, true));
    service.focus(new WindowFocusedParams("focused", null, true));
    WindowsServiceTests.answerAll(service, listener);

    service.focus(new WindowFocusedParams("background", shown.id, false));
    service.focus(new WindowFocusedParams("opened", null, false));
    const first = await service.requestAsync(PanelName.Providers, null, true, null);
    const showing = await service.requestAsync(PanelName.Providers, null, true, shown.id);

    Assert.areEqual(JSON.stringify(["focused", "background"]), JSON.stringify([first, showing]));
  }

  @TestMethod
  public async failsWhenTheWindowDoesNotAnswerAndTakesItBackWhenItAnswersLate(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { service, listener } = WindowsServiceTests.create(host);
    service.focus(new WindowFocusedParams("alive", null, true));
    service.focus(new WindowFocusedParams("slow", null, true));

    const exception = await Assert.throwsAsync(() => service.requestAsync(PanelName.Teammates, null, true, null), ServiceException);
    const asked = WindowsServiceTests.requests(listener).length;
    WindowsServiceTests.answerAll(service, listener);
    const meanwhile = await service.requestAsync(PanelName.Teammates, null, true, null);
    service.answer(new PanelAnsweredParams(WindowsServiceTests.requests(listener)[0]!.requestId, "slow", PanelOutcome.Done));
    const back = await service.requestAsync(PanelName.Teammates, null, true, null);

    Assert.areEqual(ErrorCode.Unavailable, exception.info.name);
    Assert.areEqual("The TeamRun window didn't answer.", exception.message);
    Assert.areEqual(1, asked);
    Assert.areEqual(JSON.stringify(["slow", "alive", "slow"]), JSON.stringify(WindowsServiceTests.requests(listener).map(t => t.windowId)));
    Assert.areEqual(JSON.stringify(["alive", "slow"]), JSON.stringify([meanwhile, back]));
  }

  @TestMethod
  public async asksTheNextWindowWhenTheAskedOneCloses(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { service, listener } = WindowsServiceTests.create(host, 60_000);
    service.focus(new WindowFocusedParams("alive", null, true));
    service.focus(new WindowFocusedParams("closing", null, true));
    void listener.next(EventName.PanelRequested).then(() => {
      WindowsServiceTests.answerAll(service, listener);
      service.close(new WindowIdParams("closing"));
    });

    const windowId = await service.requestAsync(PanelName.Teammates, null, true, null);

    Assert.areEqual("alive", windowId);
    Assert.areEqual(JSON.stringify(["closing", "alive"]), JSON.stringify(WindowsServiceTests.requests(listener).map(t => t.windowId)));
  }

  @TestMethod
  public async failsAsTheWindowAnswersWhenItRefusesOrFails(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { service, listener } = WindowsServiceTests.create(host);
    service.focus(new WindowFocusedParams("w1", null, true));

    WindowsServiceTests.answerAll(service, listener, PanelOutcome.Refused);
    const refused = await Assert.throwsAsync(() => service.requestAsync(PanelName.Providers, null, false, null), ServiceException);
    const { service: other, listener: otherListener } = WindowsServiceTests.create(host);
    other.focus(new WindowFocusedParams("w1", null, true));
    WindowsServiceTests.answerAll(other, otherListener, PanelOutcome.Failed);
    const failed = await Assert.throwsAsync(() => other.requestAsync(PanelName.Providers, null, false, null), ServiceException);

    Assert.areEqual(JSON.stringify([ErrorCode.Conflict, ErrorCode.Unavailable]), JSON.stringify([refused, failed].map(t => t.info.name)));
    Assert.areEqual("The person is typing in TeamRun, so the panel was left as it is; ask again when they stop.", refused.message);
    Assert.areEqual("The TeamRun window couldn't change the panel.", failed.message);
    Assert.areEqual(1, listener.count(EventName.PanelRequested));
  }

  @TestMethod
  public async failsAsUnavailableWhenNoWindowAnswersOrIsOpen(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { service, listener } = WindowsServiceTests.create(host);
    const fail = (): Promise<ServiceException> => Assert.throwsAsync(() => service.requestAsync(PanelName.Providers, null, true, null), ServiceException);

    const none = await fail();
    service.focus(new WindowFocusedParams("silent", null, true));
    const silent = await fail();
    service.focus(new WindowFocusedParams("closed", null, true));
    service.close(new WindowIdParams("closed"));
    service.close(new WindowIdParams("unknown"));
    const stillSilent = await fail();
    service.close(new WindowIdParams("silent"));
    const closed = await fail();

    Assert.areEqual(JSON.stringify(Array(4).fill(ErrorCode.Unavailable)), JSON.stringify([none, silent, stillSilent, closed].map(t => t.info.name)));
    Assert.areEqual(JSON.stringify(["No TeamRun window is open.", "The TeamRun window didn't answer.", "The TeamRun window didn't answer.",
      "No TeamRun window is open."]), JSON.stringify([none, silent, stillSilent, closed].map(t => t.message)));
    Assert.areEqual(1, listener.count(EventName.PanelRequested));
  }

  @TestMethod
  public async refusesAnUnknownChatBeforeAskingAnyWindow(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { service, listener } = WindowsServiceTests.create(host);
    service.focus(new WindowFocusedParams("w1", null, true));

    const exception = await Assert.throwsAsync(() => service.requestAsync(PanelName.Chat, "missing", true, null), ServiceException);

    Assert.areEqual(ErrorCode.NotFound, exception.info.name);
    Assert.areEqual(0, listener.count(EventName.PanelRequested));
  }

  @TestMethod
  public async refusesAChatPanelWithoutItsChatOrAnotherPanelWithOneWhenNoWindowIsOpen(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const { service } = WindowsServiceTests.create(host);

    const withoutChat = await Assert.throwsAsync(() => service.requestAsync(PanelName.Chat, null, true, null), ArgumentException);
    const withChat = await Assert.throwsAsync(() => service.requestAsync(PanelName.Providers, chat.id, true, null), ArgumentException);
    const viewWithChat = await Assert.throwsAsync(() => service.requestAsync(PanelName.BackgroundTasks, chat.id, false, null), ArgumentException);
    const pageWithoutChat = await Assert.throwsAsync(() => service.requestAsync(PanelName.Page, null, true, null), ArgumentException);

    Assert.areEqual(JSON.stringify(Array(4).fill("chatId")), JSON.stringify([withoutChat, withChat, viewWithChat, pageWithoutChat].map(t => t.parameterName)));
    Assert.areEqual("A chat panel or a chat's page names its chat, and no other panel names one. (Parameter 'chatId')", withoutChat.message);
  }

  @TestMethod
  public async withdrawsARequestWhenItsSignalAborts(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { service, listener } = WindowsServiceTests.create(host, 60_000);
    service.focus(new WindowFocusedParams("w1", null, true));
    const abort = new AbortController();
    void listener.next(EventName.PanelRequested).then(() => abort.abort(new Error("Withdrawn.")));

    const exception = await Assert.throwsAsync(() => service.requestAsync(PanelName.Teammates, null, false, null, abort.signal), Error);
    const late = WindowsServiceTests.requests(listener)[0]!;
    service.answer(new PanelAnsweredParams(late.requestId, "w1", PanelOutcome.Done));
    WindowsServiceTests.answerAll(service, listener);

    Assert.areEqual("Withdrawn.", exception.message);
    Assert.areEqual("w1", await service.requestAsync(PanelName.Teammates, null, false, null));
  }

  @TestMethod
  public async tellsWhetherAnyWindowShowsAChatAndCallsItsListenersEachTimeOneReportsAChat(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { service } = WindowsServiceTests.create(host);
    const shown: string[] = [];
    const stop = service.onShown(t => shown.push(t));

    service.focus(new WindowFocusedParams("w1", "c1", true));
    service.focus(new WindowFocusedParams("w2", "c2", false));
    service.focus(new WindowFocusedParams("w2", null, true));
    const before = [service.isShown("c1"), service.isShown("c2")];
    service.focus(new WindowFocusedParams("w1", "c1", false));
    service.close(new WindowIdParams("w1"));
    stop();
    service.focus(new WindowFocusedParams("w3", "c3", true));

    Assert.areEqual(JSON.stringify([true, false]), JSON.stringify(before));
    Assert.areEqual(JSON.stringify(["c1", "c2", "c1"]), JSON.stringify(shown));
    Assert.areEqual(JSON.stringify([false, true]), JSON.stringify([service.isShown("c1"), service.isShown("c3")]));
  }

  @TestMethod
  public async publishesAReloadForTheWindowItNamesAndRefusesOneThatClosedOrNeverReported(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { service, listener } = WindowsServiceTests.create(host);
    service.focus(new WindowFocusedParams("w9", null, true));
    service.focus(new WindowFocusedParams("w8", null, false));

    service.reload(new WindowIdParams("w9"));
    service.close(new WindowIdParams("w8"));
    const closed = Assert.throws(() => service.reload(new WindowIdParams("w8")), ServiceException);
    const unknown = Assert.throws(() => service.reload(new WindowIdParams("w7")), ServiceException);

    Assert.areEqual(JSON.stringify([[EventName.WindowReloadRequested, { windowId: "w9" }]]), JSON.stringify(listener.events.map(t => [t.name, t.payload])));
    Assert.areEqual(JSON.stringify([[ErrorCode.NotFound, "The TeamRun window \"w8\" was closed or reloaded.", ["w8"]], [ErrorCode.NotFound, "The TeamRun window \"w7\" was closed or reloaded.", ["w7"]]]),
      JSON.stringify([closed, unknown].map(t => [t.info.name, t.message, t.info.arguments])));
  }

  private static create(host: CoreHost, answerWait: number = 20): { service: WindowsService; listener: RecordingEventListener } {
    const events = new EventHub();
    const listener = new RecordingEventListener();
    events.subscribe(listener);
    return { service: new WindowsService(events, host.conversations, answerWait), listener };
  }

  private static answerAll(service: WindowsService, listener: RecordingEventListener, outcome: PanelOutcome = PanelOutcome.Done): void {
    const answer = (): void => void listener.next(EventName.PanelRequested).then(t => {
      answer();
      const request = PanelRequestedPayload.fromJson(t.payload);
      service.answer(new PanelAnsweredParams(request.requestId, request.windowId, outcome));
    });
    answer();
  }

  private static requests(listener: RecordingEventListener): readonly PanelRequestedPayload[] {
    return listener.events.filter(t => t.name === EventName.PanelRequested).map(t => PanelRequestedPayload.fromJson(t.payload));
  }
}
