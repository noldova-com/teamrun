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
import { SharedMcpVariable, SharedMcpVariableSource } from "@noldova/teamrun.protocol";

@TestClass
export class SharedMcpVariableTests {
  @TestMethod
  public keepsWhereAVariableTakesItsValueAndWhetherOneIsThere(): void {
    for (const source of Object.values(SharedMcpVariableSource))
      for (const set of [true, false]) {
        const json = new SharedMcpVariable("GITHUB_TOKEN", source, set).toJson();
        Assert.areEqual(JSON.stringify({ variable: "GITHUB_TOKEN", source, set, updatedAt: null }), JSON.stringify(SharedMcpVariable.fromJson(json).toJson()));
      }
    Assert.areEqual("2026-11-01T10:00:00.000Z", SharedMcpVariable.fromJson(new SharedMcpVariable("A", SharedMcpVariableSource.Saved, true, "2026-11-01T10:00:00.000Z").toJson()).updatedAt);
    Assert.isNull(SharedMcpVariable.fromJson({ variable: "A", source: "Saved", set: true }).updatedAt);
    Assert.areEqual("$.v.source", Assert.throws(() => SharedMcpVariable.fromJson({ variable: "A", source: "Keychain", set: true }, "$.v"),
      JsonException).path);
    Assert.areEqual("$.v.set", Assert.throws(() => SharedMcpVariable.fromJson({ variable: "A", source: "Saved" }, "$.v"), JsonException).path);
  }

  @TestMethod
  public refusesANameThatIsntAVariableOrAnUnknownSource(): void {
    Assert.areEqual("variable", Assert.throws(() => new SharedMcpVariable("A-B", SharedMcpVariableSource.Saved, true), ArgumentException).parameterName);
    Assert.areEqual("source", Assert.throws(() => new SharedMcpVariable("A", "Keychain" as SharedMcpVariableSource, true), ArgumentException).parameterName);
  }
}
