/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class ChatSummary {
  public readonly text: string;
  public readonly author: string | null;
  public readonly isCompaction: boolean;

  public constructor(text: string, author: string | null, isCompaction: boolean) {
    this.text = text;
    this.author = author;
    this.isCompaction = isCompaction;
  }
}
