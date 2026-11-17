/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProviderMode, ProviderModel, ProviderModelList } from "@noldova/teamrun.protocol";

@TestClass
export class ProviderModelListTests {
  @TestMethod
  public roundTripsItsModelsAndSignInState(): void {
    const models = [new ProviderModel("a", "A", "", null, true, null, null)];
    const list = new ProviderModelList(models, false);
    models.push(new ProviderModel("b", "B", "", null, false, null, null));
    const restored = ProviderModelList.fromJson(list.toJson());

    Assert.areEqual(JSON.stringify({ models: [list.models[0]!.toJson()], signedIn: false, empty: false, planName: null, awaitsTurn: false, modes: [], defaultMode: null,
      defaultTakesListedEfforts: false }),
      JSON.stringify(restored.toJson()));
    Assert.areEqual(1, restored.models.length);
    Assert.isTrue(restored.models[0] instanceof ProviderModel);
    Assert.areEqual(false, restored.signedIn);
    Assert.areEqual(true, ProviderModelList.fromJson({ models: [], signedIn: true }).signedIn);
    Assert.isNull(ProviderModelList.fromJson(new ProviderModelList([], null).toJson()).signedIn);
  }

  @TestMethod
  public roundTripsAListThatCameBackEmptyAndReadsAnOlderAnswerAsNotEmpty(): void {
    const restored = ProviderModelList.fromJson(new ProviderModelList([], true, true).toJson());

    Assert.areEqual(true, restored.empty);
    Assert.areEqual(true, restored.signedIn);
    Assert.areEqual(false, ProviderModelList.fromJson({ models: [], signedIn: true }).empty);
    Assert.areEqual(false, new ProviderModelList([], true).empty);
  }

  @TestMethod
  public roundTripsThePlanNameAndReadsAnOlderAnswerWithoutIt(): void {
    const restored = ProviderModelList.fromJson(new ProviderModelList([], true, false, "Copilot Free").toJson());

    Assert.areEqual("Copilot Free", restored.planName);
    Assert.areEqual(false, restored.empty);
    Assert.isNull(ProviderModelList.fromJson({ models: [], signedIn: true }).planName);
    Assert.isNull(new ProviderModelList([], true).planName);
  }

  @TestMethod
  public roundTripsAListThatAwaitsTheFirstTurnAndReadsAnOlderAnswerAsListed(): void {
    const restored = ProviderModelList.fromJson(new ProviderModelList([], true, false, null, true).toJson());

    Assert.areEqual(true, restored.awaitsTurn);
    Assert.areEqual(true, restored.signedIn);
    Assert.areEqual(false, restored.empty);
    Assert.areEqual(false, ProviderModelList.fromJson({ models: [], signedIn: true }).awaitsTurn);
    Assert.areEqual(false, new ProviderModelList([], true).awaitsTurn);
  }

  @TestMethod
  public roundTripsTheProvidersModesAndReadsAnOlderAnswerWithNone(): void {
    const modes = [new ProviderMode("acceptEdits", "Accept edits"), new ProviderMode("bypassPermissions", "Bypass", "Runs every tool without asking.", true)];
    const restored = ProviderModelList.fromJson(new ProviderModelList([], true, false, null, false, modes, "acceptEdits").toJson());

    Assert.areEqual("acceptEdits|bypassPermissions", restored.modes.map(t => t.id).join("|"));
    Assert.isTrue(restored.modes[1] instanceof ProviderMode);
    Assert.areEqual(true, restored.modes[1]!.unrestricted);
    Assert.areEqual("acceptEdits", restored.defaultMode);
    Assert.areEqual(0, ProviderModelList.fromJson({ models: [], signedIn: true }).modes.length);
    Assert.isNull(ProviderModelList.fromJson({ models: [], signedIn: true }).defaultMode);
    Assert.areEqual(0, new ProviderModelList([], true).modes.length);
  }

  @TestMethod
  public roundTripsWhetherItsDefaultModelTakesTheListedEffortsAndReadsAnOlderAnswerAsNot(): void {
    const restored = ProviderModelList.fromJson(new ProviderModelList([], true, false, null, false, [], null, true).toJson());

    Assert.areEqual(true, restored.defaultTakesListedEfforts);
    Assert.areEqual(false, ProviderModelList.fromJson({ models: [], signedIn: true }).defaultTakesListedEfforts);
    Assert.areEqual(false, new ProviderModelList([], true).defaultTakesListedEfforts);
  }

