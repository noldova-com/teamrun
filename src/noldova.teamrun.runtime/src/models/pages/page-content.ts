/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Page, PageAuthor } from "@noldova/teamrun.protocol";

export class PageContent {
  public readonly page: Page;
  public readonly version: number;
  public readonly editedBy: PageAuthor;
  public readonly html: string;

  public constructor(page: Page, version: number, editedBy: PageAuthor, html: string) {
    this.page = page;
    this.version = version;
    this.editedBy = editedBy;
    this.html = html;
  }
}
