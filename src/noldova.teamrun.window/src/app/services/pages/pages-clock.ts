/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DestroyRef, inject, Injectable, type Signal, signal } from "@angular/core";

import { ChatPagesResources } from "./chat-pages-resources";

@Injectable({ providedIn: "root" })
export class PagesClock {
  public now(): number {
    return Date.now();
  }

  public every(milliseconds: number, tick: () => void): () => void {
    const timer = setInterval(tick, milliseconds);
    return () => clearInterval(timer);
  }

  public static ticking(): Signal<number> {
    const clock = inject(PagesClock);
    const now = signal(clock.now());
    inject(DestroyRef).onDestroy(clock.every(ChatPagesResources.minuteMilliseconds, () => now.set(clock.now())));
    return now.asReadonly();
  }

  public static formatSince(at: string, now: number): string {
    return ChatPagesResources.formatAgo(Math.max(0, Math.floor((now - Date.parse(at)) / ChatPagesResources.minuteMilliseconds)));
  }
}
