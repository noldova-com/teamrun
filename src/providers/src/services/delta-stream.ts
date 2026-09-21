/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { type ITurnListener, TurnDetail } from "@noldova/teamrun-core";
import type { DetailKind } from "@noldova/teamrun-protocol";

import { Resources } from "../resources.js";

export class DeltaStream {
  private readonly listener: ITurnListener;
  private readonly interval: number;
  private readonly texts: Map<string, string> = new Map();
  private readonly pending: Map<string, TurnDetail> = new Map();
  private timer: NodeJS.Timeout | null = null;

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
      this.timer = setTimeout(() => this.flush(), this.interval);
  }

  public flush(): void {
    if (!Object.isNull(this.timer)) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    for (const detail of this.pending.values())
      if (!String.isNullOrWhitespace(detail.text))
        this.listener.onDetail(detail);
    this.pending.clear();
  }

  public forget(id: string): void {
    this.texts.delete(id);
    this.pending.delete(id);
  }
}
