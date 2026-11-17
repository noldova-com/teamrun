/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { type ITurnListener, TurnDetail } from "@noldova/teamrun.core";
import type { DetailKind } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";

export class DeltaStream {
  private readonly listener: ITurnListener;
  private readonly interval: number;
  private readonly texts: Map<string, string> = new Map();
  private readonly pending: Map<string, TurnDetail> = new Map();
  private timer: NodeJS.Timeout | null = null;
  private work: Promise<void> = Promise.resolve();
  private failure: { readonly error: unknown } | null = null;

  public constructor(listener: ITurnListener, interval: number) {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(interval, Resources.streamIntervalParameterName);

    this.listener = listener;
    this.interval = interval;
  }

  public get isPending(): boolean {
    return this.pending.size > 0;
  }

  public append(id: string, kind: DetailKind, delta: string): void {
    const text = (this.texts.get(id) ?? String.empty) + delta;
    this.texts.set(id, text);
    this.pending.set(id, new TurnDetail(kind, text, null, id));
    if (Object.isNull(this.timer))
      this.timer = setTimeout(() => this.schedule(), this.interval);
  }

  public async flushAsync(): Promise<void> {
    this.schedule();
    await this.work;
    const failure = this.failure;
    this.failure = null;
    if (!Object.isNull(failure))
      throw failure.error;
  }

  private schedule(): void {
    if (!Object.isNull(this.timer)) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const details = [...this.pending.values()].filter(t => !String.isNullOrWhitespace(t.text));
    this.pending.clear();
    this.work = this.work.then(() => this.reportAsync(details)).catch((error: unknown) => {
      this.failure ??= { error };
    });
  }

  private async reportAsync(details: readonly TurnDetail[]): Promise<void> {
    for (const detail of details)
      await this.listener.onDetailAsync(detail);
  }

  public forget(id: string): void {
    this.texts.delete(id);
    this.pending.delete(id);
  }
}
