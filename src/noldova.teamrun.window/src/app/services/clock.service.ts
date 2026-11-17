/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable } from "@angular/core";

@Injectable({ providedIn: "root" })
export class ClockService {
  public now(): number {
    return Date.now();
  }

  public every(milliseconds: number, tick: () => void): () => void {
    const timer = setInterval(tick, milliseconds);
    return () => clearInterval(timer);
  }

  public after(milliseconds: number, done: () => void): () => void {
    const timer = setTimeout(done, milliseconds);
    return () => clearTimeout(timer);
  }
}
