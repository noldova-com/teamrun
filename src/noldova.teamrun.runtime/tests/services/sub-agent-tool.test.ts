/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Failure, FailureCode } from "@noldova/desktop.protocol";
import { type IMethodHandler, MethodFailureException, type RequestContext, ToolCall, ToolFailureException } from "@noldova/desktop.runtime";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { JsonObject } from "@noldova/context.json";
import type { ISenderTokens } from "@noldova/teamrun.core";
import { SubAgentTool, SubAgentTools } from "@noldova/teamrun.runtime";

@TestClass
export class SubAgentToolTests {
  @TestMethod
  public async callsTheMethodUnderTheTurnsTokenAndMarksSendingOnlyForAToolThatChangesSomething(): Promise<void> {
    const contexts: RequestContext[] = [];
    const handler: IMethodHandler = {
      handleAsync: context => {
        contexts.push(context);
        return Promise.resolve({ ended: [], running: ["sub-1"] });
      }
    };
    const start = SubAgentToolTests.callOf("s1", { agent: "helper", description: "Check the tests", brief: "Run them." });
    const wait = SubAgentToolTests.callOf("s1", {});

    await new SubAgentTool("teamrun", SubAgentTools.start, handler, new SessionTokens(), SubAgentTools.startParamsOf).handleAsync(start);
    const waited = await new SubAgentTool("teamrun", SubAgentTools.wait, handler, new SessionTokens(), SubAgentTools.waitParamsOf).handleAsync(wait);

    Assert.areEqual(JSON.stringify([{ senderToken: "token-1", agent: "helper", description: "Check the tests", brief: "Run them." },
      { senderToken: "token-1", subAgentIds: [], seconds: 30 }]), JSON.stringify(contexts.map(t => t.payload)));
    const [started, waiting] = contexts;
    const [content] = waited.content;
    Assert.isDefined(started);
    Assert.isDefined(waiting);
    Assert.isDefined(content);
    Assert.areEqual(JSON.stringify(["teamrun.tools", 0]), JSON.stringify([started.client, started.connection]));
    Assert.isTrue(waiting.signal === wait.signal);
    Assert.areEqual(JSON.stringify([true, false]), JSON.stringify([start.hasMarkedSending, wait.hasMarkedSending]));
    Assert.areEqual(JSON.stringify({ ended: [], running: ["sub-1"] }), content.value);
    Assert.areEqual("teamrun:teamrun_wait_sub_agents", content.origin);
  }

  @TestMethod
  public async refusesASessionWhoseTurnHasEndedAndPassesOnTheMethodsFailure(): Promise<void> {
    const refusing: IMethodHandler = {
      handleAsync: () => Promise.reject(new MethodFailureException(new Failure(FailureCode.NotFound, "This reply started no sub-agent sub-9.")))
    };
    const tool = new SubAgentTool("teamrun", SubAgentTools.stop, refusing, new SessionTokens(), SubAgentTools.stopParamsOf);
    const ended = SubAgentToolTests.callOf("s2", { sub_agent_id: "sub-1" });

    const gone = await Assert.throwsAsync(() => tool.handleAsync(ended), ToolFailureException);
    const missing = await Assert.throwsAsync(() => tool.handleAsync(SubAgentToolTests.callOf("s1", { sub_agent_id: "sub-9" })), ToolFailureException);

    Assert.areEqual("Refused This call's turn has ended, so it has no sub-agents to start, wait for or stop.", `${gone.failure.code} ${gone.failure.message}`);
    Assert.isFalse(ended.hasMarkedSending);
    Assert.areEqual("OutcomeUncertain teamrun.notFound This reply started no sub-agent sub-9.",
      `${missing.failure.code} ${missing.failure.moduleCode} ${missing.failure.message}`);
  }

  private static callOf(session: string, input: JsonObject): ToolCall {
    return new ToolCall(session, "c1/t1", {}, input, 30_000, new AbortController().signal);
  }
}

class SessionTokens implements ISenderTokens {
  public senderTokenOf(session: string): string | null {
    return session === "s1" ? "token-1" : null;
  }
}
