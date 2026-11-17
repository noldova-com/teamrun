/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProviderContextWindows, ProviderModel, ProviderSpeed } from "@noldova/teamrun.protocol";

@TestClass
export class ProviderModelTests {
  @TestMethod
  public preservesCapabilitiesAndMatchesProviderAliases(): void {
    const levels = ["high"];
    const model = new ProviderModel("alias", "A model", "Description", levels, true, "resolved", true);
    levels.push("future");
    const restored = ProviderModel.fromJson(model.toJson());
    Assert.areEqual(JSON.stringify(model.toJson()), JSON.stringify(restored.toJson()));
    Assert.areEqual("high", restored.effortLevels?.join(","));
    Assert.isTrue(restored.matches("alias"));
    Assert.isTrue(restored.matches("resolved"));
    Assert.isTrue(restored.matches(null));
    Assert.isFalse(restored.matches("another"));
    const unknown = ProviderModel.fromJson(new ProviderModel("id", "Label", "", null, false, null, null).toJson());
    Assert.isNull(unknown.effortLevels);
    Assert.isNull(unknown.supportsImages);
    Assert.isFalse(unknown.matches(null));
    Assert.areEqual(0, ProviderModel.fromJson({ ...model.toJson(), effortLevels: [] }).effortLevels?.length);
  }

  @TestMethod
  public rejectsInvalidMetadataAtTheBoundary(): void {
    const valid = new ProviderModel("id", "Label", "", [], false, null, false).toJson();
    Assert.throws(() => new ProviderModel(" ", "Label", "", [], false, null, null), ArgumentException);
    Assert.throws(() => new ProviderModel("id", " ", "", [], false, null, null), ArgumentException);
    Assert.throws(() => new ProviderModel("id", "Label", "", [" "], false, null, null), ArgumentException);
    Assert.throws(() => ProviderModel.fromJson({ ...valid, effortLevels: "high" }), JsonException);
    Assert.throws(() => ProviderModel.fromJson({ ...valid, supportsImages: "yes" }), JsonException);
  }

  @TestMethod
  public keepsTheProvidersDefaultEffortAndNamesThroughJson(): void {
    const names = { xhigh: "Extra" };
    const model = new ProviderModel("id", "Label", "", ["low", "medium", "xhigh"], false, null, null, "medium", names);
    names.xhigh = "Changed";
    const restored = ProviderModel.fromJson(model.toJson());

    Assert.areEqual(JSON.stringify(model.toJson()), JSON.stringify(restored.toJson()));
    Assert.areEqual("medium", restored.defaultEffort);
    Assert.areEqual("Extra", restored.effortNames["xhigh"]);
    const older = { ...model.toJson() };
    delete older["defaultEffort"];
    delete older["effortNames"];
    Assert.isNull(ProviderModel.fromJson(older).defaultEffort);
    Assert.areEqual(0, Object.keys(ProviderModel.fromJson(older).effortNames).length);
    Assert.isNull(new ProviderModel("id", "Label", "", ["low"], false, null, null).defaultEffort);
  }

  @TestMethod
  public keepsTheProvidersSpeedsAndDefaultSpeedThroughJson(): void {
    const speeds = [new ProviderSpeed("priority", "Fast", "Faster replies."), new ProviderSpeed("flex")];
    const model = new ProviderModel("id", "Label", "", ["low"], false, null, null, null, {}, speeds, "flex");
    speeds.pop();
    const restored = ProviderModel.fromJson(model.toJson());

    Assert.areEqual(JSON.stringify(model.toJson()), JSON.stringify(restored.toJson()));
    Assert.areEqual("priority:Fast,flex:null", restored.speeds.map(t => `${t.id}:${String(t.name)}`).join(","));
    Assert.areEqual("flex", restored.defaultSpeed);
    const older = { ...model.toJson() };
    delete older["speeds"];
    delete older["defaultSpeed"];
    const read = ProviderModel.fromJson(older);
    Assert.areEqual("0|null", [read.speeds.length, String(read.defaultSpeed)].join("|"));
    Assert.areEqual(0, new ProviderModel("id", "Label", "", null, false, null, null).speeds.length);
  }

  @TestMethod
  public rejectsARepeatedSpeedOrADefaultSpeedItDoesntList(): void {
    const fast = [new ProviderSpeed("fast")];
    const valid = new ProviderModel("id", "Label", "", null, false, null, null, null, {}, fast, null).toJson();

    Assert.areEqual("speeds", Assert.throws(() => new ProviderModel("id", "Label", "", null, false, null, null, null, {}, [new ProviderSpeed("fast"), new ProviderSpeed("fast", "Fast")],
      null), ArgumentException).parameterName);
    Assert.areEqual("defaultSpeed", Assert.throws(() => new ProviderModel("id", "Label", "", null, false, null, null, null, {}, [], "fast"), ArgumentException).parameterName);
    Assert.areEqual("$.speeds.0.id", Assert.throws(() => ProviderModel.fromJson({ ...valid, speeds: [{ id: " ", name: null, description: null }] }), JsonException).path);
    Assert.throws(() => ProviderModel.fromJson({ ...valid, defaultSpeed: 1 }), JsonException);
  }

