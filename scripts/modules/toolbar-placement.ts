/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class ToolbarPlacement {
  public readonly isShown: boolean;
  public readonly after: string | null;
  public readonly before: string | null;
  public readonly startsRow: boolean;

  public constructor(isShown: boolean, after: string | null, before: string | null, startsRow: boolean) {
    this.isShown = isShown;
    this.after = after;
    this.before = before;
    this.startsRow = startsRow;
  }

  public toJson(): Readonly<Record<string, unknown>> {
    return {
      shown: this.isShown,
      ...this.after === null ? {} : { after: this.after },
      ...this.before === null ? {} : { before: this.before },
      ...this.startsRow ? { newRow: true } : {}
    };
  }
}
