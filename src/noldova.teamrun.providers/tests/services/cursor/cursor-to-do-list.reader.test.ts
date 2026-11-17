/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException, JsonReader, type JsonObject } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DetailKind, ObservedSettings, ReplyPlan } from "@noldova/teamrun.protocol";
import { AcpTurn, CursorToDoListReader, Resources } from "@noldova/teamrun.providers";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";

@TestClass
export class CursorToDoListReaderTests {
  @TestMethod
  public replacesTheListThenUpdatesItByIdForEachSessionLeavingCancelledToDosOut(): void {
    const reader = new CursorToDoListReader();
    const read = (sessionId: string, merge: boolean | null, todos: readonly JsonObject[]): string =>
      reader.read(JsonReader.fromValue({ sessionId, toolCallId: "u1", todos: [...todos], ...Object.isNull(merge) ? {} : { merge } }))
        .map(t => `${t.text}:${t.status}`).join("|");

    Assert.areEqual(JSON.stringify([
      "Inspect:Pending|Update:InProgress",
      "Inspect:Pending|Update:Completed|Verify:Pending",
      "Other:Pending",
      "Update:Completed|Verify:Pending",
      "Ship:Pending",
      "Test:InProgress"
    ]), JSON.stringify([
      read("s1", false, [{ id: "a", content: "Inspect", status: "pending" }, { id: "b", content: "Update", status: "in_progress" }]),
      read("s1", true, [{ id: "b", status: "completed" }, { id: "c", content: "Verify", status: "pending" }]),
      read("s2", true, [{ id: "a", content: "Other", status: "pending" }]),
      read("s1", true, [{ id: "a", status: "cancelled" }]),
      read("s1", false, [{ id: "d", content: "Ship", status: "someday" }, { id: "e", content: " ", status: "pending" }]),
      read("s1", null, [{ id: "f", content: "Test", status: "in_progress" }])
    ]));
  }

  @TestMethod
  public foldsTheSentToDosInOrderByIdSoALaterOneWinsANewIdIsAddedOnceAndAMergedOneWithoutAnIdIsSkipped(): void {
    const reader = new CursorToDoListReader();
    const read = (merge: boolean, todos: readonly JsonObject[]): string =>
      reader.read(JsonReader.fromValue({ sessionId: "s1", toolCallId: "u1", todos: [...todos], merge })).map(t => `${t.text}:${t.status}`).join("|");

    Assert.areEqual(JSON.stringify([
      "Inspect:Pending|Update:InProgress|Note:Pending",
      "Inspect:Pending|Update:Completed|Note:Pending",
      "Inspect:Pending|Update:Completed|Note:Pending|Verify:Completed",
      "Inspect:Pending|Update:Completed|Note:Pending|Verify:Completed",
      "Inspect:Pending|Update:Completed|Note:Pending|Verify:Completed",
      "Ship:Completed|Unnamed:Pending"
    ]), JSON.stringify([
      read(false, [{ id: "a", content: "Inspect", status: "pending" }, { id: "b", content: "Update", status: "pending" }, { content: "Note", status: "pending" },
        { id: "b", status: "in_progress" }]),
      read(true, [{ id: "b", status: "in_progress" }, { id: "b", status: "completed" }]),
      read(true, [{ id: "c", content: "Verify", status: "pending" }, { id: "c", status: "completed" }]),
      read(true, [{ content: "Verify", status: "pending" }, { id: " ", content: "Blank", status: "pending" }]),
      read(true, [{ id: "c", status: "completed" }]),
      read(false, [{ id: "d", content: "Ship", status: "pending" }, { id: "d", status: "completed" }, { id: "", content: "Unnamed", status: "pending" }])
    ]));
  }

  @TestMethod
  public failsOnANotificationWithoutASessionOrAToDoArray(): void {
    const reader = new CursorToDoListReader();
    const fails = (value: JsonObject): boolean => {
      try {
        reader.read(JsonReader.fromValue(value));
        return false;
      }
      catch (error) {
        if (!(error instanceof JsonException))
          throw error;
        return true;
      }
    };

    Assert.areEqual("true,true,true,true", [fails({ todos: [] }), fails({ sessionId: " ", todos: [] }), fails({ sessionId: "s1", todos: "none" }),
      fails({ sessionId: "s1", todos: [1] })].join(","));
  }

