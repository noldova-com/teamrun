/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DocsPage } from "./docs-page";

export class DocsSearchEntry {
  public readonly page: DocsPage;
  public readonly terms: readonly string[];

  public constructor(page: DocsPage, terms: readonly string[]) {
    this.page = page;
    this.terms = terms.map(t => t.toLocaleLowerCase("en"));
  }

  public matches(query: string): boolean {
    return this.terms.some(t => t.includes(query));
  }
}
