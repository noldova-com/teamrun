/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ProviderModel } from "@noldova/teamrun-protocol";

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
}
