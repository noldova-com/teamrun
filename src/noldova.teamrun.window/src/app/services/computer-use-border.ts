/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IWindowPartContext } from "@noldova/desktop.window";

import { Resources } from "../../resources";

export class ComputerUseBorder {
  private static readonly borders: WeakMap<IWindowPartContext, ComputerUseBorder> = new WeakMap();

  private readonly context: IWindowPartContext;
  private readonly observer: MutationObserver;
  private readonly stopListening: () => void;
  private sent: string | null = null;

  private constructor(context: IWindowPartContext) {
    this.context = context;
    this.observer = new MutationObserver(() => this.send());
    this.observer.observe(document.documentElement, { attributeFilter: [Resources.styleAttribute] });
    this.stopListening = context.onDependencyChanged((moduleId, isActive) => {
      if (moduleId === Resources.computerUseModuleId && isActive)
        this.sendAgain();
    });
    this.send();
  }

  public static register(context: IWindowPartContext): void {
    ComputerUseBorder.borders.set(context, new ComputerUseBorder(context));
  }

  public static reload(context: IWindowPartContext): void {
    ComputerUseBorder.borders.get(context)?.sendAgain();
  }

  public static release(context: IWindowPartContext): void {
    ComputerUseBorder.borders.get(context)?.stop();
    ComputerUseBorder.borders.delete(context);
  }

  private stop(): void {
    this.observer.disconnect();
    this.stopListening();
  }

  private sendAgain(): void {
    this.sent = null;
    this.send();
  }

  private send(): void {
    const color = getComputedStyle(document.documentElement).getPropertyValue(Resources.accentProperty).trim();
    if (color === this.sent || !Resources.borderColorPattern.test(color))
      return;
    this.sent = color;
    void this.context.requestAsync(Resources.computerUseBorderColorSetMethod, { color }).catch(() => undefined);
  }
}
