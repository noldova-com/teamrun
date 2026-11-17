/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IMethodHandler, ToolCall, ToolFailureException, ToolRisk } from "@noldova/desktop.runtime";
import { JsonException, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { ISenderTokens } from "@noldova/teamrun.core";
import { CommandTools, Resources, SubAgentTool } from "@noldova/teamrun.runtime";

@TestClass
export class CommandToolsTests {
  @TestMethod
  public runsACommandOnlyAfterAskingThePersonAndMarksTheTurnAsSending(): void {
    const tool = CommandTools.run;
    const properties = JsonReader.fromValue(tool.inputSchema).readObject("properties");

    Assert.areEqual(JSON.stringify(["teamrun_run_in_background", { isReadOnly: false, isDestructive: true, isOpenWorld: true }, true, 30_000, 120_000,
      "teamrun_list_messages"]), JSON.stringify([tool.name, tool.hints, tool.marksSending, tool.deadline?.default, tool.deadline?.maximum, tool.nextTool]));
    Assert.areEqual(JSON.stringify({ default: ToolRisk.High, maximum: ToolRisk.High }), JSON.stringify(tool.risk));
    Assert.areEqual(8_192, properties.readObject("command").readNumber("maxLength"));
    Assert.areEqual(JSON.stringify(["command", "description"]), JSON.stringify(JsonReader.fromValue(tool.inputSchema).readStringArray("required")));
  }

  @TestMethod
  public turnsTheCallsArgumentsIntoTheMethodsParametersUnderTheTurnsToken(): void {
    const params = CommandTools.runParamsOf({ command: "npm run build", description: "Build the app" }, "token-1");

    Assert.areEqual(JSON.stringify({ senderToken: "token-1", command: "npm run build", description: "Build the app" }), JSON.stringify(params));
  }

  @TestMethod
  public refusesAnArgumentThatIsMissingOrOfTheWrongTypeNamingIt(): void {
    const refused = [
      () => CommandTools.runParamsOf({ command: 5, description: "Build the app" }, "token-1"),
      () => CommandTools.runParamsOf({ command: "npm run build" }, "token-1")
    ].map(t => Assert.throws(t, JsonException).path);

    Assert.areEqual(JSON.stringify(["$.command", "$.description"]), JSON.stringify(refused));
  }

  @TestMethod
  public async refusesACallWhoseTurnHasEndedInTheCommandsOwnWords(): Promise<void> {
    let calls = 0;
    const handler: IMethodHandler = {
      handleAsync: () => {
        calls++;
        return Promise.resolve({});
      }
    };
    const tool = new SubAgentTool("teamrun", CommandTools.run, handler, new NoTokens(), CommandTools.runParamsOf, Resources.commandNoRunningTurn);
    const call = new ToolCall("s1", "c1/t1", {}, { command: "npm test", description: "Run the tests" }, 30_000, new AbortController().signal);

    const refused = await Assert.throwsAsync(() => tool.handleAsync(call), ToolFailureException);

    Assert.areEqual("Refused This call's turn has ended, so it can't start a background command.", `${refused.failure.code} ${refused.failure.message}`);
    Assert.areEqual(JSON.stringify([0, false]), JSON.stringify([calls, call.hasMarkedSending]));
  }
}

class NoTokens implements ISenderTokens {
  public senderTokenOf(): string | null {
    return null;
  }
}
