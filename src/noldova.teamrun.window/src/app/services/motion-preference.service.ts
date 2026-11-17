/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, type Signal, signal, type WritableSignal } from "@angular/core";
import "@noldova/context.core";

import { Resources } from "../../resources";

@Injectable({ providedIn: "root" })
export class MotionPreferenceService {
  private readonly query: MediaQueryList = globalThis.matchMedia(Resources.reducedMotionQuery);
  private readonly isReduced: WritableSignal<boolean> = signal(this.query.matches);

  public readonly reduced: Signal<boolean> = this.isReduced.asReadonly();

  public constructor() {
    this.query.addEventListener("change", event => this.isReduced.set(event.matches));
  }
}
