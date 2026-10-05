/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Signal, type WritableSignal, signal } from "@angular/core";

import type { ContentPadding } from "../enums/content-padding";

export class ContentPaddingRef {
  private readonly chosen: WritableSignal<ContentPadding | null> = signal(null);

  public readonly value: Signal<ContentPadding | null> = this.chosen.asReadonly();

  public set(padding: ContentPadding): void {
    this.chosen.set(padding);
  }

  public reset(): void {
    this.chosen.set(null);
  }
}
