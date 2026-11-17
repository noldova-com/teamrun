/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IComputerUseAppDescription, IComputerUseApps } from "@noldova/teamrun.runtime";

export class FakeComputerUseApps implements IComputerUseApps {
  public readonly described: string[] = [];
  public readonly signals: AbortSignal[] = [];
  public readonly descriptions: Map<string, IComputerUseAppDescription> = new Map();

  public describeAsync(identity: string, signal: AbortSignal): Promise<IComputerUseAppDescription | null> {
    this.described.push(identity);
    this.signals.push(signal);
    return Promise.resolve(this.descriptions.get(identity) ?? null);
  }
}
