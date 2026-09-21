/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ObservedSettings } from "@noldova/teamrun-protocol";
import { CodexItemReader, CodexRequestRouter, CodexTurn, DeltaStream, UnsupportedServerRequestException } from "@noldova/teamrun-providers";

import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";

@TestClass
export class CodexRequestRouterTests {
  @TestMethod
  public async routesByThreadId(): Promise<void> {
    const router = new CodexRequestRouter();
    const listener = new RecordingTurnListener();
    listener.decisions.push("decline");
    const turn = new CodexTurn("t-1", listener, new ObservedSettings("codex", null, null, null, null), new CodexItemReader(), new DeltaStream(listener, 1));
    const replacement = new CodexTurn("t-1", listener, new ObservedSettings("codex", null, null, null, null), new CodexItemReader(), new DeltaStream(listener, 1));

    router.register(turn);
    const answer = await router.handleServerRequest("item/tool/requestUserInput", JsonReader.fromValue({ threadId: "t-1", itemId: "q" }));
    const decision = await router.handleServerRequest("item/commandExecution/requestApproval", JsonReader.fromValue({ threadId: "t-1", itemId: "c", command: "ls" }));
    const unknownThread = await Assert.throwsAsync(() => router.handleServerRequest("item/tool/requestUserInput", JsonReader.fromValue({ threadId: "t-9" })), UnsupportedServerRequestException);
    const missingThread = await Assert.throwsAsync(() => router.handleServerRequest("item/tool/requestUserInput", JsonReader.fromValue({})), UnsupportedServerRequestException);
    router.unregister(replacement);
    const stillRegistered = router.activeCount;
    router.unregister(turn);

    Assert.areEqual("{\"answers\":{}}", JSON.stringify(answer));
    Assert.areEqual("{\"decision\":\"decline\"}", JSON.stringify(decision));
    Assert.areEqual("item/tool/requestUserInput", unknownThread.method);
    Assert.areEqual("item/tool/requestUserInput", missingThread.method);
    Assert.areEqual(1, stillRegistered);
    Assert.areEqual(0, router.activeCount);
    Assert.areEqual(0, router.all().length);
  }
}
