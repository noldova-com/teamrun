/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { HandlerSubscription } from "@noldova/teamrun-providers";

@TestClass
export class HandlerSubscriptionTests {
  @TestMethod
  public removesTheHandlerOnDispose(): void {
    const handlers = new Set<string>(["a", "b"]);
    const subscription = new HandlerSubscription(handlers, "a");

    Assert.isTrue(subscription.isActive);
    subscription[Symbol.dispose]();

    Assert.isFalse(subscription.isActive);
    Assert.areEqual("b", [...handlers].join(","));
  }
}
