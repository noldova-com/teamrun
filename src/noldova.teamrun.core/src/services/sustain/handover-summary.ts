/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class HandoverSummary {
  public readonly text: string;
  public readonly through: number;
  public readonly author: string | null;
  public readonly isCompaction: boolean;

  public constructor(text: string, through: number, author: string | null = null, isCompaction: boolean = true) {
    this.text = text;
    this.through = through;
    this.author = author;
    this.isCompaction = isCompaction;
  }
}
