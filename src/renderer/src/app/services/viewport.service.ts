/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { Injectable, type Signal, type WritableSignal, inject, signal } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { Resources } from "../resources";

@Injectable({ providedIn: "root" })
export class ViewportService {
  private readonly view: Window | null = inject(DOCUMENT).defaultView;
  private readonly widthSignal: WritableSignal<number> = signal(this.view?.innerWidth ?? 0);
  private readonly heightSignal: WritableSignal<number> = signal(this.view?.innerHeight ?? 0);

  public readonly width: Signal<number> = this.widthSignal.asReadonly();
  public readonly height: Signal<number> = this.heightSignal.asReadonly();

  public constructor() {
    this.view?.addEventListener(Resources.resizeEvent, () => this.measure());
  }

  private measure(): void {
    if (Object.isNull(this.view))
      return;

    this.widthSignal.set(this.view.innerWidth);
    this.heightSignal.set(this.view.innerHeight);
  }
}