  @TestMethod
  public rejectsADefaultOrANameOutsideItsLevels(): void {
    const valid = new ProviderModel("id", "Label", "", ["low"], false, null, null, "low", { low: "Light" }).toJson();

    Assert.throws(() => new ProviderModel("id", "Label", "", ["low"], false, null, null, "high"), ArgumentException);
    Assert.throws(() => new ProviderModel("id", "Label", "", null, false, null, null, "low"), ArgumentException);
    Assert.throws(() => new ProviderModel("id", "Label", "", ["low"], false, null, null, null, { high: "Deep" }), ArgumentException);
    Assert.throws(() => new ProviderModel("id", "Label", "", null, false, null, null, null, { low: "Light" }), ArgumentException);
    Assert.throws(() => new ProviderModel("id", "Label", "", ["low"], false, null, null, null, { low: " " }), ArgumentException);
    Assert.throws(() => ProviderModel.fromJson({ ...valid, defaultEffort: 1 }), JsonException);
    Assert.throws(() => ProviderModel.fromJson({ ...valid, effortNames: { low: 1 } }), JsonException);
  }

  @TestMethod
  public keepsTheContextWindowsATeammateCanChooseThroughJsonAndWritesNoneWhenItOffersNoChoice(): void {
    const model = new ProviderModel("id", "Label", "", null, false, null, null, null, {}, [], null, new ProviderContextWindows([200_000], 100_000, 400_000, true));
    const restored = ProviderModel.fromJson(model.toJson());
    const plain = new ProviderModel("id", "Label", "", null, false, null, null);

    Assert.areEqual("200000|100000|400000", [restored.contextWindows?.presets.join(","), restored.contextWindows?.minimum, restored.contextWindows?.maximum].join("|"));
    Assert.isNull(plain.contextWindows);
    Assert.isFalse(Object.hasOwn(plain.toJson(), "contextWindows"));
    Assert.isNull(ProviderModel.fromJson({ ...plain.toJson(), contextWindows: null }).contextWindows);
    Assert.areEqual("$.contextWindows.maximum", Assert.throws(() => ProviderModel.fromJson({ ...plain.toJson(), contextWindows: { presets: [], minimum: 1 } }),
      JsonException).path);
  }

  @TestMethod
  public keepsWhyAModelCantBeChosenThroughJsonAndWritesNoneForOneThatCan(): void {
    const model = new ProviderModel("terra", "Terra", "", null, false, null, null, null, {}, [], null, null, "needs Codex 0.167");
    const plain = new ProviderModel("id", "Label", "", null, false, null, null);

    Assert.areEqual("needs Codex 0.167", ProviderModel.fromJson(model.toJson()).unavailableReason);
    Assert.isNull(plain.unavailableReason);
    Assert.isFalse(Object.hasOwn(plain.toJson(), "unavailableReason"));
    Assert.isNull(ProviderModel.fromJson({ ...plain.toJson(), unavailableReason: null }).unavailableReason);
    Assert.areEqual("$.unavailableReason", Assert.throws(() => ProviderModel.fromJson({ ...plain.toJson(), unavailableReason: 3 }), JsonException).path);
    Assert.areEqual("unavailableReason", Assert.throws(() => new ProviderModel("id", "Label", "", null, false, null, null, null, {}, [], null, null, " "),
      ArgumentException).parameterName);
  }

  @TestMethod
  public keepsTheConfiguredEffortAndItsNameThroughJsonEvenWhenTheModelDoesNotListItAndWritesNoneWhenUnset(): void {
    const model = new ProviderModel("astra", "Astra", "", ["low", "medium"], true, null, null, "low", { xhigh: "Extra high" }, [], null, null, null, "xhigh");
    const plain = new ProviderModel("id", "Label", "", ["low"], false, null, null, "low");

    const restored = ProviderModel.fromJson(model.toJson());
    Assert.areEqual("xhigh,low,Extra high", [restored.configuredEffort, restored.defaultEffort, restored.effortNames["xhigh"]].join(","));
    Assert.isNull(plain.configuredEffort);
    Assert.isFalse(Object.hasOwn(plain.toJson(), "configuredEffort"));
    Assert.isNull(ProviderModel.fromJson({ ...plain.toJson(), configuredEffort: null }).configuredEffort);
    Assert.areEqual("$.configuredEffort", Assert.throws(() => ProviderModel.fromJson({ ...plain.toJson(), configuredEffort: 3 }), JsonException).path);
    Assert.areEqual("configuredEffort", Assert.throws(() => new ProviderModel("id", "Label", "", null, false, null, null, null, {}, [], null, null, null, " "),
      ArgumentException).parameterName);
    Assert.areEqual("effortNames", Assert.throws(() => new ProviderModel("id", "Label", "", ["low"], false, null, null, null, { max: "Max" }, [], null, null, null, "xhigh"),
      ArgumentException).parameterName);
  }
}
