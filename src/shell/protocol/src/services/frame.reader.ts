/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { FailureCode } from "../enums/failure-code.js";
import { ProtocolException } from "../exceptions/protocol.exception.js";
import { Resources } from "../resources.js";

export class FrameReader {
  private readonly maximumFrameLength: number;
  private pending: string = String.empty;

  public constructor(maximumFrameLength: number = Resources.defaultMaximumFrameLength) {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(maximumFrameLength, Resources.maximumFrameLengthParameterName, Resources.maximumFrameLengthInvalid);

    this.maximumFrameLength = maximumFrameLength;
  }

  public read(chunk: string): string[] {
    const frames: string[] = [];
    let text = this.pending + chunk;
    let delimiterIndex = text.indexOf(Resources.frameDelimiter);
    while (delimiterIndex >= 0) {
      this.requireWithinLimit(delimiterIndex);
      const frame = text.slice(0, delimiterIndex);
      if (!String.isNullOrWhitespace(frame))
        frames.push(frame);
      text = text.slice(delimiterIndex + 1);
      delimiterIndex = text.indexOf(Resources.frameDelimiter);
    }

    this.requireWithinLimit(text.length);
    this.pending = text;
    return frames;
  }

  private requireWithinLimit(length: number): void {
    if (length > this.maximumFrameLength)
      throw new ProtocolException(FailureCode.FrameTooLarge, Resources.formatFrameTooLarge(this.maximumFrameLength));
  }
}
