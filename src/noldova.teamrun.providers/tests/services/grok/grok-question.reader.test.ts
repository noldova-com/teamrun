/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject, type JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { QuestionAsk } from "@noldova/teamrun.core";
import { ErrorCode, ObservedSettings, QuestionAnswer } from "@noldova/teamrun.protocol";
import { AcpConnectionException, AcpTurn, GrokQuestionReader, Resources } from "@noldova/teamrun.providers";
import { GrokQuestionRecording } from "../../fixtures/grok-question.recording.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";

@TestClass
export class GrokQuestionReaderTests {
  private static readonly reader: GrokQuestionReader = new GrokQuestionReader();

  @TestMethod
  public async asksGrokQuestionsAsOneQuestionCardAndSendsThePersonsAnswersBackAsGrokReadsThem(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.answers.push([new QuestionAnswer("Which color do you prefer?", ["Red"], null),
      new QuestionAnswer("Which sizes do you want?", ["Small", "Large"], "And one more note.")]);

    const replies = await GrokQuestionReaderTests.playAsync(GrokQuestionRecording.accepted.messages, listener);

    Assert.areEqual(JSON.stringify([GrokQuestionRecording.accepted.reply]), JSON.stringify(replies));
    Assert.areEqual("grok-session:question|ask_user_question", listener.questionAsks.map(t => `${t.providerRequestId}|${t.nativeKind}`).join(","));
    Assert.areEqual(JSON.stringify(["Which color do you prefer?||Which color do you prefer?|Red:Prefer the color red.,Blue:Prefer the color blue.|false|true|false",
      "Which sizes do you want?||Which sizes do you want?|Small:Include the small size.,Large:Include the large size.|true|true|false"]),
      JSON.stringify(listener.questionAsks[0]!.questions.map(t => [t.id, t.header, t.text, t.options.map(u => `${u.label}:${u.description}`).join(","), t.multiple, t.other,
        t.secret].join("|"))));
  }

  @TestMethod
  public async cancelsAGrokQuestionThePersonDismissed(): Promise<void> {
    const listener = new RecordingTurnListener();

    const replies = await GrokQuestionReaderTests.playAsync(GrokQuestionRecording.cancelled.messages, listener);

    Assert.areEqual(JSON.stringify([GrokQuestionRecording.cancelled.reply]), JSON.stringify(replies));
    Assert.areEqual(1, listener.questionAsks.length);
  }

  @TestMethod
  public async cancelsAGrokQuestionWhenGrokCancelsItOrTheCardFailsAndLeavesItToCoreOnceTheTurnStops(): Promise<void> {
    const listener = new class extends RecordingTurnListener {
      public readonly withdrawn: string[] = [];

      public override onQuestionsAsked(ask: QuestionAsk, signal?: AbortSignal): Promise<readonly QuestionAnswer[] | null> {
        this.questionAsks.push(ask);
        return new Promise((_, reject) => signal?.addEventListener("abort", () => {
          this.withdrawn.push(ask.providerRequestId);
          reject(new Error("Withdrawn"));
        }, { once: true }));
      }
    }();
    const stop = new AbortController();
    const turn = await GrokQuestionReaderTests.beginAsync(listener, stop.signal);
    const question = GrokQuestionReaderTests.question();

    const stopped = turn.onRequest("1", Resources.xaiAskUserQuestionMethods[0]!, question);
    stop.abort();
    await turn.finishAsync();
    const open = listener.withdrawn.length;
    await turn.onNotificationAsync(Resources.acpCancelRequest, JsonReader.fromValue({ requestId: 1 }));
    const other = await GrokQuestionReaderTests.beginAsync(listener);
    const cancelling = other.onRequest("2", Resources.xaiAskUserQuestionMethods[1]!, question);
    await other.onNotificationAsync(Resources.acpCancelRequest, JsonReader.fromValue({ requestId: 2 }));
    const failing = new RecordingTurnListener();
    failing.decisionFailure = new Error("Message m2 is not open.");
    const failed = await (await GrokQuestionReaderTests.beginAsync(failing)).onRequest("3", Resources.xaiAskUserQuestionMethods[0]!, question);

    Assert.areEqual(JSON.stringify([{ outcome: "cancelled" }, { outcome: "cancelled" }, { outcome: "cancelled" }]), JSON.stringify([await stopped, await cancelling, failed]));
    Assert.areEqual("grok-session:1,grok-session:2", listener.withdrawn.join(","));
    Assert.areEqual(0, open);
    Assert.areEqual(1, failing.questionAsks.length);
  }