  @TestMethod
  public refusesARepeatedModeAndADefaultModeItDoesntList(): void {
    const mode = new ProviderMode("plan", "Plan");

    Assert.areEqual("modes", Assert.throws(() => new ProviderModelList([], true, false, null, false, [mode, mode]), ArgumentException).parameterName);
    Assert.areEqual("defaultMode", Assert.throws(() => new ProviderModelList([], true, false, null, false, [mode], "default"), ArgumentException).parameterName);
    Assert.areEqual("defaultMode", Assert.throws(() => new ProviderModelList([], true, false, null, false, [], "plan"), ArgumentException).parameterName);
  }

  @TestMethod
  public writesPartialOnlyWhenPartialAndKeepsItThroughAPlanMode(): void {
    const modes = [new ProviderMode("plan", "Plan", null, false, true)];
    const partial = new ProviderModelList([], true, false, null, false, modes, null, false, null, true);

    Assert.isFalse("partial" in new ProviderModelList([], true).toJson());
    Assert.isFalse(ProviderModelList.fromJson(new ProviderModelList([], true).toJson()).partial);
    Assert.isTrue(ProviderModelList.fromJson(partial.toJson()).partial);
    Assert.isTrue(partial.withPlanMode("plan").partial);
  }

  @TestMethod
  public namesAListedPlanModeAndWritesItOnlyWhenNamed(): void {
    const modes = [new ProviderMode("acceptEdits", "Accept edits"), new ProviderMode("plan", "Plan", null, false, true)];
    const list = new ProviderModelList([], true, false, null, false, modes, "acceptEdits");
    const planning = list.withPlanMode("plan");

    Assert.isNull(list.planMode);
    Assert.isFalse("planMode" in list.toJson());
    Assert.areEqual(JSON.stringify({ ...list.toJson(), planMode: "plan" }), JSON.stringify(planning.toJson()));
    Assert.areEqual("plan", ProviderModelList.fromJson(planning.toJson()).planMode);
    Assert.isNull(planning.withPlanMode(null).planMode);
    Assert.areEqual("acceptEdits|plan", planning.modes.map(t => t.id).join("|"));
    Assert.areEqual("planMode", Assert.throws(() => list.withPlanMode("ask"), ArgumentException).parameterName);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const badModels = Assert.throws(() => ProviderModelList.fromJson({ models: "x", signedIn: null }), JsonException);
    const badModel = Assert.throws(() => ProviderModelList.fromJson({ models: [{ id: "a" }], signedIn: null }), JsonException);
    const badSignedIn = Assert.throws(() => ProviderModelList.fromJson({ models: [], signedIn: "yes" }), JsonException);
    const missing = Assert.throws(() => ProviderModelList.fromJson({ models: [] }), JsonException);
    const badEmpty = Assert.throws(() => ProviderModelList.fromJson({ models: [], signedIn: true, empty: "yes" }), JsonException);
    const badPlan = Assert.throws(() => ProviderModelList.fromJson({ models: [], signedIn: true, planName: 5 }), JsonException);
    const badAwaits = Assert.throws(() => ProviderModelList.fromJson({ models: [], signedIn: true, awaitsTurn: "yes" }), JsonException);
    const badMode = Assert.throws(() => ProviderModelList.fromJson({ models: [], signedIn: true, modes: [{ id: "plan", name: "Plan", description: null }] }),
      JsonException);

    Assert.areEqual("$.models", badModels.path);
    Assert.areEqual("$.models.0.displayName", badModel.path);
    Assert.areEqual("$.signedIn", badSignedIn.path);
    Assert.areEqual("$.signedIn", missing.path);
    Assert.areEqual("$.empty", badEmpty.path);
    Assert.areEqual("$.planName", badPlan.path);
    Assert.areEqual("$.awaitsTurn", badAwaits.path);
    Assert.areEqual("$.modes.0.unrestricted", badMode.path);
  }
}
