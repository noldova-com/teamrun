/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";

import { PagesResources } from "../../services/pages/pages-resources.js";

export class PageTextEdit {
  public readonly find: string;
  public readonly replace: string;

  public constructor(find: string, replace: string) {
    if (find.length === 0)
      throw new ArgumentException(PagesResources.findMissing, PagesResources.findParameterName);

    this.find = find;
    this.replace = replace;
  }
}
