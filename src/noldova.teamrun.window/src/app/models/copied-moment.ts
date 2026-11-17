/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type Signal, type WritableSignal } from "@angular/core";

import { Resources } from "../../resources";
import { ClockService } from "../services/clock.service";

export class CopiedMoment<T> {
  private readonly clock: ClockService;
  private readonly value: WritableSignal<T | null> = signal(null);
  private cancel: () => void = () => undefined;
  private disposed: boolean = false;

  public readonly shown: Signal<T | null> = this.value.asReadonly();

  public constructor(clock: ClockService = new ClockService()) {
    this.clock = clock;
  }

  public show(value: T): void {
    if (this.disposed)
      return;
    this.clear();
    this.value.set(value);
    this.cancel = this.clock.after(Resources.copiedDuration, () => this.clear());
  }

  public clear(): void {
    this.cancel();
    this.cancel = () => undefined;
    this.value.set(null);
  }

  public dispose(): void {
    this.disposed = true;
    this.clear();
  }
}
