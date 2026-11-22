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
import { OrganizationParent, TeammatePlaceParams } from "@noldova/teamrun.protocol";

@TestClass
export class TeammatePlaceParamsTests {
  @TestMethod
  public preservesItsFieldsAndRejectsMalformedValues(): void {
    const json = new TeammatePlaceParams("o1", "t1", OrganizationParent.teammate("t0"), 3).toJson();
    const out = TeammatePlaceParams.fromJson(new TeammatePlaceParams("o1", "t1", null, 0).toJson());

    Assert.areEqual(JSON.stringify({ organizationId: "o1", teammateId: "t1", parent: { kind: "Teammate", id: "t0" }, order: 3 }), JSON.stringify(json));
    Assert.areEqual(JSON.stringify(json), JSON.stringify(TeammatePlaceParams.fromJson(json).toJson()));
    Assert.isNull(out.parent);
    Assert.areEqual("$.input.teammateId", Assert.throws(() => TeammatePlaceParams.fromJson({ ...json, teammateId: " " }, "$.input"), JsonException).path);
    Assert.areEqual("$.input.parent.kind", Assert.throws(() => TeammatePlaceParams.fromJson({ ...json, parent: { kind: "Team", id: "t0" } }, "$.input"),
      JsonException).path);
    Assert.areEqual("$.input.order", Assert.throws(() => TeammatePlaceParams.fromJson({ ...json, order: 1.5 }, "$.input"), JsonException).path);
  }

  @TestMethod
  public validatesConstructorArguments(): void {
    Assert.areEqual("organizationId", Assert.throws(() => new TeammatePlaceParams(" ", "t1", null, 0), ArgumentException).parameterName);
    Assert.areEqual("$.input.organizationId", Assert.throws(() => TeammatePlaceParams.fromJson({ teammateId: "t1", parent: null, order: 0 }, "$.input"), JsonException).path);
    Assert.areEqual("teammateId", Assert.throws(() => new TeammatePlaceParams("o1", " ", null, 0), ArgumentException).parameterName);
    Assert.areEqual("parent", Assert.throws(() => new TeammatePlaceParams("o1", "t1", OrganizationParent.teammate("t1"), 0), ArgumentException).parameterName);
    Assert.areEqual("order", Assert.throws(() => new TeammatePlaceParams("o1", "t1", null, -1), ArgumentException).parameterName);
    Assert.areEqual("order", Assert.throws(() => new TeammatePlaceParams("o1", "t1", null, 0.5), ArgumentException).parameterName);
    Assert.areEqual("t1", new TeammatePlaceParams("o1", "t1", OrganizationParent.department("t1"), 0).parent?.id);
  }
}
