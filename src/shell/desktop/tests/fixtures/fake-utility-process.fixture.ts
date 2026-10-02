/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IUtilityProcess } from "@noldova/teamrun-shell-desktop";

export class FakeUtilityProcess implements IUtilityProcess {
  private readonly listeners: Map<string, (value: unknown) => void> = new Map();

  public readonly messages: unknown[] = [];

  public postMessage(message: unknown): void {
    this.messages.push(message);
  }

  public once(event: "message" | "exit", listener: (value: unknown) => void): this {
    this.listeners.set(event, listener);
    return this;
  }

  public emit(event: "message" | "exit", value: unknown): void {
    this.listeners.get(event)?.(value);
  }
}
