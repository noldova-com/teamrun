/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ThemeMode } from "../enums/theme-mode";

export class Theme {
  private readonly lightColors: ReadonlyMap<string, string>;
  private readonly darkColors: ReadonlyMap<string, string>;
  private readonly lookValues: ReadonlyMap<string, string>;
  private readonly shapes: ReadonlyMap<string, string>;

  public readonly id: string;
  public readonly name: string;

  public constructor(
    id: string,
    name: string,
    lightColors: ReadonlyMap<string, string>,
    darkColors: ReadonlyMap<string, string>,
    lookValues: ReadonlyMap<string, string>,
    shapes: ReadonlyMap<string, string>) {
    this.id = id;
    this.name = name;
    this.lightColors = lightColors;
    this.darkColors = darkColors;
    this.lookValues = lookValues;
    this.shapes = shapes;
  }

  public readColor(mode: ThemeMode, key: string): string | undefined {
    return (mode === ThemeMode.Dark ? this.darkColors : this.lightColors).get(key);
  }

  public readLook(name: string): string | undefined {
    return this.lookValues.get(name);
  }

  public readShape(control: string): string | undefined {
    return this.shapes.get(control);
  }
}
