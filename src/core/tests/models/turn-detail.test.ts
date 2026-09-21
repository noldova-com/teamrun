/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { TurnDetail } from "@noldova/teamrun-core";
import { DetailKind } from "@noldova/teamrun-protocol";

@TestClass
export class TurnDetailTests {
  @TestMethod
  public holdsOneDetail(): void {
    const detail = new TurnDetail(DetailKind.Command, "npm test", { exitCode: 0 }, "item-1");

    Assert.areEqual(DetailKind.Command, detail.kind);
    Assert.areEqual("npm test", detail.text);
    Assert.areEqual("{\"exitCode\":0}", JSON.stringify(detail.payload));
    Assert.areEqual("item-1", detail.providerItemId);
    Assert.isNull(new TurnDetail(DetailKind.Text, "Hi", null, null).providerItemId);
  }

  @TestMethod
  public rejectsABlankItemId(): void {
    Assert.areEqual("providerItemId", Assert.throws(() => new TurnDetail(DetailKind.Text, "Hi", null, ""), ArgumentException).parameterName);
  }
}
