/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException, JsonReader, type JsonObject } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DetailKind, ErrorCode, ObservedSettings, ReplyPlan } from "@noldova/teamrun.protocol";
import { AcpConnectionException, AcpTurn, CursorPlanReader, Resources } from "@noldova/teamrun.providers";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";

@TestClass
export class CursorPlanReaderTests {
  private static readonly reader: CursorPlanReader = new CursorPlanReader();

  @TestMethod
  public readsCursorsPlanWithItsToDosThenEachPhasesAndFailsOnARequestThatDoesntRead(): void {
    const read = (value: JsonObject): string => {
      try {
        const plan = CursorPlanReaderTests.reader.read(JsonReader.fromValue(value));
        return [plan.text, ...plan.steps.map(t => `${t.text}:${t.status}`)].join("|");
      }
      catch (error) {
        if (!(error instanceof JsonException))
          throw error;
        return "unread";
      }
    };

    Assert.areEqual(JSON.stringify(["# Tidy|Drop stale entries:Completed|Rebuild:InProgress|Check:Pending|Ship:Pending", "# Tidy", "# Tidy", "unread", "unread", "unread",
      "unread"]), JSON.stringify([
      read({ plan: "# Tidy", todos: [{ id: "a", content: "Drop stale entries", status: "completed" }, { id: "b", content: "Rebuild", status: "in_progress" }],
        phases: [{ name: "Later", todos: [{ id: "c", content: "Check", status: "pending" }, { id: "d", content: "Ship", status: "someday" }] }] }),
      read({ plan: "# Tidy" }),
      read({ plan: "# Tidy", todos: [{ id: "a", status: "pending" }, { id: "b", content: " ", status: "pending" }] }),
      read({}),
      read({ plan: " " }),
      read({ plan: "# Tidy", todos: "none" }),
      read({ plan: "# Tidy", phases: [{ name: "Later", todos: [1] }] })
    ]));
  }

  @TestMethod
  public answersAcceptedForAnApprovedPlanRejectedForARefusedOneAndCancelledOtherwise(): void {
    const reply = (approved: boolean | null): string => JSON.stringify(CursorPlanReaderTests.reader.reply(JsonReader.fromValue({}), approved));

    Assert.areEqual(JSON.stringify([{ outcome: { outcome: "accepted" } }, { outcome: { outcome: "rejected" } }, { outcome: { outcome: "cancelled" } }].map(t => JSON.stringify(t))),
      JSON.stringify([reply(true), reply(false), reply(null)]));
  }

  @TestMethod
  public async showsCursorsPlanAsksToApproveItAndReportsItApprovedOrRefusedLeavingPlanOnlyOnApproval(): Promise<void> {
    const run = async (decision: string): Promise<string> => {
      const listener = new RecordingTurnListener();
      listener.decisions.push(decision);
      const left: string[] = [];
      const turn = await CursorPlanReaderTests.turnAsync(listener, t => {
        left.push(t);
        return Promise.resolve();
      });
      const reply = await turn.onRequest("7", CursorPlanReaderTests.method, JsonReader.fromValue(CursorPlanReaderTests.plan()));
      const ask = listener.asks.map(t => [t.providerRequestId, t.kind, t.nativeKind, t.summary, t.options.map(u => `${u.id}=${u.label}:${u.outcome}`).join("/")].join(" "));
      return [JSON.stringify(reply), CursorPlanReaderTests.plansOf(listener), ask.join(","), left.join(",")].join(" | ");
    };

    const asked = `cursor-session:7 Tool create_plan Tidy the cache ${Resources.acpApprovePlanOption}=${Resources.approvePlanLabel}:Approved/` +
      `${Resources.acpKeepPlanningOption}=${Resources.keepPlanningLabel}:Denied`;
    Assert.areEqual(JSON.stringify([
      `{"outcome":{"outcome":"accepted"}} | text:open,steps:1,text:approved | ${asked} | cursor-session`,
      `{"outcome":{"outcome":"rejected"}} | text:open,steps:1,text:refused | ${asked} | `,
      `{"outcome":{"outcome":"cancelled"}} | text:open,steps:1 | ${asked} | `
    ]), JSON.stringify([await run(Resources.acpApprovePlanOption), await run(Resources.acpKeepPlanningOption), await run("dismissed")]));
  }

  @TestMethod
  public async stillApprovesAPlanWhoseSessionCantLeavePlanAndSaysSo(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.decisions.push(Resources.acpApprovePlanOption);
    const turn = await CursorPlanReaderTests.turnAsync(listener, () => Promise.reject(new Error("Mode refused")));

    const reply = await turn.onRequest("7", CursorPlanReaderTests.method, JsonReader.fromValue(CursorPlanReaderTests.plan()));

    Assert.areEqual(JSON.stringify({ outcome: { outcome: "accepted" } }), JSON.stringify(reply));
    Assert.areEqual("text:open,steps:1,text:approved", CursorPlanReaderTests.plansOf(listener));
    Assert.areEqual(Resources.formatPlanModeKept("Cursor", "Mode refused"), listener.details.find(t => t.kind === DetailKind.Note)?.text);
  }

