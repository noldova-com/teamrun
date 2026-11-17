/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DetailKind, ObservedSettings, ReplyPlan } from "@noldova/teamrun.protocol";
import { AcpTurn, GrokPlanReader, Resources } from "@noldova/teamrun.providers";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";

@TestClass
export class GrokPlanReaderTests {
  private static readonly reader: GrokPlanReader = new GrokPlanReader();

  @TestMethod
  public readsGroksPlanContentAndNoneWithoutAPlanFile(): void {
    const read = (value: JsonObject): string | null => {
      const plan = GrokPlanReaderTests.reader.read(JsonReader.fromValue(value));
      return Object.isNull(plan) ? null : `${plan.text}|${plan.steps.length}`;
    };

    Assert.areEqual(JSON.stringify(["# Tidy|0", null, null, null, null]), JSON.stringify([read({ planContent: "# Tidy" }), read({ planContent: null }), read({ planContent: " " }),
      read({ planContent: 3 }), read({})]));
  }

  @TestMethod
  public answersApprovedForAnApprovedPlanAndCancelledSoGrokKeepsPlanningOtherwise(): void {
    const reply = (approved: boolean | null): string => JSON.stringify(GrokPlanReaderTests.reader.reply(JsonReader.fromValue({}), approved));

    Assert.areEqual(JSON.stringify([{ outcome: "approved" }, { outcome: "cancelled" }, { outcome: "cancelled" }].map(t => JSON.stringify(t))), JSON.stringify([reply(true), reply(false), reply(null)]));
  }

  @TestMethod
  public async approvesGroksPlanUnderBothNamesWithoutSwitchingItsSessionSinceGrokLeavesPlanByItself(): Promise<void> {
    const run = async (method: string): Promise<string> => {
      const listener = new RecordingTurnListener();
      listener.decisions.push(Resources.acpApprovePlanOption);
      const left: string[] = [];
      const turn = new AcpTurn("grok", "Grok", "Grok tool", listener, new AbortController().signal, 1, undefined, null, undefined, undefined, undefined, null,
        GrokPlanReaderTests.reader, t => {
          left.push(t);
          return Promise.resolve();
        });
      await turn.beginAsync("grok-session", false, new ObservedSettings("grok", null, null, null));
      const reply = await turn.onRequest("3", method, JsonReader.fromValue({ sessionId: "grok-session", toolCallId: "tc-1", planContent: "# Tidy\n\nDrop stale entries." }));
      const plans = listener.details.filter(t => t.kind === DetailKind.Plan).map(t => String(ReplyPlan.fromJson(t.payload).approved));
      return [JSON.stringify(reply), plans.join(","), listener.asks.map(t => `${t.nativeKind}:${t.summary}`).join(","), String(left.length)].join(" ");
    };

    const [prefixed, plain] = Resources.xaiExitPlanModeMethods;
    Assert.isDefined(prefixed);
    Assert.isDefined(plain);

    Assert.areEqual(JSON.stringify([`{"outcome":"approved"} false,true exit_plan_mode:Tidy 0`, `{"outcome":"approved"} false,true exit_plan_mode:Tidy 0`]),
      JSON.stringify([await run(prefixed), await run(plain)]));
  }
}
