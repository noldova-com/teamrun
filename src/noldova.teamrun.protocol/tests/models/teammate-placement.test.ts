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
import { OrganizationParent, TeammatePlacement } from "@noldova/teamrun.protocol";

@TestClass
export class TeammatePlacementTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const json = new TeammatePlacement("t1", OrganizationParent.teammate("t0"), 2).toJson();

    Assert.areEqual(JSON.stringify({ teammateId: "t1", parent: { kind: "Teammate", id: "t0" }, order: 2 }), JSON.stringify(json));
    Assert.areEqual(JSON.stringify(json), JSON.stringify(TeammatePlacement.fromJson(json).toJson()));
    Assert.areEqual("$.input.parent", Assert.throws(() => TeammatePlacement.fromJson({ ...json, parent: null }, "$.input"), JsonException).path);
    Assert.areEqual("$.input.parent.id", Assert.throws(() => TeammatePlacement.fromJson({ ...json, parent: { kind: "Person", id: 2 } }, "$.input"),
      JsonException).path);
    Assert.areEqual("$.input.order", Assert.throws(() => TeammatePlacement.fromJson({ ...json, order: "first" }, "$.input"), JsonException).path);
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    Assert.areEqual("teammateId", Assert.throws(() => new TeammatePlacement(" ", OrganizationParent.person, 0), ArgumentException).parameterName);
    Assert.areEqual("parent", Assert.throws(() => new TeammatePlacement("t1", OrganizationParent.teammate("t1"), 0), ArgumentException).parameterName);
    Assert.areEqual("order", Assert.throws(() => new TeammatePlacement("t1", OrganizationParent.person, -1), ArgumentException).parameterName);
    Assert.areEqual("order", Assert.throws(() => new TeammatePlacement("t1", OrganizationParent.person, Number.NaN), ArgumentException).parameterName);
    Assert.areEqual("t1", new TeammatePlacement("t1", OrganizationParent.department("t1"), 0).parent.id);
  }
}
