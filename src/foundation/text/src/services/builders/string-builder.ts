/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

export class StringBuilder {
  private readonly fragments: string[] = [];
  private lengthValue: number = 0;

  public get length(): number {
    return this.lengthValue;
  }

  public append(value: string): this {
    if (value.length === 0)
      return this;

    this.fragments.push(value);
    this.lengthValue += value.length;

    return this;
  }

  public clear(): void {
    this.fragments.length = 0;
    this.lengthValue = 0;
  }

  public toString(): string {
    return this.fragments.join(String.empty);
  }
}
