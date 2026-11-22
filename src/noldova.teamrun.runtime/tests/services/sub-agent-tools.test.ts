/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { MethodName } from "@noldova/teamrun.protocol";
import { SubAgentTools } from "@noldova/teamrun.runtime";

@TestClass
export class SubAgentToolsTests {
  @TestMethod
  public waitsReadOnlyWithinCodexsTimeoutAndStartsAndStopsWithoutAskingThePerson(): void {
    const changing = { isReadOnly: false, isDestructive: false, isOpenWorld: false };

    Assert.areEqual(JSON.stringify([
      ["teamrun_start_sub_agent", changing, true, "teamrun_wait_sub_agents", 30_000],
      ["teamrun_wait_sub_agents", { ...changing, isReadOnly: true }, false, null, 60_000],
      ["teamrun_stop_sub_agent", changing, true, "teamrun_wait_sub_agents", 30_000]
    ]), JSON.stringify(SubAgentTools.all.map(t => [t.name, t.hints, t.marksSending, t.nextTool ?? null, t.deadline?.default])));
    Assert.areEqual(JSON.stringify({ type: "integer", minimum: 0, maximum: 50, default: 30, description: "How long to wait at most, in seconds." }),
      JSON.stringify(JsonReader.fromValue(SubAgentTools.wait.inputSchema).readObject("properties").readValue("seconds")));
    Assert.areEqual(JSON.stringify(["explorer", "helper"]),
      JSON.stringify(JsonReader.fromValue(SubAgentTools.start.inputSchema).readObject("properties").readObject("agent").readStringArray("enum")));
  }

  @TestMethod
  public turnsEachCallsArgumentsIntoItsMethodsParametersUnderTheTurnsToken(): void {
    const started = SubAgentTools.startParamsOf({ agent: "helper", description: "Check the tests", brief: "Run them." }, "token-1");
    const waitedFor = SubAgentTools.waitParamsOf({ sub_agent_ids: ["sub-1"], seconds: 5 }, "token-1");
    const waitedForAll = SubAgentTools.waitParamsOf({}, "token-1");
    const stopped = SubAgentTools.stopParamsOf({ sub_agent_id: "sub-1" }, "token-1");

    Assert.areEqual(JSON.stringify({ senderToken: "token-1", agent: "helper", description: "Check the tests", brief: "Run them." }), JSON.stringify(started));
    Assert.areEqual(JSON.stringify({ senderToken: "token-1", subAgentIds: ["sub-1"], seconds: 5 }), JSON.stringify(waitedFor));
    Assert.areEqual(JSON.stringify({ senderToken: "token-1", subAgentIds: [], seconds: 30 }), JSON.stringify(waitedForAll));
    Assert.areEqual(JSON.stringify({ senderToken: "token-1", subAgentId: "sub-1" }), JSON.stringify(stopped));
  }

  @TestMethod
  public pairsEachToolWithTheMethodItRunsAndReadsItsInputTheSameWayAsItsOwnReader(): void {
    const inputs = [{ agent: "helper", description: "Check the tests", brief: "Run them." }, { sub_agent_ids: ["sub-1"], seconds: 5 }, { sub_agent_id: "sub-1" }];
    const readers = [SubAgentTools.startParamsOf, SubAgentTools.waitParamsOf, SubAgentTools.stopParamsOf];

    Assert.areEqual(JSON.stringify([[SubAgentTools.start.name, MethodName.SubAgentStart], [SubAgentTools.wait.name, MethodName.SubAgentWait],
      [SubAgentTools.stop.name, MethodName.SubAgentStop]]), JSON.stringify(SubAgentTools.methods.map(t => [t.descriptor.name, t.method])));
    Assert.areEqual(JSON.stringify(readers.map((t, i) => t(inputs[i] ?? {}, "token-1"))),
      JSON.stringify(SubAgentTools.methods.map((t, i) => t.paramsOf(inputs[i] ?? {}, "token-1"))));
  }

  @TestMethod
  public refusesAnArgumentThatIsMissingOrOfTheWrongTypeNamingIt(): void {
    const refused = [
      () => SubAgentTools.startParamsOf({ agent: 5, description: "Check the tests", brief: "Run them." }, "token-1"),
      () => SubAgentTools.waitParamsOf({ sub_agent_ids: "sub-1" }, "token-1"),
      () => SubAgentTools.waitParamsOf({ seconds: "5" }, "token-1"),
      () => SubAgentTools.stopParamsOf({}, "token-1")
    ].map(t => Assert.throws(t, JsonException).path);

    Assert.areEqual(JSON.stringify(["$.agent", "$.sub_agent_ids", "$.seconds", "$.sub_agent_id"]), JSON.stringify(refused));
  }
}
