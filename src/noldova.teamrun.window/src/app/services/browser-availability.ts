/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type WritableSignal, signal } from "@angular/core";
import "@noldova/context.core";
import type { IWindowPartContext } from "@noldova/desktop.window";

import { Resources } from "../../resources";

export class BrowserAvailability {
  private static readonly availabilities: WeakMap<IWindowPartContext, BrowserAvailability> = new WeakMap();
  private readonly active: WritableSignal<boolean>;
  private readonly stopListening: () => void;

  private constructor(context: IWindowPartContext) {
    this.active = signal(context.isDependencyActive(Resources.browserModuleId));
    this.stopListening = context.onDependencyChanged((moduleId, isActive) => {
      if (moduleId === Resources.browserModuleId)
        this.active.set(isActive);
    });
  }

  public static register(context: IWindowPartContext): void {
    BrowserAvailability.availabilities.set(context, new BrowserAvailability(context));
  }

  public static isActive(context: IWindowPartContext): boolean {
    return BrowserAvailability.availabilities.get(context)?.active() ?? false;
  }

  public static release(context: IWindowPartContext): void {
    BrowserAvailability.availabilities.get(context)?.stopListening();
    BrowserAvailability.availabilities.delete(context);
  }
}
