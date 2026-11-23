/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, DOCUMENT, type WritableSignal, afterNextRender, inject, signal } from "@angular/core";
import { ChoicePillsComponent, SelectOption, ThemeMode } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";

@Component({
  selector: "nol-docs-theme-switch",
  imports: [ChoicePillsComponent],
  templateUrl: "./docs-theme-switch.component.html"
})
export class DocsThemeSwitchComponent {
  private readonly document: Document = inject(DOCUMENT);

  protected readonly resources: typeof Resources = Resources;
  protected readonly options: readonly SelectOption[] = [
    new SelectOption(Resources.themeSystem, Resources.themeSystem),
    new SelectOption(ThemeMode.Light, Resources.themeLight),
    new SelectOption(ThemeMode.Dark, Resources.themeDark)
  ];
  protected readonly choice: WritableSignal<string> = signal(Resources.themeSystem);

  public constructor() {
    afterNextRender(() => this.choice.set(this.document.documentElement.getAttribute(Resources.themeModeAttribute) ?? Resources.themeSystem));
  }

  protected choose(value: string): void {
    this.choice.set(value);
    const root = this.document.documentElement;
    if (value === Resources.themeSystem)
      root.removeAttribute(Resources.themeModeAttribute);
    else
      root.setAttribute(Resources.themeModeAttribute, value);
    this.store(value);
  }

  private store(value: string): void {
    try {
      if (value === Resources.themeSystem)
        localStorage.removeItem(Resources.themeStorageKey);
      else
        localStorage.setItem(Resources.themeStorageKey, value);
    }
    catch (error) {
      if (!(error instanceof DOMException))
        throw error;
    }
  }
}
