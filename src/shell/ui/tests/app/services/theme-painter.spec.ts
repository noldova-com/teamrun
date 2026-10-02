/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ThemeMode } from "../../../src/app/enums/theme-mode";
import { ThemeException } from "../../../src/app/exceptions/theme.exception";
import { Theme } from "../../../src/app/models/theme";
import { ThemePainter } from "../../../src/app/services/theme-painter";
import { DefaultTheme } from "../../../src/app/themes/default-theme";
import { FixtureTheme } from "../../fixtures/fixture-theme";

describe("ThemePainter", () => {
  let element: HTMLElement;

  beforeEach(() => {
    element = document.createElement("div");
  });

  function variable(name: string): string {
    return element.style.getPropertyValue(name);
  }

  it("paints every color, look value and shape of the chosen theme and mode at once, before any frame", () => {
    const painter = new ThemePainter(DefaultTheme.theme);

    painter.paint(element, FixtureTheme.theme, ThemeMode.Dark);

    expect(element.style.getPropertyValue("color-scheme")).toBe("dark");
    expect(variable("--tr-window")).toBe("#2001A0");
    expect(variable("--tr-removed")).toBe("#2037A0");
    expect(variable("--tr-radius-large")).toBe("0.6rem");
    expect(variable("--tr-tooltip-padding")).toBe("0.25rem 0.625rem");
    expect(element.getAttribute("data-tr-tab-shape")).toBe("pill");

    painter.paint(element, FixtureTheme.theme, ThemeMode.Light);

    expect(element.style.getPropertyValue("color-scheme")).toBe("light");
    expect(variable("--tr-window")).toBe("#A00110");
  });

  it("paints the default theme's own colors in light and dark", () => {
    const painter = new ThemePainter(DefaultTheme.theme);

    painter.paint(element, DefaultTheme.theme, ThemeMode.Light);
    expect([variable("--tr-text"), variable("--tr-error"), variable("--tr-removed")]).toEqual(["#3B3B3B", "#A1260D", "#A1260D"]);

    painter.paint(element, DefaultTheme.theme, ThemeMode.Dark);
    expect([variable("--tr-text"), variable("--tr-error"), variable("--tr-removed")]).toEqual(["#CCCCCC", "#F48771", "#F48771"]);
  });

  it("completes a partial theme with its fallback keys, then with the default theme, and ignores a shape the kit does not have", () => {
    const partial = new Theme(
      "fixture.partial",
      "Partial",
      new Map([["editorWidget.background", "#123456"], ["errorForeground", "#ABCDEF"]]),
      new Map(),
      new Map([["radius-small", "0.5rem"]]),
      new Map([["tab", "underline"]]));

    new ThemePainter(DefaultTheme.theme).paint(element, partial, ThemeMode.Light);

    expect(variable("--tr-raised")).toBe("#123456");
    expect(variable("--tr-removed")).toBe("#ABCDEF");
    expect(variable("--tr-text")).toBe("#3B3B3B");
    expect(variable("--tr-radius-small")).toBe("0.5rem");
    expect(variable("--tr-radius-large")).toBe("0.5rem");
    expect(variable("--tr-radius-medium")).toBe("0.375rem");
    expect(element.getAttribute("data-tr-tab-shape")).toBe("pill");
  });

  it("refuses to paint, naming the value, when even the default theme lacks it", () => {
    const empty = new Theme("fixture.empty", "Empty", new Map(), new Map(), new Map(), new Map());
    const withoutLook = FixtureTheme.create(new Map(), new Map([["tab", "pill"]]));
    const withoutShapes = FixtureTheme.create(undefined, new Map());

    expect(() => new ThemePainter(empty).paint(element, empty, ThemeMode.Light))
      .toThrowError(new ThemeException("The theme \"fixture.empty\" has no value for \"sideBar.background\"."));
    expect(() => new ThemePainter(withoutLook).paint(element, withoutLook, ThemeMode.Dark))
      .toThrowError(new ThemeException("The theme \"fixture.contrast\" has no value for \"radius-hover\"."));
    expect(() => new ThemePainter(withoutShapes).paint(element, withoutShapes, ThemeMode.Light))
      .toThrowError(new ThemeException("The theme \"fixture.contrast\" has no value for \"tab\"."));
  });
});
