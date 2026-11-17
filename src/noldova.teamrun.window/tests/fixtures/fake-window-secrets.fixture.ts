/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IWindowSecrets } from "@noldova/desktop.window";

export class FakeWindowSecrets implements IWindowSecrets {
  public readonly values: Map<string, string> = new Map();
  public readonly removed: string[] = [];
  public refusal: string | null = null;
  public removalRefusal: string | null = null;

  public saveAsync(name: string, value: string): Promise<void> {
    if (!Object.isNull(this.refusal))
      return Promise.reject(new Error(this.refusal));
    this.values.set(name, value);
    return Promise.resolve();
  }

  public removeAsync(name: string): Promise<void> {
    if (!Object.isNull(this.removalRefusal))
      return Promise.reject(new Error(this.removalRefusal));
    this.removed.push(name);
    this.values.delete(name);
    return Promise.resolve();
  }

  public isSetAsync(name: string): Promise<boolean> {
    return Promise.resolve(this.values.has(name));
  }
}