  @TestMethod
  public async asksAGrokQuestionAlsoAfterItsTurnEndedAndCancelsItOnceTheReplyTakesNoMoreQuestions(): Promise<void> {
    const listener = new RecordingTurnListener();
    const stop = new AbortController();
    const turn = await GrokQuestionReaderTests.beginAsync(listener, stop.signal);
    const method = Resources.xaiAskUserQuestionMethods[0]!;
    await turn.onResponseAsync(Resources.acpSessionPrompt);
    stop.abort();
    listener.answers.push([new QuestionAnswer("Which?", ["A"], null)]);

    const answered = await turn.onRequest("1", method, GrokQuestionReaderTests.question());
    listener.decisionFailure = Object.assign(new Error("The message is not open."), { info: { name: ErrorCode.Conflict } });
    const closed = await turn.onRequest("2", method, GrokQuestionReaderTests.question());

    Assert.areEqual(JSON.stringify([{ outcome: "accepted", answers: { "Which?": ["A"] } }, { outcome: "cancelled" }]), JSON.stringify([answered, closed]));
    Assert.areEqual("grok-session:1,grok-session:2", listener.questionAsks.map(t => t.providerRequestId).join(","));
    Assert.isFalse(listener.signals.some(t => t?.aborted === true));
  }

  @TestMethod
  public async cancelsAGrokQuestionItCannotAskWithoutShowingIt(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = await GrokQuestionReaderTests.beginAsync(listener);
    const aborted = new AbortController();
    aborted.abort();
    await turn.onNotificationAsync(Resources.acpCancelRequest, JsonReader.fromValue({ requestId: 9 }));
    const method = Resources.xaiAskUserQuestionMethods[0]!;

    const replies = [await turn.onRequest("4", method, GrokQuestionReaderTests.question({ sessionId: "other" })), await turn.onRequest("5", method, GrokQuestionReaderTests.question({ sessionId: null })),
      await turn.onRequest("6", method, GrokQuestionReaderTests.question({ questions: [] })), await GrokQuestionReaderTests.turn(listener, new AbortController().signal)
        .onRequest("7", method, GrokQuestionReaderTests.question({ sessionId: null })),
      await (await GrokQuestionReaderTests.beginAsync(listener, aborted.signal)).onRequest("8", method, GrokQuestionReaderTests.question()), await turn.onRequest("9", method, GrokQuestionReaderTests.question())];

    Assert.areEqual(JSON.stringify(replies.map(() => ({ outcome: "cancelled" }))), JSON.stringify(replies));
    Assert.areEqual(0, listener.questionAsks.length);
  }

  @TestMethod
  public claimsEveryRequest(): void {
    Assert.isTrue(GrokQuestionReaderTests.reader.claims());
  }

