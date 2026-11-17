/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { ISharedMcpSecrets } from "@noldova/teamrun.core";

import { ChangeSignal } from "./change-signal.fixture.js";

export class FakeSharedMcpSecrets implements ISharedMcpSecrets {
  public readonly values: Map<string, string> = new Map();
  public readonly reads: string[] = [];
  public readonly removed: string[] = [];
  public refusal: string | null = null;
  public refusesWithText: boolean = false;
  public hold: Promise<void> | null = null;

  public readAsync(name: string): Promise<string | null> {
    this.reads.push(name);
    ChangeSignal.notify();
    return this.answer(() => this.values.get(name) ?? null);
  }

  public async removeAsync(name: string): Promise<void> {
    if (!Object.isNull(this.hold))
      await this.hold;
    return this.answer(() => {
      this.removed.push(name);
      ChangeSignal.notify();
      this.values.delete(name);
    });
  }

  public isSetAsync(name: string): Promise<boolean> {
    return this.answer(() => this.values.has(name));
  }

  private answer<T>(action: () => T): Promise<T> {
    if (Object.isNull(this.refusal))
      return Promise.resolve(action());
    return Promise.reject(this.refusesWithText ? this.refusal : new Error(this.refusal));
  }
}
