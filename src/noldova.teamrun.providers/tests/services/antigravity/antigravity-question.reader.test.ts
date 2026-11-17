/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ApprovalKind, ObservedSettings, QuestionAnswer } from "@noldova/teamrun.protocol";
import { AcpTurn, AntigravityQuestionReader, Resources } from "@noldova/teamrun.providers";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";

@TestClass
export class AntigravityQuestionReaderTests {
  private static readonly reader: AntigravityQuestionReader = new AntigravityQuestionReader();

  @TestMethod
  public async asksAntigravitysPermissionRequestForAnAnswerAsAQuestionAndAnswersWithTheChosenOptionsId(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.answers.push([new QuestionAnswer("interaction_b564e239", ["Blue"], null)]);
    const turn = await AntigravityQuestionReaderTests.turnAsync(listener);

    const reply = await turn.onRequest("1", Resources.acpRequestPermission, JsonReader.fromValue(AntigravityQuestionReaderTests.question()));

    Assert.areEqual(JSON.stringify({ outcome: { outcome: "selected", optionId: "2" } }), JSON.stringify(reply));
    Assert.areEqual("0|antigravity-session:1|session/request_permission", [listener.asks.length,
      ...listener.questionAsks.map(t => `${t.providerRequestId}|${t.nativeKind}`)].join("|"));
    Assert.areEqual(JSON.stringify(["interaction_b564e239||Which colour do you prefer?|Red,Blue|false|false|false"]),
      JSON.stringify(listener.questionAsks.flatMap(t => t.questions).map(t => [t.id, t.header, t.text, t.options.map(u => u.label).join(","), t.multiple, t.other,
        t.secret].join("|"))));
  }

  @TestMethod
  public async keepsAntigravitysPermissionRequestForAToolAPermissionCard(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.defaultDecision = "allow";
    const turn = await AntigravityQuestionReaderTests.turnAsync(listener);
    const command = { [Resources.sessionIdField]: "antigravity-session", toolCall: { toolCallId: "40879d75", kind: "execute", status: "pending", title: "sleep 20" },
      options: [{ optionId: "allow_always", name: "Allow Always (risky)", kind: "allow_always" }, { optionId: "allow", name: "Allow", kind: "allow_once" },
        { optionId: "deny", name: "Deny", kind: "reject_once" }] };

    const reply = await turn.onRequest("1", Resources.acpRequestPermission, JsonReader.fromValue(command));

    Assert.areEqual(JSON.stringify({ outcome: { outcome: "selected", optionId: "allow" } }), JSON.stringify(reply));
    Assert.areEqual(`0|${ApprovalKind.Command}|sleep 20`, [listener.questionAsks.length, ...listener.asks.map(t => `${t.kind}|${t.summary}`)].join("|"));
  }

  @TestMethod
  public claimsOnlyARequestWithAnInteractionIdNoKindAndOnlyAllowOnceOptions(): void {
    const claims = (tool: JsonObject, options: readonly JsonObject[]): boolean => AntigravityQuestionReaderTests.reader.claims(JsonReader.fromValue({ toolCall: tool,
      options: [...options] }));
    const answer = { optionId: "1", name: "Red", kind: "allow_once" };

    Assert.areEqual("true,false,false,false,false,false,false,false,false,false", [
      claims({ toolCallId: "interaction_1", title: "Which?" }, [answer]),
      claims({ toolCallId: "interaction_1", title: " " }, [answer]),
      claims({ toolCallId: "interaction_1", title: "Which?" }, [{ name: "Red", kind: "allow_once" }]),
      AntigravityQuestionReaderTests.reader.claims(JsonReader.fromValue({ options: [answer] })),
      AntigravityQuestionReaderTests.reader.claims(JsonReader.fromValue({ toolCall: { toolCallId: "interaction_1", title: "Which?" } })),
      claims({ toolCallId: "call_1", title: "Which?" }, [answer]),
      claims({ title: "Which?" }, [answer]),
      claims({ toolCallId: "interaction_1", kind: "other", title: "Which?" }, [answer]),
      claims({ toolCallId: "interaction_1", title: "Which?" }, []),
      claims({ toolCallId: "interaction_1", title: "Which?" }, [answer, { optionId: "2", name: "No", kind: "reject_once" }])
    ].join(","));
  }

