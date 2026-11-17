/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ObservedSettings, QuestionAnswer } from "@noldova/teamrun.protocol";
import { AcpTurn, CursorQuestionReader, Resources } from "@noldova/teamrun.providers";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";

@TestClass
export class CursorQuestionReaderTests {
  private static readonly reader: CursorQuestionReader = new CursorQuestionReader();

  @TestMethod
  public async asksCursorsQuestionsAsOneCardAndAnswersWithTheChosenOptionIds(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.answers.push([new QuestionAnswer("color", ["Blue"], null), new QuestionAnswer("sizes", ["Small", "Large"], null)]);
    const turn = new AcpTurn("cursor", "Cursor", "Cursor tool", listener, new AbortController().signal, 1, undefined, null, undefined, undefined, undefined,
      CursorQuestionReaderTests.reader);
    await turn.beginAsync("cursor-session", false, new ObservedSettings("cursor", null, null, null));

    const reply = await turn.onRequest("1", Resources.cursorAskQuestionMethods[0]!, JsonReader.fromValue(CursorQuestionReaderTests.question()));

    Assert.areEqual(JSON.stringify({ outcome: { outcome: "answered", answers: [{ questionId: "color", selectedOptionIds: ["blue"] },
      { questionId: "sizes", selectedOptionIds: ["s", "l"] }] } }), JSON.stringify(reply));
    Assert.areEqual("cursor-session:1|ask_question", listener.questionAsks.map(t => `${t.providerRequestId}|${t.nativeKind}`).join(","));
    Assert.areEqual(JSON.stringify(["color|Preferences|Which color do you prefer?|Red,Blue|false|false|false",
      "sizes|Preferences|Which sizes do you want?|Small,Large|true|false|false"]),
      JSON.stringify(listener.questionAsks[0]!.questions.map(t => [t.id, t.header, t.text, t.options.map(u => u.label).join(","), t.multiple, t.other, t.secret].join("|"))));
  }

  @TestMethod
  public cancelsQuestionsThePersonSkippedAndDropsChoicesCursorDidntOffer(): void {
    const params = JsonReader.fromValue(CursorQuestionReaderTests.question());

    Assert.areEqual(JSON.stringify({ outcome: { outcome: "cancelled" } }), JSON.stringify(CursorQuestionReaderTests.reader.reply(params, null)));
    Assert.areEqual(JSON.stringify({ outcome: { outcome: "answered", answers: [{ questionId: "color", selectedOptionIds: ["red"] },
      { questionId: "shape", selectedOptionIds: [] }] } }),
      JSON.stringify(CursorQuestionReaderTests.reader.reply(params, [new QuestionAnswer("color", ["Green", "Red"], null), new QuestionAnswer("shape", ["Round"], null)])));
  }

  @TestMethod
  public claimsEveryRequest(): void {
    Assert.isTrue(CursorQuestionReaderTests.reader.claims());
  }

  @TestMethod
  public readsNoQuestionsFromARequestWithoutAnyOrWithOneThatDoesntRead(): void {
    const read = (value: JsonObject): number | null => CursorQuestionReaderTests.reader.read(JsonReader.fromValue(value))?.length ?? null;
    const question = (id: string): JsonObject => ({ id, prompt: "Which?", options: [{ id: "a", label: "A" }] });

    Assert.areEqual(1, read({ questions: [question("q")] }));
    Assert.isNull(read({ questions: [] }));
    Assert.isNull(read({}));
    Assert.isNull(read({ questions: [question("q"), question("q")] }));
    Assert.isNull(read({ questions: [{ prompt: "Which?", options: [] }] }));
    Assert.isNull(read({ questions: [{ id: "q", prompt: "Which?", options: [{ id: "a" }] }] }));
    Assert.isNull(read({ questions: [{ id: "q", prompt: "Which?", options: [{ id: "a", label: "A" }, { id: "b", label: "A" }] }] }));
  }

  @TestMethod
  public async refusesCursorsQuestionInATurnWhoseAgentReadsNoQuestions(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new AcpTurn("cursor", "Cursor", "Cursor tool", listener, new AbortController().signal, 1);
    await turn.beginAsync("cursor-session", false, new ObservedSettings("cursor", null, null, null));

    const failure = await Assert.throwsAsync(() => turn.onRequest("1", Resources.cursorAskQuestionMethods[0]!, JsonReader.fromValue(CursorQuestionReaderTests.question())),
      Error);

    Assert.areEqual(`${Resources.acpUnsupportedRequest}|0`, `${failure.message}|${listener.questionAsks.length}`);
  }

  private static question(): JsonObject {
    return { [Resources.sessionIdField]: "cursor-session", toolCallId: "q1", title: "Preferences", questions: [
      { id: "color", prompt: "Which color do you prefer?", options: [{ id: "red", label: "Red" }, { id: "blue", label: "Blue" }] },
      { id: "sizes", prompt: "Which sizes do you want?", options: [{ id: "s", label: "Small" }, { id: "l", label: "Large" }], allowMultiple: true }
    ] };
  }
}
