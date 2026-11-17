/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { SubAgent, SubAgentStatus } from "@noldova/teamrun.protocol";

@TestClass
export class SubAgentTests {
  private static readonly running: object = {
    toolUseId: "toolu_1", type: "Explore", description: "Find the parser", model: null, status: "Running", isBackground: true, toolUses: 3, tokens: 1200, durationMs: 4000,
    summary: "Reading src/parser.ts"
  };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = SubAgent.fromJson(SubAgentTests.running);

    Assert.areEqual(JSON.stringify(SubAgentTests.running), JSON.stringify(value.toJson()));
    Assert.isTrue(value.isRunning);
  }

  @TestMethod
  public keepsBlankTextAsNullAndCountsAsUnreportedByDefault(): void {
    const value = new SubAgent(String.empty, " ", "Review the diff", String.empty, SubAgentStatus.Running, false, null, null, null, " ");

    Assert.areEqual(JSON.stringify([null, null, null, null, null, null, null]),
      JSON.stringify([value.toolUseId, value.type, value.model, value.toolUses, value.tokens, value.durationMs, value.summary]));
    Assert.areEqual(JSON.stringify([null, null, null, null]), JSON.stringify([new SubAgent(null, null, "Plan", null, SubAgentStatus.Running, false)]
      .flatMap(t => [t.toolUses, t.tokens, t.durationMs, t.summary])));
  }

  @TestMethod
  public changesOnlyWhatItIsGiven(): void {
    const value = SubAgent.fromJson(SubAgentTests.running);
    const ended = value.with({ status: SubAgentStatus.Completed, tokens: 2400, summary: "Found it" });
    const kept = value.with({ model: null, toolUses: null });
    const moved = new SubAgent(null, null, "Plan", null, SubAgentStatus.Running, false).with({ isBackground: true });

    Assert.areEqual(JSON.stringify(["toolu_1", "Explore", "Find the parser", null, "Completed", true, 3, 2400, 4000, "Found it"]),
      JSON.stringify([ended.toolUseId, ended.type, ended.description, ended.model, ended.status, ended.isBackground, ended.toolUses, ended.tokens, ended.durationMs, ended.summary]));
    Assert.isFalse(ended.isRunning);
    Assert.areEqual(JSON.stringify(value.toJson()), JSON.stringify(kept.toJson()));
    Assert.isTrue(moved.isBackground);
  }

  @TestMethod
  public marksTeamRunsOwnHelperOnlyWhenToldAndKeepsTheMarkThroughChanges(): void {
    const helper = new SubAgent("sub-1", "Helper", "Check the tests", null, SubAgentStatus.Running, true, null, null, null, null, true);
    const ended = helper.with({ status: SubAgentStatus.Completed });
    const restored = SubAgent.fromJson(ended.toJson());

    Assert.areEqual(JSON.stringify([false, true, true, true]),
      JSON.stringify([SubAgent.fromJson(SubAgentTests.running).isTeamRun, helper.isTeamRun, ended.isTeamRun, restored.isTeamRun]));
    Assert.isTrue(Object.hasOwn(helper.toJson(), "isTeamRun"));
    Assert.isFalse(Object.hasOwn(SubAgent.fromJson(SubAgentTests.running).toJson(), "isTeamRun"));
    Assert.throws(() => SubAgent.fromJson({ ...SubAgentTests.running, isTeamRun: "yes" }), JsonException);
  }

  @TestMethod
  public rejectsABlankDescriptionAndCountsThatArentNonNegativeIntegers(): void {
    Assert.throws(() => new SubAgent(null, null, " ", null, SubAgentStatus.Running, false), ArgumentException);
    for (const count of [-1, 1.5])
      for (const position of [0, 1, 2])
        Assert.throws(() => new SubAgent(null, null, "Plan", null, SubAgentStatus.Running, false, ...[0, 0, 0].map((t, i) => i === position ? count : t) as [number, number, number]),
          ArgumentOutOfRangeException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const badStatus = Assert.throws(() => SubAgent.fromJson({ ...SubAgentTests.running, status: "Paused" }, "$.payload"), JsonException);
    const missing = Assert.throws(() => SubAgent.fromJson({ ...SubAgentTests.running, isBackground: undefined }), JsonException);

    Assert.areEqual("$.payload.status", badStatus.path);
    Assert.areEqual("$.isBackground", missing.path);
  }
}
