/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";

export class BoundedOutput {
  private readonly maximumLength: number;
  private readonly chunks: string[] = [];
  private length: number = 0;

  public constructor(maximumLength: number) {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(maximumLength, Resources.maximumLengthParameterName);

    this.maximumLength = maximumLength;
  }

  public get isFull(): boolean {
    return this.length >= this.maximumLength;
  }

  public append(chunk: string): void {
    if (this.isFull)
      return;

    const accepted = chunk.slice(0, this.maximumLength - this.length);
    this.chunks.push(accepted);
    this.length += accepted.length;
  }

  public toString(): string {
    return this.chunks.join(String.empty);
  }
}
