/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { CodexModelListRecording } from "../../fixtures/codex-model-list.recording.js";
import { CodexTestHost } from "../../fixtures/codex-test-host.fixture.js";

@TestClass
export class CodexModelReaderTests {
  @TestMethod
  public async offersEachRecordedModelTheLevelsCodexListsForItInItsOrderWithItsDefault(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_MODELS: JSON.stringify({ data: CodexModelListRecording.rows, nextCursor: null }) });
    try {
      const models = (await adapter.listModels(null)).models;
      Assert.areEqual("gpt-6.1-sol:low,medium,high,xhigh,max,ultra:low:true|gpt-6-luna:low,medium,high,xhigh,max:medium:false",
        models.map(t => [t.id, t.effortLevels?.join(","), t.defaultEffort, t.isDefault].join(":")).join("|"));
      Assert.isTrue(models.every(t => t.effortNames["xhigh"] === "Extra high"));
    }
    finally {
      await adapter.shutdown();
    }
  }

  @TestMethod
  public async followsModelPagesWithoutDuplicatingRepeatedModels(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_MODEL_PAGES: JSON.stringify([
      { data: [{ model: "first", hidden: false }], nextCursor: "1" },
      { data: [{ model: "first", hidden: false }, { model: "second", hidden: false }], nextCursor: null }
    ]) });
    try {
      Assert.areEqual("first,second", (await adapter.listModels(null)).models.map(t => t.id).join(","));
    }
    finally {
      await adapter.shutdown();
    }
  }
  @TestMethod
  public async offersTheStandardTierAndTheServiceTiersAModelListsByTheirNamesWithItsDefaultTierOrElseStandardAndTheOlderSpeedTiersByIdOnly(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_MODELS: JSON.stringify({ data: [
      { model: "tiered", hidden: false, supportedReasoningEfforts: [], defaultReasoningEffort: null, defaultServiceTier: "priority",
        serviceTiers: [{ id: "priority", name: "Fast", description: "Faster replies. " }, { id: "flex", name: " ", description: "" }] },
      { model: "older", hidden: false, supportedReasoningEfforts: [], defaultReasoningEffort: null, additionalSpeedTiers: ["fast"], defaultServiceTier: "flex" },
      { model: "plain", hidden: false, supportedReasoningEfforts: [], defaultReasoningEffort: null }
    ], nextCursor: null }) });
    try {
      const models = (await adapter.listModels(null)).models;
      Assert.areEqual("standard:Standard:null+priority:Fast:Faster replies.+flex:null:null|standard:Standard:null+fast:null:null|",
        models.map(t => t.speeds.map(u => [u.id, String(u.name), String(u.description)].join(":")).join("+")).join("|"));
      Assert.areEqual("priority|standard|null", models.map(t => String(t.defaultSpeed)).join("|"));
    }
    finally {
      await adapter.shutdown();
    }
  }

  @TestMethod
  public async offersOnlyTheDefaultEffortForAModelThatListsNoneAndEveryListedLevelInOrderWithTheDefaultAmongThem(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_MODELS: JSON.stringify({ data: [
      { model: "fixed", hidden: false, supportedReasoningEfforts: [], defaultReasoningEffort: "medium" },
      { model: "bare", hidden: false, supportedReasoningEfforts: [], defaultReasoningEffort: null },
      { model: "ranged", hidden: false, supportedReasoningEfforts: [{ reasoningEffort: "minimal", description: "" }, { reasoningEffort: "ultra", description: "" }],
        defaultReasoningEffort: "minimal" },
      { model: "elsewhere", hidden: false, supportedReasoningEfforts: [{ reasoningEffort: "low", description: "" }], defaultReasoningEffort: "medium" },
      { model: "unlisted", hidden: false, defaultReasoningEffort: "high" }
    ], nextCursor: null }) });
    try {
      const models = (await adapter.listModels(null)).models;
      Assert.areEqual("medium||minimal,ultra|low|null", models.map(t => t.effortLevels?.join(",") ?? "null").join("|"));
      Assert.areEqual("medium|null|minimal|null|null", models.map(t => t.defaultEffort ?? "null").join("|"));
    }
    finally {
      await adapter.shutdown();
    }
  }

  @TestMethod
  public async namesEachListedLevelAsCodexsPickerDoesInItsOrder(): Promise<void> {
    using host = new CodexTestHost();
    const level = (reasoningEffort: string): { reasoningEffort: string; description: string } => ({ reasoningEffort, description: `${reasoningEffort} effort` });
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_MODELS: JSON.stringify({ data: [
      { model: "frontier", hidden: false, supportedReasoningEfforts: ["low", "medium", "high", "xhigh", "max", "ultra"].map(level), defaultReasoningEffort: "medium" },
      { model: "mini", hidden: false, supportedReasoningEfforts: ["minimal", "low", "medium", "high"].map(level), defaultReasoningEffort: "medium" },
      { model: "pinned", hidden: false, supportedReasoningEfforts: [], defaultReasoningEffort: "xhigh" }
    ], nextCursor: null }) });
    try {
      const models = (await adapter.listModels(null)).models;
      Assert.areEqual("low,medium,high,xhigh,max,ultra|minimal,low,medium,high|xhigh", models.map(t => t.effortLevels?.join(",")).join("|"));
      Assert.areEqual(JSON.stringify([{ xhigh: "Extra high" }, {}, { xhigh: "Extra high" }]), JSON.stringify(models.map(t => t.effortNames)));
      Assert.areEqual("medium|medium|xhigh", models.map(t => t.defaultEffort).join("|"));
    }
    finally {
      await adapter.shutdown();
    }
  }

  @TestMethod
  public async preservesDiscoveredCapabilitiesAndUnknownFields(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const older = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_MODELS: JSON.stringify({ data: [{ model: "future", hidden: false }], nextCursor: null }) });
    const invalid = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_MODELS: JSON.stringify({ data: [{ model: "bad", hidden: false, supportedReasoningEfforts: "high" }] }) });
    const looping = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_MODELS: JSON.stringify({ data: [], nextCursor: "repeat" }) });
    try {
      const models = (await adapter.listModels(null)).models;
      Assert.areEqual(1, models.length);
      Assert.areEqual("Sol", models[0]?.displayName);
      Assert.areEqual("high,xhigh", models[0]?.effortLevels?.join(","));
      Assert.isTrue(models[0]?.supportsImages ?? false);
      Assert.isTrue(models[0]?.isDefault ?? false);
      const legacy = (await older.listModels(null)).models[0];
      Assert.areEqual("future", legacy?.displayName);
      Assert.isNull(legacy?.effortLevels);
      Assert.isNull(legacy?.supportsImages);
      await Assert.throwsAsync(() => invalid.listModels(null), JsonException);
      const error = await Assert.throwsAsync(() => looping.listModels(null), Error);
      Assert.isTrue(error.message.includes("pagination limit"));
    }
    finally {
      await Promise.all([adapter.shutdown(), older.shutdown(), invalid.shutdown(), looping.shutdown()]);
    }
  }
}
