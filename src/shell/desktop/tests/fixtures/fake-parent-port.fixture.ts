/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IParentPort } from "@noldova/teamrun-shell-desktop";

export class FakeParentPort implements IParentPort {
  private readonly isAcknowledging: boolean;
  private readonly listeners: (() => void)[] = [];

  public readonly messages: unknown[] = [];

  public constructor(isAcknowledging: boolean = true) {
    this.isAcknowledging = isAcknowledging;
  }

  public postMessage(message: unknown): void {
    this.messages.push(message);
    if (this.isAcknowledging)
      this.acknowledge();
  }

  public once(_event: "message", listener: () => void): this {
    this.listeners.push(listener);
    return this;
  }

  public acknowledge(): void {
    this.listeners.shift()?.();
  }
}
