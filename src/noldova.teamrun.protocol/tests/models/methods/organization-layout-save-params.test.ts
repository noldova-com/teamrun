/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { OrganizationLayoutSaveParams } from "@noldova/teamrun.protocol";

@TestClass
export class OrganizationLayoutSaveParamsTests {
  @TestMethod
  public roundTripsALayoutThroughJsonAsItIs(): void {
    const json = { layout: { collapsed: ["d1"], cardsShow: { status: true, usage: false }, cards: { t1: { usage: true } } } };

    Assert.areEqual(JSON.stringify(json), JSON.stringify(OrganizationLayoutSaveParams.fromJson(json).toJson()));
  }

  @TestMethod
  public rejectsAMissingLayoutOrOneThatIsNotAnObjectWithItsPath(): void {
    for (const json of [{}, { layout: null }, { layout: ["d1"] }, { layout: "{}" }])
      Assert.areEqual("$.layout", Assert.throws(() => OrganizationLayoutSaveParams.fromJson(json), JsonException).path);
  }
}
