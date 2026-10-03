/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { DestroyRef, Injectable, inject } from "@angular/core";

import { ScreenPoint } from "../models/screen-point";
import { Resources } from "../../resources";

@Injectable({ providedIn: "root" })
export class PointerPositionService {
  private last: ScreenPoint | null = null;

  public constructor() {
    const document = inject(DOCUMENT);
    const record = (event: MouseEvent): void => {
      this.last = ScreenPoint.of(event);
    };
    for (const name of Resources.pointerPositionEvents)
      document.addEventListener(name, record, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => {
      for (const name of Resources.pointerPositionEvents)
        document.removeEventListener(name, record, { capture: true });
    });
  }

  public get position(): ScreenPoint | null {
    return this.last;
  }
}
