/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentOutOfRangeException, IndexOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";

export class ReadOnlyStringSpan {
  private readonly source: string;
  private readonly start: number;

  public static readonly empty: ReadOnlyStringSpan = new ReadOnlyStringSpan(String.empty);

  public readonly length: number;
  public readonly isEmpty: boolean;

  public constructor(source: string, start: number = 0, length?: number) {
    const spanLength = length ?? source.length - start;
    ReadOnlyStringSpan.validateRange(start, spanLength, source.length);

    this.source = source;
    this.start = start;
    this.length = spanLength;
    this.isEmpty = this.length === 0;
  }

  public get(index: number): string {
    if (!Number.isInteger(index) || index < 0 || index >= this.length)
      throw new IndexOutOfRangeException(Resources.indexOutOfRange);

    return this.source.charAt(this.start + index);
  }

  public slice(start: number, length?: number): ReadOnlyStringSpan {
    const spanLength = length ?? this.length - start;
    ReadOnlyStringSpan.validateRange(start, spanLength, this.length);

    return new ReadOnlyStringSpan(this.source, this.start + start, spanLength);
  }

  public toString(): string {
    return this.source.slice(this.start, this.start + this.length);
  }

  private static validateRange(start: number, length: number, sourceLength: number): void {
    if (!Number.isInteger(start) || start < 0 || start > sourceLength)
      throw new ArgumentOutOfRangeException(Resources.startParameterName, start, Resources.startInvalid);

    if (!Number.isInteger(length) || length < 0)
      throw new ArgumentOutOfRangeException(Resources.lengthParameterName, length, Resources.lengthInvalid);

    if (start + length > sourceLength)
      throw new ArgumentOutOfRangeException(Resources.lengthParameterName, length, Resources.spanOutOfRange);
  }
}
