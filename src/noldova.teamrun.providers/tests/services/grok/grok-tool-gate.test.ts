/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader, type JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { GrokToolGate } from "@noldova/teamrun.providers";

@TestClass
export class GrokToolGateTests {
  @TestMethod
  public registersItsHookOnlyWhenGroksInitializeOffersDenyAndReadsNothingFromAnotherShape(): void {
    const gate = new GrokToolGate();
    const offering = (meta: JsonValue): JsonReader => JsonReader.fromValue({ agentCapabilities: { loadSession: true, _meta: meta } });

    Assert.areEqual([JSON.stringify({ "x.ai/hooks": { PreToolUse: [{ hookCallbackIds: ["teamrun-read-only-chat"] }] } }), "null", "null", "null", "null", "null"].join("\n"),
      [offering({ "x.ai/hooks": { decisions: ["deny", "block"] } }), offering({ "x.ai/hooks": { decisions: ["block"] } }), offering({ "x.ai/hooks": { decisions: "deny" } }),
        offering({ "x.ai/hooks": "deny" }), offering("hooks"), JsonReader.fromValue({ protocolVersion: 1 })].map(t => JSON.stringify(gate.metaOf(t))).join("\n"));
  }

  @TestMethod
  public readsGroksPreToolUseCallAndItsTeamRunToolButNoOtherEventItsRegistrationKeyOrABlankCall(): void {
    const gate = new GrokToolGate();
    const read = (params: JsonValue): string => {
      const gated = gate.read(JsonReader.fromValue(params));
      return Object.isNull(gated) ? "null" : `${gated.toolUseId} ${gated.mcp?.server ?? "-"} ${gated.mcp?.tool ?? "-"}`;
    };
    const sent = (fields: JsonObject): JsonObject => ({ hookCallbackId: "teamrun-read-only-chat", sessionId: "s1", cwd: "/work", workspaceRoot: "/work", timestamp: "t",
      permissionMode: "default", toolInput: {}, toolInputTruncated: false, ...fields });

    Assert.areEqual(["c1 - -", "c2 teamrun list_chats", "c3 - -", "c5 - -", "null", "null", "null", "null"].join("\n"),
      [sent({ hookEventName: "pre_tool_use", toolUseId: "c1", toolName: "write" }), sent({ hookEventName: "pre_tool_use", toolUseId: "c2", toolName: "teamrun__list_chats" }),
        sent({ hookEventName: "pre_tool_use", toolUseId: "c3", toolName: "a__b__c" }), sent({ hookEventName: "pre_tool_use", toolUseId: "c5" }),
        sent({ hookEventName: "post_tool_use", toolUseId: "c4", toolName: "write" }), sent({ hookEventName: "PreToolUse", toolUseId: "c6", toolName: "write" }),
        sent({ hookEventName: "pre_tool_use", toolUseId: " ", toolName: "write" }), sent({ hookEventName: "pre_tool_use", toolName: "write" })].map(read).join("\n"));
  }

  @TestMethod
  public marksACallReadOnlyOnlyWhenItsToolUpdateSaysSoAndAnswersGoOnOrDeny(): void {
    const gate = new GrokToolGate();

    Assert.areEqual("true false false false false {} {\"decision\":\"deny\",\"reason\":\"No writes.\"}", [
      ...[{ _meta: { "x.ai/tool": { read_only: true } } }, { _meta: { "x.ai/tool": { read_only: "true" } } }, { _meta: { "x.ai/tool": "read" } }, { _meta: null }, {}]
        .map(t => String(gate.readOnly(JsonReader.fromValue(t)))),
      JSON.stringify(gate.answer(null)), JSON.stringify(gate.answer("No writes."))].join(" "));
  }
}
