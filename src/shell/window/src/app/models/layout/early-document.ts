/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DocumentTab } from "./document-tab";

export class EarlyDocument {
  public readonly tab: DocumentTab;
  public readonly isPreview: boolean;

  public constructor(tab: DocumentTab, isPreview: boolean) {
    this.tab = tab;
    this.isPreview = isPreview;
  }
}
