/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Query } from "@noldova/teamrun-foundation-data";

export class TextQuery extends Query {
  private readonly text: string;

  public constructor(text: string) {
    super();

    this.text = text;
  }

  public override toString(): string {
    return this.text;
  }
}
