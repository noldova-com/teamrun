/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { DefaultTheme, Theme, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";

import { ComputerUseBorder } from "../../../src/app/services/computer-use-border";
import { Resources } from "../../../src/resources";
import { FakeWindowPartContext } from "../../fixtures/fake-window-part-context.fixture";
import { RootPaint } from "../../fixtures/root-paint.fixture";

describe("ComputerUseBorder", () => {
  const accent = (theme: Theme, mode: ThemeMode): JsonValue => ({ color: theme.readColor(mode, "accent") ?? "" });
  const colorsOf = (context: FakeWindowPartContext): readonly JsonValue[] =>
    context.requests.filter(t => t.method === Resources.computerUseBorderColorSetMethod).map(t => t.parameters);
  const answering = (): FakeWindowPartContext => new FakeWindowPartContext().answerModule(Resources.computerUseBorderColorSetMethod, () => null);
  let context: FakeWindowPartContext;

  beforeEach(() => {
    AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light);
    context = answering();
  });

  afterEach(() => {
    ComputerUseBorder.release(context);
    AppearanceFixture.reset();
  });

  it("gives computer use the window's accent when registered, and the accent of each theme in each mode as the kit paints it", async () => {
    ComputerUseBorder.register(context);

    const painted = AppearanceFixture.themes.flatMap(t => AppearanceFixture.modes.map(u => ({ theme: t, mode: u })))
      .filter(t => t.theme !== DefaultTheme.theme || t.mode !== ThemeMode.Light);
    for (const paint of painted)
      await RootPaint.applyAsync(paint.theme, paint.mode);

    expect(colorsOf(context)).toEqual([accent(DefaultTheme.theme, ThemeMode.Light), ...painted.map(t => accent(t.theme, t.mode))]);
    expect(new Set(colorsOf(context).map(t => JSON.stringify(t))).size).toBe(4);
  });

  it("gives a colour once per change, as a paint of the same accent changes nothing, and again when the runtime starts again", async () => {
    const panel = new Theme("teamrun.panel", "Panel", new Map(), new Map([["panel", "#101010"]]), new Map(), new Map());
    ComputerUseBorder.register(context);
    await RootPaint.applyAsync(DefaultTheme.theme, ThemeMode.Dark);
    await RootPaint.applyAsync(panel, ThemeMode.Dark);

    ComputerUseBorder.reload(context);

    const dark = accent(DefaultTheme.theme, ThemeMode.Dark);
    expect(colorsOf(context)).toEqual([accent(DefaultTheme.theme, ThemeMode.Light), dark, dark]);
  });

  it("gives the same accent again when computer use turns active again, and nothing when it turns off or another module changes", async () => {
    ComputerUseBorder.register(context);
    await RootPaint.applyAsync(DefaultTheme.theme, ThemeMode.Dark);

    context.changeDependency(Resources.computerUseModuleId, false);
    context.changeDependency("checkpoints", true);
    context.changeDependency(Resources.computerUseModuleId, true);

    const dark = accent(DefaultTheme.theme, ThemeMode.Dark);
    expect(colorsOf(context)).toEqual([accent(DefaultTheme.theme, ThemeMode.Light), dark, dark]);
  });

  it("gives no accent that isn't written #RRGGBB, so the border keeps the last colour it got", async () => {
    const named = new Theme("teamrun.named", "Named", new Map([["accent", "rebeccapurple"]]), new Map([["accent", "rgb(1, 2, 3)"]]), new Map(), new Map());
    ComputerUseBorder.register(context);

    await RootPaint.applyAsync(named, ThemeMode.Light);
    await RootPaint.applyAsync(named, ThemeMode.Dark);

    expect(colorsOf(context)).toEqual([accent(DefaultTheme.theme, ThemeMode.Light)]);
  });

  it("keeps following the theme when computer use refuses the colour or isn't there, with no failure left unhandled", async () => {
    const refusing = new FakeWindowPartContext().answerModule(Resources.computerUseBorderColorSetMethod, () => {
      throw new Error("Computer use is away.");
    });
    context = refusing;
    ComputerUseBorder.register(refusing);

    await RootPaint.applyAsync(DefaultTheme.theme, ThemeMode.Dark);
    ComputerUseBorder.release(context);
    const absent = new FakeWindowPartContext();
    context = absent;
    ComputerUseBorder.register(absent);
    await RootPaint.applyAsync(DefaultTheme.theme, ThemeMode.Light);

    expect(colorsOf(refusing)).toEqual([accent(DefaultTheme.theme, ThemeMode.Light), accent(DefaultTheme.theme, ThemeMode.Dark)]);
    expect(colorsOf(absent)).toEqual([accent(DefaultTheme.theme, ThemeMode.Dark), accent(DefaultTheme.theme, ThemeMode.Light)]);
  });

  it("stops following the theme and computer use once released, and does nothing for a context it never registered", async () => {
    ComputerUseBorder.register(context);
    await RootPaint.applyAsync(DefaultTheme.theme, ThemeMode.Dark);
    ComputerUseBorder.release(context);
    const other = answering();

    await RootPaint.resetAsync();
    context.changeDependency(Resources.computerUseModuleId, true);
    ComputerUseBorder.reload(context);
    ComputerUseBorder.reload(other);
    ComputerUseBorder.release(other);

    expect(colorsOf(context)).toEqual([accent(DefaultTheme.theme, ThemeMode.Light), accent(DefaultTheme.theme, ThemeMode.Dark)]);
    expect(context.dependencyListeners.size).toBe(0);
    expect(colorsOf(other)).toEqual([]);
  });
});
