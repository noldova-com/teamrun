/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { GrokModelReader } from "@noldova/teamrun.providers";

import { GrokModelStateRecording } from "../../fixtures/grok-model-state.recording.js";

@TestClass
export class GrokModelReaderTests {
  @TestMethod
  public offersEachRecordedModelTheLevelsGrokListsForItInItsOrderWithItsDefaultAndNames(): void {
    const models = GrokModelReader.read(JsonReader.fromValue(GrokModelStateRecording.initialized));

    Assert.areEqual("grok-4.7:xhigh,high,medium,low:high:true|grok-4.7-build-fast:xhigh,high,medium,low:high:false|grok-4.6:xhigh,high,medium,low:high:false"
      + "|grok-4.5:high,medium,low:high:false", models.map(t => [t.id, t.effortLevels?.join(","), t.defaultEffort, t.isDefault].join(":")).join("|"));
    Assert.areEqual("Extra High,High,Medium,Low", Object.values(models[0]!.effortNames).join(","));
  }

  @TestMethod
  public readsOnlyTheLevelsGrokListsForAModelThatTakesAnEffortAndNoneWhenItListsNone(): void {
    const response = JsonReader.fromValue({ agentCapabilities: { promptCapabilities: { image: true } }, _meta: { modelState: { currentModelId: "a", availableModels: [
      { modelId: "a", name: "A", _meta: { supportsReasoningEffort: true, reasoningEfforts: ["high", "none", "low"] } },
      { modelId: "b", name: "B", _meta: { supportsReasoningEffort: true, reasoningEfforts: [{ id: "deep", value: "xhigh", label: "Deep" }, { id: "quick", value: "minimal" }] } },
      { modelId: "c", name: "C", _meta: { supportsReasoningEffort: true } },
      { modelId: "d", name: "D", _meta: { supportsReasoningEffort: false, reasoningEfforts: ["high"] } },
      { modelId: "e", name: "E", _meta: { reasoningEfforts: ["high"] } },
      { modelId: "f", name: "F", _meta: { supportsReasoningEffort: true, reasoningEfforts: ["ultra", "High", "low"] } },
      { modelId: "f2", name: "F2", _meta: { supportsReasoningEffort: true, reasoningEfforts: [{ value: "XHIGH" }, { value: "Medium" }] } },
      { modelId: "g", name: "G", _meta: { supportsReasoningEffort: true, reasoningEfforts: [{ id: "deep" }, { value: 3 }, { value: "low" }] } },
      { modelId: "h", name: "H", _meta: { supportsReasoningEffort: true, reasoningEfforts: ["max", { value: "medium" }, null, ["low"]] } },
      { modelId: "i", name: "I", _meta: { supportsReasoningEffort: true, reasoningEfforts: ["ultra", { id: "deep" }, 3] } },
      { modelId: "j", name: "J", _meta: { supportsReasoningEffort: true, reasoningEfforts: "high" } },
      { modelId: "k", name: "K", _meta: { supportsReasoningEffort: "true" } },
      { modelId: "l", name: "L" }
    ] } } });

    Assert.areEqual("high,none,low|xhigh,minimal|null|||ultra,high,low|xhigh,medium|low|max,medium|ultra|null||",
      GrokModelReader.read(response).map(t => t.effortLevels?.join(",") ?? "null").join("|"));
  }

  @TestMethod
  public readsTheDefaultLevelAndTheNamesGrokGivesItsLevels(): void {
    const response = JsonReader.fromValue({ agentCapabilities: { promptCapabilities: { image: true } }, _meta: { modelState: { currentModelId: "a", availableModels: [
      { modelId: "a", name: "A", _meta: { supportsReasoningEffort: true, reasoningEffort: "Medium",
        reasoningEfforts: [{ value: "low", label: "Light" }, { value: "medium", label: " Balanced " }, { value: "xhigh", label: "Extra", default: true }] } },
      { modelId: "b", name: "B", _meta: { supportsReasoningEffort: true, reasoningEfforts: [{ value: "low" }, { value: "high", label: " ", default: true }] } },
      { modelId: "c", name: "C", _meta: { supportsReasoningEffort: true, reasoningEffort: "max", reasoningEfforts: ["low"] } },
      { modelId: "d", name: "D", _meta: { supportsReasoningEffort: true, reasoningEfforts: [{ value: "low", label: "First" }, { value: "LOW", label: "Second" }, { value: "high", label: 3 }] } },
      { modelId: "e", name: "E", _meta: { supportsReasoningEffort: true, reasoningEffort: "high", reasoningEfforts: "high" } }
    ] } } });
    const models = GrokModelReader.read(response);

    Assert.areEqual("medium|high|null|null|null", models.map(t => t.defaultEffort ?? "null").join("|"));
    Assert.isNull(models[4]!.effortLevels);
    Assert.areEqual(JSON.stringify({ low: "Light", medium: "Balanced", xhigh: "Extra" }), JSON.stringify(models[0]!.effortNames));
    Assert.areEqual("{}|{}", [models[1]!.effortNames, models[2]!.effortNames].map(t => JSON.stringify(t)).join("|"));
    Assert.areEqual("low,high", models[3]!.effortLevels?.join(","));
    Assert.areEqual(JSON.stringify({ low: "First" }), JSON.stringify(models[3]!.effortNames));
  }

  @TestMethod
  public keepsUnknownCapabilitiesUnknownAndUsesOnlyAdvertisedMetadata(): void {
    const response = JsonReader.fromValue({ agentCapabilities: { promptCapabilities: { image: false } }, authMethods: [], _meta: {
      modelState: { currentModelId: "a", availableModels: [{ modelId: "a", name: "A", _meta: {} }] }
    } });
    const model = GrokModelReader.read(response)[0]!;
    Assert.isTrue(model.isDefault);
    Assert.isFalse(model.supportsImages!);
    Assert.areEqual(0, model.effortLevels?.length);
    Assert.isNull(GrokModelReader.version(response));
    Assert.isFalse(GrokModelReader.canAuthenticate(response));
    Assert.isNull(GrokModelReader.signInMethod(response));
    Assert.isTrue(GrokModelReader.canAuthenticate(JsonReader.fromValue({ authMethods: [{ id: "grok.com" }, { id: "cached_token" }] })));
    Assert.isFalse(GrokModelReader.canAuthenticate(JsonReader.fromValue({ authMethods: [{ id: "grok.com" }] })));
    Assert.areEqual("grok.com", GrokModelReader.signInMethod(JsonReader.fromValue({ authMethods: [{ id: "cached_token" }, { id: "grok.com" }] })));
  }
}
