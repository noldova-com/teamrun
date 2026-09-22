/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { EventSubscription, type IEventHandler } from "@noldova/teamrun-cli";

@TestClass
export class EventSubscriptionTests {
  @TestMethod
  public removesTheHandlerOnDispose(): void {
    const handler: IEventHandler = { handleEvent: () => undefined };
    const handlers = new Set<IEventHandler>([handler]);
    const subscription = new EventSubscription(handlers, handler);

    Assert.isTrue(subscription.isActive);
    subscription[Symbol.dispose]();

    Assert.isFalse(subscription.isActive);
    Assert.areEqual(0, handlers.size);
  }
}
