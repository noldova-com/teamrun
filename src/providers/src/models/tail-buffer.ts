/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";

export class TailBuffer {
  private readonly maximumCount: number;
  private readonly chunks: string[] = [];

  public constructor(maximumCount: number) {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(maximumCount, Resources.maximumCountParameterName);

    this.maximumCount = maximumCount;
  }

  public get isEmpty(): boolean {
    return this.chunks.length === 0;
  }

  public push(chunk: string): void {
    this.chunks.push(chunk);
    if (this.chunks.length > this.maximumCount)
      this.chunks.shift();
  }

  public toString(): string {
    return this.chunks.join(String.empty);
  }
}
