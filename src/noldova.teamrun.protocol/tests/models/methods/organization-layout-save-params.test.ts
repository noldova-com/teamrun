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
import { OrganizationLayoutSaveParams } from "@noldova/teamrun.protocol";

@TestClass
export class OrganizationLayoutSaveParamsTests {
  @TestMethod
  public roundTripsALayoutThroughJsonAsItIs(): void {
    const json = { organizationId: "o1", layout: { collapsed: ["d1"], cardsShow: { status: true, usage: false }, cards: { t1: { usage: true } } } };

    Assert.areEqual(JSON.stringify(json), JSON.stringify(OrganizationLayoutSaveParams.fromJson(json).toJson()));
  }

  @TestMethod
  public rejectsAMissingLayoutOrOneThatIsNotAnObjectWithItsPath(): void {
    for (const json of [{ organizationId: "o1" }, { organizationId: "o1", layout: null }, { organizationId: "o1", layout: ["d1"] }, { organizationId: "o1", layout: "{}" }])
      Assert.areEqual("$.layout", Assert.throws(() => OrganizationLayoutSaveParams.fromJson(json), JsonException).path);
  }

  @TestMethod
  public rejectsAMissingOrBlankOrganization(): void {
    Assert.areEqual("$.organizationId", Assert.throws(() => OrganizationLayoutSaveParams.fromJson({ layout: {} }), JsonException).path);
    Assert.areEqual("organizationId", Assert.throws(() => new OrganizationLayoutSaveParams(" ", {}), ArgumentException).parameterName);
  }
}
