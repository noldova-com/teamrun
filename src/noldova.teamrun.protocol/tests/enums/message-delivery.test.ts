/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { MessageDelivery } from "@noldova/teamrun.protocol";

@TestClass
export class MessageDeliveryTests {
  @TestMethod
  public usesMemberNamesAsValues(): void {
    Assert.areEqual("Steer", MessageDelivery.Steer);
    Assert.areEqual("Queue", MessageDelivery.Queue);
    Assert.areEqual("StopAndSend", MessageDelivery.StopAndSend);
  }

  @TestMethod
  public valuesAreDistinct(): void {
    const values = Object.values(MessageDelivery);

    Assert.areEqual(values.length, new Set(values).size);
  }
}
