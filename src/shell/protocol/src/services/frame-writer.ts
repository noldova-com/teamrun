/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { FailureCode } from "../enums/failure-code.js";
import { ProtocolException } from "../exceptions/protocol.exception.js";
import type { WireMessage } from "../models/wire-message.js";
import { Resources } from "../resources.js";

export class FrameWriter {
  private readonly maximumFrameLength: number;

  public constructor(maximumFrameLength: number = Resources.defaultMaximumFrameLength) {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(maximumFrameLength, Resources.maximumFrameLengthParameterName, Resources.maximumFrameLengthInvalid);

    this.maximumFrameLength = maximumFrameLength;
  }

  public write(message: WireMessage): string {
    const text = message.toText();
    if (text.length > this.maximumFrameLength)
      throw new ProtocolException(FailureCode.FrameTooLarge, Resources.formatFrameTooLarge(this.maximumFrameLength));

    return `${text}${Resources.frameDelimiter}`;
  }
}
