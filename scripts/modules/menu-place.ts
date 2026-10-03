/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class MenuPlace {
  public readonly name: string;
  public readonly title: string;
  public readonly isMenuBar: boolean;

  public constructor(name: string, title: string, isMenuBar: boolean) {
    this.name = name;
    this.title = title;
    this.isMenuBar = isMenuBar;
  }

  public toJson(): Readonly<Record<string, unknown>> {
    return { name: this.name, title: this.title, menuBar: this.isMenuBar };
  }
}