  @TestMethod
  public async approvesAPlanOnATurnGivenNoWayToLeavePlanCancelsOneWhoseAskEndedWithItsRunAndFailsWithAnyOtherAskFailure(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.decisions.push(Resources.acpApprovePlanOption);
    const ended = new RecordingTurnListener();
    ended.decisionFailure = Object.assign(new Error("The message is not open."), { info: { name: ErrorCode.Conflict } });
    const broken = new RecordingTurnListener();
    broken.decisionFailure = new Error("Broken");
    const request = async (target: RecordingTurnListener): Promise<unknown> =>
      (await CursorPlanReaderTests.turnAsync(target)).onRequest("7", CursorPlanReaderTests.method, JsonReader.fromValue(CursorPlanReaderTests.plan()));

    const approved = await request(listener);
    const cancelled = await request(ended);
    const failure = await Assert.throwsAsync(() => request(broken), Error);

    Assert.areEqual(JSON.stringify([{ outcome: { outcome: "accepted" } }, { outcome: { outcome: "cancelled" } }]), JSON.stringify([approved, cancelled]));
    Assert.areEqual("text:open,steps:1,text:approved|text:open,steps:1|Broken", [CursorPlanReaderTests.plansOf(listener), CursorPlanReaderTests.plansOf(ended), failure.message].join("|"));
    Assert.areEqual(0, listener.details.filter(t => t.kind === DetailKind.Note).length);
  }

  @TestMethod
  public async cancelsAPlanItCantReadWithoutAskingAndSaysWhy(): Promise<void> {
    const listener = new RecordingTurnListener();

    const reply = await (await CursorPlanReaderTests.turnAsync(listener)).onRequest("7", CursorPlanReaderTests.method, JsonReader.fromValue({ ...CursorPlanReaderTests.plan(), plan: " " }));
    const notes = listener.details.filter(t => t.kind === DetailKind.Note).map(t => t.text);

    Assert.areEqual(JSON.stringify({ outcome: { outcome: "cancelled" } }), JSON.stringify(reply));
    Assert.areEqual(0, listener.asks.length);
    Assert.areEqual("", CursorPlanReaderTests.plansOf(listener));
    Assert.areEqual(1, notes.length);
    Assert.isTrue(notes[0]?.startsWith(Resources.formatPlanUnread("Cursor", "")) === true);
  }

  @TestMethod
  public async passesOnAFailureReadingAPlanThatIsntAReadFailure(): Promise<void> {
    const turn = await CursorPlanReaderTests.turnAsync(new RecordingTurnListener(), undefined, new FailingPlanReader());

    const failure = await Assert.throwsAsync(() => turn.onRequest("7", CursorPlanReaderTests.method, JsonReader.fromValue(CursorPlanReaderTests.plan())), Error);

    Assert.areEqual(FailingPlanReader.failure, failure.message);
  }

  @TestMethod
  public async cancelsAnotherSessionsPlanWithoutAskingAndRefusesAPlanInATurnWhoseAgentReadsNone(): Promise<void> {
    const listener = new RecordingTurnListener();
    const other = await (await CursorPlanReaderTests.turnAsync(listener)).onRequest("7", CursorPlanReaderTests.method,
      JsonReader.fromValue({ ...CursorPlanReaderTests.plan(), [Resources.sessionIdField]: "other-session" }));
    const unread = new AcpTurn("cursor", "Cursor", "Cursor tool", listener, new AbortController().signal, 1);
    await unread.beginAsync("cursor-session", false, new ObservedSettings("cursor", null, null, null));

    const failure = await Assert.throwsAsync(() => unread.onRequest("8", CursorPlanReaderTests.method, JsonReader.fromValue(CursorPlanReaderTests.plan())), AcpConnectionException);

    Assert.areEqual(JSON.stringify({ outcome: { outcome: "cancelled" } }), JSON.stringify(other));
    Assert.areEqual(`${Resources.acpUnsupportedRequest}|0|0`, `${failure.message}|${listener.asks.length}|${listener.details.length}`);
  }

  private static get method(): string {
    const [method] = Resources.cursorCreatePlanMethods;
    Assert.isDefined(method);
    return method;
  }

  private static async turnAsync(listener: RecordingTurnListener, leavePlan?: (sessionId: string) => Promise<void>, reader: CursorPlanReader = CursorPlanReaderTests.reader): Promise<AcpTurn> {
    const turn = new AcpTurn("cursor", "Cursor", "Cursor tool", listener, new AbortController().signal, 1, undefined, null, undefined, undefined, undefined, null,
      reader, leavePlan);
    await turn.beginAsync("cursor-session", false, new ObservedSettings("cursor", null, null, null));
    return turn;
  }

  private static plansOf(listener: RecordingTurnListener): string {
    return listener.details.filter(t => t.kind === DetailKind.Plan).map(t => {
      const plan = ReplyPlan.fromJson(t.payload);
      return Object.isNull(plan.text) ? `steps:${plan.steps.length}` : `text:${plan.approved ? "approved" : plan.rejected ? "refused" : "open"}`;
    }).join(",");
  }

  private static plan(): JsonObject {
    return { [Resources.sessionIdField]: "cursor-session", toolCallId: "p1", name: "Tidy", plan: "# Tidy the cache\n\n1. Drop stale entries.",
      todos: [{ id: "t1", content: "Drop stale entries", status: "pending" }] };
  }
}

class FailingPlanReader extends CursorPlanReader {
  public static readonly failure: string = "The plan reader broke.";

  public override read(): ReturnType<CursorPlanReader["read"]> {
    throw new Error(FailingPlanReader.failure);
  }
}
