/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CliCommandResult, type ICliCommandConsole, type ICliCommandHandler, UsageException } from "@noldova/desktop.cli";
import { Failure, FailureCode } from "@noldova/desktop.protocol";
import { MethodFailureException, ToolCall, ToolFailureException } from "@noldova/desktop.runtime";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import { CommandTool, TeamRunTools } from "@noldova/teamrun.runtime";

@TestClass
export class CommandToolTests {
  @TestMethod
  public async answersWithTheCommandsTextAsUntrustedTextFromTheTool(): Promise<void> {
    const handler = new ScriptedCommand(() => Promise.resolve(new CliCommandResult([], "c1  Release  no teammates  idle")));
    const tool = TeamRunTools.all.find(t => t.descriptor.name === "teamrun_list_chats")!;

    const result = await new CommandTool("teamrun", tool, handler).handleAsync(CommandToolTests.callOf({ project_id: "p1" }));

    Assert.areEqual(JSON.stringify([{ project: "p1" }]), JSON.stringify(handler.values));
    Assert.areEqual("c1  Release  no teammates  idle", result.content[0]!.value);
    Assert.areEqual("teamrun:teamrun_list_chats", result.content[0]!.origin);
    Assert.isTrue(result.content[0]!.isUntrusted);
  }

  @TestMethod
  public async answersWithTheLinesTheCommandWroteBeforeItsTextAndGivesItNoInputAndNoEvents(): Promise<void> {
    const heard: (string | null)[] = [];
    const handler = new ScriptedCommand(async terminal => {
      terminal.writeLine("Sent to c1.");
      terminal.writeLine("Waiting for the reply.");
      heard.push(await terminal.askAsync("Send another? "));
      using _events = terminal.onEvent("teamrun.replyChanged", () => heard.push("event"));
      return new CliCommandResult(null, "Replied.");
    });

    const result = await new CommandTool("teamrun", TeamRunTools.all[0]!, handler).handleAsync(CommandToolTests.callOf({}));

    Assert.areEqual("Sent to c1.\nWaiting for the reply.\nReplied.", result.content[0]!.value);
    Assert.areEqual(JSON.stringify([null]), JSON.stringify(heard));
  }

  @TestMethod
  public async givesAMessagesLimitByDefaultAndPassesAFlagOnlyWhenItIsSet(): Promise<void> {
    const handler = new ScriptedCommand(() => Promise.resolve(new CliCommandResult(null, "(none)")));
    const messages = TeamRunTools.all.find(t => t.descriptor.name === "teamrun_list_messages")!;
    const approvals = TeamRunTools.all.find(t => t.descriptor.name === "teamrun_list_approvals")!;

    await new CommandTool("teamrun", messages, handler).handleAsync(CommandToolTests.callOf({ chat_id: "c1" }));
    await new CommandTool("teamrun", messages, handler).handleAsync(CommandToolTests.callOf({ chat_id: "c1", before: 9, limit: 3 }));
    await new CommandTool("teamrun", approvals, handler).handleAsync(CommandToolTests.callOf({ chat_id: "c1", pending: false }));
    await new CommandTool("teamrun", approvals, handler).handleAsync(CommandToolTests.callOf({ chat_id: "c1", pending: true }));

    Assert.areEqual(JSON.stringify([
      { limit: 20, chatId: "c1" }, { limit: 3, chatId: "c1", before: 9 }, { chatId: "c1" }, { chatId: "c1", pending: true }
    ]), JSON.stringify(handler.values));
  }

  @TestMethod
  public async refusesWhatTheCallerCanFixAndCallsTheRestUnavailable(): Promise<void> {
    const cases: readonly [unknown, string][] = [
      [new MethodFailureException(new Failure(FailureCode.NotFound, "No such chat.")), "Refused teamrun.notFound No such chat."],
      [new MethodFailureException(new Failure(FailureCode.InvalidParams, "Bad id.")), "Refused teamrun.invalidParams Bad id."],
      [new MethodFailureException(new Failure(FailureCode.Conflict, "Busy.")), "Refused teamrun.conflict Busy."],
      [new MethodFailureException(new Failure(FailureCode.Unauthorized, "Not you.")), "Refused teamrun.unauthorized Not you."],
      [new MethodFailureException(new Failure(FailureCode.Internal, "Broke.")), "Unavailable teamrun.internal Broke."],
      [new UsageException("A whole number."), "Refused null A whole number."],
      [new Error("The database closed."), "Unavailable null The database closed."],
      ["gone", "Unavailable null gone"]
    ];

    for (const [error, expected] of cases) {
      const tool = new CommandTool("teamrun", TeamRunTools.all[0]!, new ScriptedCommand(() => Promise.reject(error)));
      const failure = await Assert.throwsAsync(() => tool.handleAsync(CommandToolTests.callOf({})), ToolFailureException);
      Assert.areEqual(expected, `${failure.failure.code} ${failure.failure.moduleCode} ${failure.failure.message}`);
    }
  }

  private static callOf(input: JsonObject): ToolCall {
    return new ToolCall("s1", "c1/default", {}, input, 30_000, new AbortController().signal);
  }
}

class ScriptedCommand implements ICliCommandHandler {
  public readonly values: Readonly<Record<string, JsonValue>>[] = [];
  private readonly answer: (terminal: ICliCommandConsole) => Promise<CliCommandResult>;

  public constructor(answer: (terminal: ICliCommandConsole) => Promise<CliCommandResult>) {
    this.answer = answer;
  }

  public handleAsync(values: Readonly<Record<string, JsonValue>>, _signal: AbortSignal, terminal: ICliCommandConsole): Promise<CliCommandResult> {
    this.values.push(values);
    return this.answer(terminal);
  }
}
