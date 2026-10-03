/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export abstract class MenuRow {
  public readonly title: string;
  public readonly icon: string | null;

  protected constructor(title: string, icon: string | null) {
    this.title = title;
    this.icon = icon;
  }
}