  @TestMethod
  public readsNoQuestionFromARequestThatDoesntRead(): void {
    const read = (value: JsonObject): number | null => AntigravityQuestionReaderTests.reader.read(JsonReader.fromValue(value))?.length ?? null;
    const option = (name: string): JsonObject => ({ optionId: name, name, kind: "allow_once" });

    Assert.areEqual(1, read({ toolCall: { toolCallId: "interaction_1", title: "Which?" }, options: [option("A")] }));
    Assert.isNull(read({ toolCall: { toolCallId: "interaction_1" }, options: [option("A")] }));
    Assert.isNull(read({ toolCall: { toolCallId: "interaction_1", title: "Which?" }, options: [{ optionId: "1", kind: "allow_once" }] }));
    Assert.isNull(read({ toolCall: { toolCallId: "interaction_1", title: "Which?" }, options: [option("A"), option("A")] }));
    Assert.isNull(read({ toolCall: { toolCallId: "interaction_1", title: "Which?" }, options: [option("A"), { optionId: " ", name: "B", kind: "allow_once" }] }));
  }

  @TestMethod
  public async keepsAQuestionThatDoesntReadAPermissionCardAndCancelsARequestWithoutAToolCallForAnotherSession(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.defaultDecision = "1";
    const turn = await AntigravityQuestionReaderTests.turnAsync(listener);
    const untitled = { ...AntigravityQuestionReaderTests.question(), toolCall: { toolCallId: "interaction_b564e239", status: "pending", rawInput: {} } };

    const reply = await turn.onRequest("1", Resources.acpRequestPermission, JsonReader.fromValue(untitled));
    const other = await turn.onRequest("2", Resources.acpRequestPermission, JsonReader.fromValue({ [Resources.sessionIdField]: "other-session" }));

    Assert.areEqual(JSON.stringify([{ outcome: { outcome: "selected", optionId: "1" } }, { outcome: { outcome: "cancelled" } }]), JSON.stringify([reply, other]));
    Assert.areEqual(`0|${ApprovalKind.Tool}|Antigravity tool`, [listener.questionAsks.length, ...listener.asks.map(t => `${t.kind}|${t.summary}`)].join("|"));
  }

  @TestMethod
  public cancelsAQuestionThePersonSkippedOrAnsweredWithAChoiceAntigravityDidntOffer(): void {
    const params = JsonReader.fromValue(AntigravityQuestionReaderTests.question());
    const reply = (answers: readonly QuestionAnswer[] | null): string => JSON.stringify(AntigravityQuestionReaderTests.reader.reply(params, answers));
    const cancelled = JSON.stringify({ outcome: { outcome: "cancelled" } });

    Assert.areEqual([cancelled, cancelled, cancelled, JSON.stringify({ outcome: { outcome: "selected", optionId: "1" } })].join(","), [
      reply(null), reply([]), reply([new QuestionAnswer("interaction_b564e239", ["Green"], null)]),
      reply([new QuestionAnswer("interaction_b564e239", ["Red"], null)])
    ].join(","));
  }

  private static async turnAsync(listener: RecordingTurnListener): Promise<AcpTurn> {
    const turn = new AcpTurn("antigravity", "Antigravity", "Antigravity tool", listener, new AbortController().signal, 1, undefined, null, undefined, undefined, undefined,
      AntigravityQuestionReaderTests.reader);
    await turn.beginAsync("antigravity-session", false, new ObservedSettings("antigravity", null, null, null));
    return turn;
  }

  private static question(): JsonObject {
    return { [Resources.sessionIdField]: "antigravity-session", toolCall: { toolCallId: "interaction_b564e239", status: "pending", title: "Which colour do you prefer?",
      rawInput: {} }, options: [{ optionId: "1", name: "Red", kind: "allow_once" }, { optionId: "2", name: "Blue", kind: "allow_once" }] };
  }
}
