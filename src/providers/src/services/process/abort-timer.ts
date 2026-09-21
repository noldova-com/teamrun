/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../../resources.js";

export class AbortTimer implements Disposable {
  private readonly signal: AbortSignal;
  private readonly delayMilliseconds: number;
  private readonly resolvers: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private readonly onAbort: () => void;
  private timer: NodeJS.Timeout | null = null;

  public constructor(signal: AbortSignal, delayMilliseconds: number) {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(delayMilliseconds, Resources.delayParameterName);

    this.signal = signal;
    this.delayMilliseconds = delayMilliseconds;
    this.onAbort = () => this.arm();
    if (signal.aborted)
      this.arm();
    else
      signal.addEventListener(Resources.abortEvent, this.onAbort, { once: true });
  }

  public get elapsed(): boolean {
    return this.hasElapsed;
  }

  private hasElapsed: boolean = false;

  public wait(): Promise<void> {
    return this.resolvers.promise;
  }

  public [Symbol.dispose](): void {
    this.signal.removeEventListener(Resources.abortEvent, this.onAbort);
    if (!Object.isNull(this.timer))
      clearTimeout(this.timer);
  }

  private arm(): void {
    this.timer = setTimeout(() => {
      this.hasElapsed = true;
      this.resolvers.resolve();
    }, this.delayMilliseconds);
  }
}
