/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { ThemeMode } from "../enums/theme-mode";
import { ThemeException } from "../exceptions/theme.exception";
import type { Theme } from "../models/theme";
import { Resources } from "../../resources";

export class ThemePainter {
  private readonly defaultTheme: Theme;

  public constructor(defaultTheme: Theme) {
    this.defaultTheme = defaultTheme;
  }

  public paint(element: HTMLElement, theme: Theme, mode: ThemeMode): void {
    const style = element.style;
    style.setProperty(Resources.colorSchemeProperty, mode === ThemeMode.Dark ? Resources.darkScheme : Resources.lightScheme);
    for (const token of Resources.colorTokens)
      style.setProperty(token.variable, this.requireValue(token.resolve(theme, mode) ?? token.resolve(this.defaultTheme, mode), token.key));
    for (const name of Resources.lookTokens)
      style.setProperty(Resources.formatLookVariable(name), this.requireValue(theme.readLook(name) ?? this.defaultTheme.readLook(name), name));
    for (const [control, shapes] of Resources.shapes) {
      const chosen = theme.readShape(control);
      const shape = !Object.isUndefined(chosen) && shapes.includes(chosen) ? chosen : this.defaultTheme.readShape(control);
      element.setAttribute(Resources.formatShapeAttribute(control), this.requireValue(shape, control));
    }
  }

  public erase(element: HTMLElement): void {
    const style = element.style;
    style.removeProperty(Resources.colorSchemeProperty);
    for (const token of Resources.colorTokens)
      style.removeProperty(token.variable);
    for (const name of Resources.lookTokens)
      style.removeProperty(Resources.formatLookVariable(name));
    for (const [control] of Resources.shapes)
      element.removeAttribute(Resources.formatShapeAttribute(control));
  }

  private requireValue(value: string | undefined, name: string): string {
    if (Object.isUndefined(value))
      throw new ThemeException(Resources.formatMissingThemeValue(this.defaultTheme.id, name));
    return value;
  }
}
