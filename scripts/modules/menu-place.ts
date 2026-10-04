/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type ToolbarPlacement from "./toolbar-placement.ts";

export default class MenuPlace {
  public readonly name: string;
  public readonly title: string;
  public readonly isMenuBar: boolean;
  public readonly toolbar: ToolbarPlacement | null;

  public constructor(name: string, title: string, isMenuBar: boolean, toolbar: ToolbarPlacement | null = null) {
    this.name = name;
    this.title = title;
    this.isMenuBar = isMenuBar;
    this.toolbar = toolbar;
  }

  public toJson(): Readonly<Record<string, unknown>> {
    if (this.toolbar !== null)
      return { name: this.name, title: this.title, shows: "toolbar", ...this.toolbar.toJson() };
    return { name: this.name, title: this.title, shows: this.isMenuBar ? "menuBar" : "menu" };
  }
}
