/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

export class TabLabel {
  public readonly title: string;
  public readonly icon: string;

  public constructor(title: string, icon: string) {
    ArgumentException.throwIfNullOrWhitespace(title, "title");
    ArgumentException.throwIfNullOrWhitespace(icon, "icon");

    this.title = title;
    this.icon = icon;
  }
}
