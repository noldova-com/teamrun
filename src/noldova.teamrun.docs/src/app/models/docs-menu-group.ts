/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DocsPage } from "./docs-page";

export class DocsMenuGroup {
  public readonly label: string;
  public readonly pages: readonly DocsPage[];

  public constructor(label: string, pages: readonly DocsPage[]) {
    this.label = label;
    this.pages = pages;
  }
}
