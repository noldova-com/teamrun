/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ProviderDescriptor } from "@noldova/teamrun-protocol";

@TestClass
export class ProviderDescriptorTests {
  private static readonly json: object = {
    id: "codex",
    displayName: "Codex",
    effortLevels: ["low", "medium", "high"],
    supportsResume: true,
    supportsSignInCheck: true,
    supportsFork: true
  };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ProviderDescriptor.fromJson(ProviderDescriptorTests.json);

    Assert.areEqual(JSON.stringify(ProviderDescriptorTests.json), JSON.stringify(value.toJson()));
    Assert.isTrue(value.supportsFork);
    Assert.isFalse(ProviderDescriptor.fromJson({ ...ProviderDescriptorTests.json, supportsFork: undefined }).supportsFork);
    Assert.isFalse(new ProviderDescriptor("claude", "Claude Code", [], true, true).supportsFork);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    const valid = ProviderDescriptor.fromJson(ProviderDescriptorTests.json);

    Assert.throws(
      () => new ProviderDescriptor(String.empty, valid.displayName, valid.effortLevels, valid.supportsResume, valid.supportsSignInCheck), ArgumentException);
    Assert.throws(() => new ProviderDescriptor(valid.id, String.empty, valid.effortLevels, valid.supportsResume, valid.supportsSignInCheck), ArgumentException);
  }

  @TestMethod
  public keepsItsOwnCopyOfTheList(): void {
    const valid = ProviderDescriptor.fromJson(ProviderDescriptorTests.json);
    const items = [...valid.effortLevels];
    const value = new ProviderDescriptor(valid.id, valid.displayName, items, valid.supportsResume, valid.supportsSignInCheck);
    items.length = 0;

    Assert.areEqual(valid.effortLevels.length, value.effortLevels.length);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => ProviderDescriptor.fromJson({ ...ProviderDescriptorTests.json, effortLevels: "high" }), JsonException);

    Assert.areEqual("$.effortLevels", exception.path);
  }
}
