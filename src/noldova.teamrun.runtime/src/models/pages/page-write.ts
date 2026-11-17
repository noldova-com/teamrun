/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Page } from "@noldova/teamrun.protocol";

export class PageWrite {
  public readonly page: Page;
  public readonly html: string;
  public readonly isCreated: boolean;

  public constructor(page: Page, html: string, isCreated: boolean) {
    this.page = page;
    this.html = html;
    this.isCreated = isCreated;
  }
}
