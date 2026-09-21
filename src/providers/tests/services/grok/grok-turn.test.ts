/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DetailKind, ObservedSettings } from "@noldova/teamrun-protocol";
import { GrokTurn } from "@noldova/teamrun-providers";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";

@TestClass
export class GrokTurnTests {
  @TestMethod
  public keepsUpdatesInsideTheirSessionAndTurnBoundary(): void {
    const listener = new RecordingTurnListener();
    const turn = new GrokTurn(listener, new AbortController().signal, 1);
    const update = (value: JsonObject, sessionId: string = "s"): void => turn.onNotification("session/update", JsonReader.fromValue({ sessionId, update: value }));
    update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "old" } });
    turn.begin("s", false, new ObservedSettings("grok", null, null, null, null));
    turn.onNotification("unknown", JsonReader.fromValue({}));
    update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "other" } }, "other");
    update({ sessionUpdate: "agent_message_chunk", content: { type: "image" } });
    update({ sessionUpdate: "unknown" });
    for (let index = 0; index < 130; index++)
      update({ sessionUpdate: "tool_call", toolCallId: String(index) });
    update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "end" } });
    turn.onResponse("session/set_model");
    turn.onResponse("session/prompt");
    update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "late" } });
    turn.onExit();
    Assert.areEqual(131, listener.details.length);
    Assert.areEqual(DetailKind.Note, listener.details[0]?.kind);
    Assert.areEqual("end", listener.details.at(-1)?.text);
  }

  @TestMethod
  public async deniesStaleInvalidAndUnsupportedPermissionRequests(): Promise<void> {
    const listener = new RecordingTurnListener();
    const controller = new AbortController();
    const turn = new GrokTurn(listener, controller.signal, 1);
    const request = (sessionId: string = "s", options: JsonObject[] = [{ optionId: "yes", name: "Allow", kind: "allow_once" }]): JsonReader =>
      JsonReader.fromValue({ sessionId, toolCall: {}, options });
    const ask = (params: JsonReader = request()): Promise<unknown> => turn.onRequest("id", "session/request_permission", params);
    Assert.isTrue(JSON.stringify(await ask()).includes("cancelled"));
    turn.begin("s", true, new ObservedSettings("grok", null, null, null, null));
    await Assert.throwsAsync(() => turn.onRequest("id", "unsupported", request()), Error);
    await Assert.throwsAsync(() => ask(request("s", [])), Error);
    Assert.isTrue(JSON.stringify(await ask(request("other"))).includes("cancelled"));
    Assert.isTrue(JSON.stringify(await ask()).includes("cancelled"));
    listener.decisions.push("yes");
    Assert.isTrue(JSON.stringify(await ask()).includes("selected"));
    listener.decisions.push("yes");
    const pending = ask();
    turn.finish();
    Assert.isTrue(JSON.stringify(await pending).includes("cancelled"));
    controller.abort();
    Assert.isTrue(JSON.stringify(await ask()).includes("cancelled"));
  }
}
