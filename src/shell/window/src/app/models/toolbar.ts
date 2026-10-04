/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MenuSection } from "./menu-section";

export class Toolbar {
  public readonly name: string;
  public readonly title: string;
  public readonly sections: readonly MenuSection[];

  public constructor(name: string, title: string, sections: readonly MenuSection[]) {
    this.name = name;
    this.title = title;
    this.sections = [...sections];
  }
}
