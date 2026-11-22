/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { EventHub, IEventListener } from "@noldova/teamrun.core";

export class FailingDelivery implements Disposable {
  private isActive: boolean = true;

  private constructor(hub: EventHub, listener: IEventListener) {
    const publish = hub.publish.bind(hub);
    hub.publish = (event): void => {
      publish(event);
      if (this.isActive)
        listener.onEvent(event);
    };
  }

  public static on(hub: EventHub, listener: IEventListener): FailingDelivery {
    return new FailingDelivery(hub, listener);
  }

  public [Symbol.dispose](): void {
    this.isActive = false;
  }
}
