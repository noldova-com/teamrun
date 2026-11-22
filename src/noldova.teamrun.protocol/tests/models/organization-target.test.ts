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
import { OrganizationTarget, OrganizationTargetKind } from "@noldova/teamrun.protocol";

@TestClass
export class OrganizationTargetTests {
  @TestMethod
  public roundTripsEachKindThroughJsonAndComparesByKindAndId(): void {
    const targets = [OrganizationTarget.teammate("t1"), OrganizationTarget.department("d1"), OrganizationTarget.leaders, OrganizationTarget.everyone];

    Assert.areEqual(JSON.stringify(targets.map(t => t.toJson())), JSON.stringify(targets.map(t => OrganizationTarget.fromJson(t.toJson()).toJson())));
    Assert.areEqual("true false false", [OrganizationTarget.teammate("t1").equals(OrganizationTarget.teammate("t1")),
      OrganizationTarget.teammate("t1").equals(OrganizationTarget.department("t1")), OrganizationTarget.teammate("t2").equals(OrganizationTarget.teammate("t1"))].join(" "));
  }

  @TestMethod
  public refusesAnIdForLeadersOrEveryoneAndNoneOrABlankOneForATeammateOrDepartment(): void {
    Assert.throws(() => new OrganizationTarget(OrganizationTargetKind.Leaders, "t1"), ArgumentException);
    Assert.throws(() => new OrganizationTarget(OrganizationTargetKind.Teammate, null), ArgumentException);
    Assert.throws(() => OrganizationTarget.department(" "), ArgumentException);
    Assert.areEqual("$.input.kind", Assert.throws(() => OrganizationTarget.fromJson({ kind: "Team", id: null }, "$.input"), JsonException).path);
  }
}
