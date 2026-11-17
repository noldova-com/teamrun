/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CopilotModelReader } from "@noldova/teamrun.providers";

import { CopilotModelListRecording } from "../../fixtures/copilot-model-list.recording.js";

@TestClass
export class CopilotModelReaderTests {
  @TestMethod
  public offersEachRecordedModelTheLevelsCopilotListsForItAndItsAutoEveryListedLevelInCopilotsOrder(): void {
    const models = CopilotModelReader.read(JsonReader.fromValue(CopilotModelListRecording.answer));

    Assert.areEqual([
      "auto:none,low,medium,high,xhigh,max",
      "claude-opus-5.5:low,medium,high,xhigh,max",
      "claude-haiku-4.5:",
      "gpt-6-sol:none,low,medium,high,xhigh,max",
      "gpt-5.3-codex:low,medium,high,xhigh",
      "kimi-k3:low,high,max"
    ].join("|"), models.map(t => `${t.id}:${t.effortLevels?.join(",") ?? "null"}`).join("|"));
    Assert.isTrue(models.every(t => Object.isNull(t.defaultEffort) && !t.isDefault));
    Assert.areEqual("Auto", models[0]!.displayName);
  }

  @TestMethod
  public putsALevelOutsideCopilotsOrderLastAndKeepsTheLevelsAnAutoRowListsItself(): void {
    const answer = (auto: object): JsonReader => JsonReader.fromValue({ list: [{ id: "auto", name: "Auto", ...auto },
      { id: "a", name: "A", capabilities: { supports: { reasoning_effort: ["ultra", "high", "minimal"] } } },
      { id: "b", name: "B", capabilities: { supports: { reasoningEffort: true } } },
      { id: "c", name: "C", capabilities: { supports: { reasoning_effort: ["low", "turbo"] } } }] });

    Assert.areEqual("minimal,low,high,ultra,turbo", CopilotModelReader.read(answer({}))[0]!.effortLevels?.join(","));
    Assert.areEqual("medium", CopilotModelReader.read(answer({ capabilities: { supports: { reasoning_effort: ["medium"] } } }))[0]!.effortLevels?.join(","));
    Assert.isNull(CopilotModelReader.read(answer({ capabilities: { supports: { reasoningEffort: true } } }))[0]!.effortLevels);
  }
}
