/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { ToolCall, ToolFailureException } from "@noldova/desktop.runtime";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { JsonObject } from "@noldova/context.json";
import type { IWindowsService } from "@noldova/teamrun.core";
import { ErrorCode, PanelName, type PanelAnsweredParams, type WindowFocusedParams, type WindowIdParams } from "@noldova/teamrun.protocol";
import { ServiceException } from "@noldova/teamrun.services";
import { PanelTool } from "@noldova/teamrun.runtime";

@TestClass
export class PanelToolTests {
  @TestMethod
  public async asksTheWindowsForThePanelWithTheCallersChatAndAnswersWithWhatTheyDid(): Promise<void> {
    const windows = new ScriptedWindows(() => Promise.resolve("w1"));
    const signal = new AbortController().signal;

    const opened = await new PanelTool("teamrun", windows, true).handleAsync(PanelToolTests.callOf({ panel: "Providers" }, signal));
    const closed = await new PanelTool("teamrun", windows, false).handleAsync(PanelToolTests.callOf({ panel: "Chat", chat_id: "c2" }, signal));

    Assert.areEqual(JSON.stringify([[PanelName.Providers, null, true, "c1"], [PanelName.Chat, "c2", false, "c1"]]), JSON.stringify(windows.requests));
    Assert.isTrue(windows.signals.every(t => t === signal));
    Assert.areEqual("Opened the panel Providers in a TeamRun window.", opened.content[0]!.value);
    Assert.areEqual("Closed the chat c2 in a TeamRun window.", closed.content[0]!.value);
    Assert.isFalse(opened.content[0]!.isUntrusted);
  }

  @TestMethod
  public async asksTheWindowsForAChatsBrowserPageAndNamesItAsThePage(): Promise<void> {
    const windows = new ScriptedWindows(() => Promise.resolve("w1"));
    const signal = new AbortController().signal;

    const opened = await new PanelTool("teamrun", windows, true).handleAsync(PanelToolTests.callOf({ panel: "Page", chat_id: "c2" }, signal));

    Assert.areEqual(JSON.stringify([[PanelName.Page, "c2", true, "c1"]]), JSON.stringify(windows.requests));
    Assert.areEqual("Opened the Browser page of the chat c2 in a TeamRun window.", opened.content[0]?.value);
  }

  @TestMethod
  public async asksTheWindowsToShowOrHideAViewWithoutAChat(): Promise<void> {
    const windows = new ScriptedWindows(() => Promise.resolve("w1"));
    const signal = new AbortController().signal;

    const shown = await new PanelTool("teamrun", windows, true).handleAsync(PanelToolTests.callOf({ panel: "BackgroundTasks" }, signal));
    const hidden = await new PanelTool("teamrun", windows, false).handleAsync(PanelToolTests.callOf({ panel: "Projects" }, signal));

    Assert.areEqual(JSON.stringify([[PanelName.BackgroundTasks, null, true, "c1"], [PanelName.Projects, null, false, "c1"]]), JSON.stringify(windows.requests));
    const opened = shown.content[0];
    const closed = hidden.content[0];
    Assert.isDefined(opened);
    Assert.isDefined(closed);
    Assert.areEqual("Opened the panel BackgroundTasks in a TeamRun window.", opened.value);
    Assert.areEqual("Closed the panel Projects in a TeamRun window.", closed.value);
  }

  @TestMethod
  public async refusesWhatTheCallerCanFixAndCallsTheRestUnavailable(): Promise<void> {
    const cases: readonly [unknown, string][] = [
      [new ServiceException(ErrorCode.NotFound, "No such chat."), "Refused teamrun.notFound No such chat."],
      [new ArgumentException("A chat panel names its conversation.", "chatId"), "Refused teamrun.invalidParams A chat panel names its conversation. (Parameter 'chatId')"],
      [new ServiceException(ErrorCode.Conflict, "The person is typing."), "Refused teamrun.conflict The person is typing."],
      [new ServiceException(ErrorCode.Unavailable, "No TeamRun window is open."), "Unavailable teamrun.unavailable No TeamRun window is open."],
      [new Error("Withdrawn."), "Unavailable teamrun.internal Withdrawn."]
    ];

    for (const [error, expected] of cases) {
      const tool = new PanelTool("teamrun", new ScriptedWindows(() => Promise.reject(error)), true);
      const failure = await Assert.throwsAsync(() => tool.handleAsync(PanelToolTests.callOf({ panel: "Teammates" })), ToolFailureException);
      Assert.areEqual(expected, `${failure.failure.code} ${failure.failure.moduleCode} ${failure.failure.message}`);
    }
  }

  private static callOf(input: JsonObject, signal: AbortSignal = new AbortController().signal): ToolCall {
    return new ToolCall("s1", "c1/t1", {}, input, 30_000, signal);
  }
}

class ScriptedWindows implements IWindowsService {
  public readonly requests: (string | boolean | null)[][] = [];
  public readonly signals: (AbortSignal | undefined)[] = [];
  private readonly reply: () => Promise<string>;

  public constructor(reply: () => Promise<string>) {
    this.reply = reply;
  }

  public focus(_params: WindowFocusedParams): void {
    throw new Error("The tool doesn't report windows.");
  }

  public close(_params: WindowIdParams): void {
    throw new Error("The tool doesn't report windows.");
  }

  public answer(_params: PanelAnsweredParams): void {
    throw new Error("The tool doesn't answer requests.");
  }

  public reload(_params: WindowIdParams): void {
    throw new Error("The tool doesn't reload windows.");
  }

  public isShown(_conversationId: string): boolean {
    throw new Error("The tool doesn't read the shown chats.");
  }

  public onShown(_listener: (conversationId: string) => void): () => void {
    throw new Error("The tool doesn't follow the shown chats.");
  }

  public requestAsync(panel: PanelName, conversationId: string | null, open: boolean, callerConversationId: string | null, signal?: AbortSignal): Promise<string> {
    this.requests.push([panel, conversationId, open, callerConversationId]);
    this.signals.push(signal);
    return this.reply();
  }
}
