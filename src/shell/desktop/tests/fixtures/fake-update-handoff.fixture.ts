/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IUpdateHandoff, UpdateReadyRecord } from "@noldova/teamrun-shell-desktop";

export class FakeUpdateHandoff implements IUpdateHandoff {
  public readonly handedOff: string[] = [];
  public clears: number = 0;
  public refusal: string | null = null;
  public handOff: (record: UpdateReadyRecord) => Promise<number | null> = () => Promise.resolve(null);
  public onClear: () => void = () => undefined;

  public handOffAsync(record: UpdateReadyRecord): Promise<number | null> {
    this.handedOff.push(record.version);
    return this.handOff(record);
  }

  public clearAsync(): Promise<void> {
    this.clears++;
    this.onClear();
    return Promise.resolve();
  }
}
