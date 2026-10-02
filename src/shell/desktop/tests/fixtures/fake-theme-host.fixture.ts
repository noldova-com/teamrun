/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IThemeHost } from "@noldova/teamrun-shell-desktop";

import { ListenerRegistry } from "./listener-registry.fixture.js";

export class FakeThemeHost implements IThemeHost {
  private readonly listeners: ListenerRegistry = new ListenerRegistry();

  public shouldUseDarkColors: boolean = false;
  public shouldUseDarkColorsForSystemIntegratedUI: boolean = false;

  public on(event: string, listener: () => void): this {
    this.listeners.add(event, listener);
    return this;
  }

  public removeListener(event: string, listener: () => void): this {
    this.listeners.remove(event, listener);
    return this;
  }

  public change(isDark: boolean, isTaskbarDark: boolean): void {
    this.shouldUseDarkColors = isDark;
    this.shouldUseDarkColorsForSystemIntegratedUI = isTaskbarDark;
    this.listeners.emit("updated");
  }

  public count(event: string): number {
    return this.listeners.count(event);
  }
}