  @TestMethod
  public async showsItsSessionsListAsTheRepliesPlanWhileTheTurnRunsAndNotesOneItCantRead(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = await CursorToDoListReaderTests.turnAsync(listener, new CursorToDoListReader());
    const send = (value: JsonObject): Promise<void> => turn.onNotificationAsync(CursorToDoListReaderTests.method, JsonReader.fromValue(value));

    await send(CursorToDoListReaderTests.list("cursor-session", "Drop stale entries"));
    await send(CursorToDoListReaderTests.list("other-session", "Not this one"));
    await send({ sessionId: "cursor-session", todos: "none" });
    await turn.finishAsync();
    await send(CursorToDoListReaderTests.list("cursor-session", "After the turn"));
    await send({ sessionId: "cursor-session", todos: "none" });

    const plans = listener.details.filter(t => t.kind === DetailKind.Plan).map(t => ReplyPlan.fromJson(t.payload));
    const notes = listener.details.filter(t => t.kind === DetailKind.Note).map(t => t.text);
    Assert.areEqual(JSON.stringify([[Resources.planDetailId], ["Drop stale entries:InProgress"]]),
      JSON.stringify([listener.details.filter(t => t.kind === DetailKind.Plan).map(t => t.providerItemId), plans.flatMap(t => t.steps.map(u => `${u.text}:${u.status}`))]));
    Assert.areEqual(1, notes.length);
    Assert.isTrue(notes[0]?.startsWith(Resources.formatToDoListUnread("Cursor", "")) === true);
  }

  @TestMethod
  public async keepsAnUpdateSentBetweenTurnsSoTheNextTurnsMergeBuildsOnIt(): Promise<void> {
    const reader = new CursorToDoListReader();
    const first = await CursorToDoListReaderTests.turnAsync(new RecordingTurnListener(), reader);
    const listener = new RecordingTurnListener();
    await first.finishAsync();

    await first.onNotificationAsync(CursorToDoListReaderTests.method, JsonReader.fromValue(CursorToDoListReaderTests.list("cursor-session", "Kept between turns")));
    const next = await CursorToDoListReaderTests.turnAsync(listener, reader);
    await next.onNotificationAsync(CursorToDoListReaderTests.method, JsonReader.fromValue({ sessionId: "cursor-session", toolCallId: "u2", merge: true,
      todos: [{ id: "2", content: "Next", status: "pending" }] }));

    const plans = listener.details.filter(t => t.kind === DetailKind.Plan).map(t => ReplyPlan.fromJson(t.payload));
    Assert.areEqual(JSON.stringify(["Kept between turns:InProgress|Next:Pending"]), JSON.stringify(plans.map(t => t.steps.map(u => `${u.text}:${u.status}`).join("|"))));
  }

  @TestMethod
  public async showsNoListInATurnWhoseAgentReadsNone(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = await CursorToDoListReaderTests.turnAsync(listener, null);

    await turn.onNotificationAsync(CursorToDoListReaderTests.method, JsonReader.fromValue(CursorToDoListReaderTests.list("cursor-session", "Drop stale entries")));

    Assert.areEqual(0, listener.details.length);
  }

  private static get method(): string {
    const [method] = Resources.cursorUpdateToDosMethods;
    Assert.isDefined(method);
    return method;
  }

  private static async turnAsync(listener: RecordingTurnListener, reader: CursorToDoListReader | null): Promise<AcpTurn> {
    const turn = new AcpTurn("cursor", "Cursor", "Cursor tool", listener, new AbortController().signal, 1, undefined, null, undefined, undefined, undefined, null,
      null, undefined, undefined, undefined, undefined, false, false, reader);
    await turn.beginAsync("cursor-session", false, new ObservedSettings("cursor", null, null, null));
    return turn;
  }

  private static list(sessionId: string, content: string): JsonObject {
    return { sessionId, toolCallId: "u1", todos: [{ id: "1", content, status: "in_progress" }], merge: false };
  }
}
