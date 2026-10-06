/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { UpdateProcess } from "@noldova/teamrun-shell-protocol";
import { UpdateBarrier, UpdateBarrierState } from "@noldova/teamrun-shell-runtime";
import type { IUpdateHost } from "@noldova/teamrun-shell-desktop";

export class FakeUpdateHost implements IUpdateHost {
  public static readonly COORDINATOR: UpdateProcess = new UpdateProcess(4120, 1500, 1501, "desktop");

  public readonly processId: number = 4121;
  public readonly barriers: (UpdateBarrier | null | Error)[] = [];
  public readonly ended: (boolean | Error)[] = [];
  public reading: Promise<UpdateBarrier | null> | null = null;
  public problems: readonly string[] = [];
  public saveCount: number = 0;
  public quitCount: number = 0;

  public static barrier(state: UpdateBarrierState, holder: UpdateProcess = FakeUpdateHost.COORDINATOR): UpdateBarrier {
    return new UpdateBarrier(holder, "0.3.0", state, null);
  }

  public readBarrierAsync(): Promise<UpdateBarrier | null> {
    if (!Object.isNull(this.reading))
      return this.reading;
    const barrier = this.barriers.length === 0 ? FakeUpdateHost.barrier(UpdateBarrierState.Preparing) : this.barriers.shift() ?? null;
    return barrier instanceof Error ? Promise.reject(barrier) : Promise.resolve(barrier);
  }

  public hasUpdateEndedAsync(): Promise<boolean> {
    const ended = this.ended.shift() ?? false;
    return ended instanceof Error ? Promise.reject(ended) : Promise.resolve(ended);
  }

  public saveAsync(): Promise<readonly string[]> {
    this.saveCount++;
    return Promise.resolve(this.problems);
  }

  public quit(): void {
    this.quitCount++;
  }
}