  @TestMethod
  public readsOnlyQuestionsThatEachHaveTheirOwnTextAndLabelledOptions(): void {
    const read = (questions: JsonValue): string => {
      const questionsRead = GrokQuestionReaderTests.reader.read(JsonReader.fromValue({ questions }));
      return Object.isNull(questionsRead) ? "null" : questionsRead.map(t => `${t.id}:${t.options.map(u => `${u.label}=${u.description}`).join(",")}:${t.multiple}`).join("|");
    };

    Assert.areEqual(JSON.stringify(["Why?::false", "Which?:A=:false|How?:B=b:true", "null", "null", "null", "null", "null"]), JSON.stringify([
      read([{ question: "Why?", options: [], multiSelect: null }]), read([{ question: "Which?", options: [{ label: "A" }] }, { question: "How?", options: [{ label: "B", description: "b" }],
        multiSelect: true }]), read([]), read([{ question: "Same?", options: [] }, { question: "Same?", options: [] }]), read([{ question: "Which?", options: [{ label: " " }] }]),
      read([{ question: "Which?" }]), read(null)]));
  }

  @TestMethod
  public writesTheAnswerAsGrokReadsItWithThePersonsOwnWordsAsNotes(): void {
    Assert.areEqual(JSON.stringify([{ outcome: "accepted", answers: { "Which?": ["A"], "Why?": ["Other"] }, annotations: { "Why?": { notes: "Because." } } },
      { outcome: "accepted", answers: { "Which?": ["A", "B"] } }, { outcome: "accepted", answers: {} }, { outcome: "cancelled" }]), JSON.stringify([
      GrokQuestionReaderTests.reply([new QuestionAnswer("Which?", ["A"], null), new QuestionAnswer("Why?", [], "Because.")]),
      GrokQuestionReaderTests.reply([new QuestionAnswer("Which?", ["A", "B"], null)]), GrokQuestionReaderTests.reply([]), GrokQuestionReaderTests.reply(null)]));
  }

  @TestMethod
  public async refusesGroksQuestionAsUnsupportedInATurnWhoseAgentReadsNoQuestions(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new AcpTurn("copilot", "GitHub Copilot", "Copilot tool", listener, new AbortController().signal, 1);
    await turn.beginAsync("grok-session", false, new ObservedSettings("copilot", null, null, null));

    const failure = await Assert.throwsAsync(() => turn.onRequest("1", Resources.xaiAskUserQuestionMethods[0]!, GrokQuestionReaderTests.question()), AcpConnectionException);

    Assert.areEqual(`${Resources.acpUnsupportedRequest}|0`, `${failure.message}|${listener.questionAsks.length}`);
  }

  private static reply(answers: readonly QuestionAnswer[] | null): JsonObject {
    return GrokQuestionReaderTests.reader.reply(JsonReader.fromValue({}), answers);
  }

  private static turn(listener: RecordingTurnListener, signal: AbortSignal): AcpTurn {
    return new AcpTurn("grok", "Grok", "Grok tool", listener, signal, 1, undefined, null, undefined, undefined, undefined, GrokQuestionReaderTests.reader);
  }

  private static async beginAsync(listener: RecordingTurnListener, signal: AbortSignal = new AbortController().signal): Promise<AcpTurn> {
    const turn = GrokQuestionReaderTests.turn(listener, signal);
    await turn.beginAsync("grok-session", false, new ObservedSettings("grok", null, null, null));
    return turn;
  }

  private static question(changes: JsonObject = {}): JsonReader {
    return JsonReader.fromValue({ sessionId: "grok-session", toolCallId: "tool", questions: [{ question: "Which?", options: [{ label: "A", description: "a" }] }], mode: "default",
      ...changes });
  }

  private static async playAsync(messages: readonly JsonObject[], listener: RecordingTurnListener): Promise<JsonValue[]> {
    const turn = await GrokQuestionReaderTests.beginAsync(listener);
    const replies: JsonValue[] = [];
    for (const message of messages) {
      const params = JsonReader.fromValue({ [Resources.sessionIdField]: "grok-session", ...(message["params"] as JsonObject) });
      if (Object.isString(message["id"]))
        replies.push(await turn.onRequest(message["id"], String(message["method"]), params));
      else
        await turn.onNotificationAsync(String(message["method"]), params);
    }
    await turn.onResponseAsync(Resources.acpSessionPrompt);
    return replies;
  }
}
