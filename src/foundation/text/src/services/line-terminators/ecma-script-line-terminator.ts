/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../../resources.js";
import { LineTerminator } from "./line-terminator.js";

export class EcmaScriptLineTerminator extends LineTerminator {
  public override getLength(value: string, index: number): 0 | 1 | 2 {
    if (!Number.isInteger(index) || index < 0 || index > value.length)
      throw new ArgumentOutOfRangeException(Resources.indexParameterName, index, Resources.lineBreakIndexInvalid);

    const character = value.charAt(index);
    if (character === Resources.carriageReturn)
      return value.charAt(index + 1) === Resources.lineFeed ? 2 : 1;

    if (character === Resources.lineFeed || character === Resources.lineSeparator || character === Resources.paragraphSeparator)
      return 1;

    return 0;
  }

  public override isLineTerminator(character: string): boolean {
    return character === Resources.carriageReturn
      || character === Resources.lineFeed
      || character === Resources.lineSeparator
      || character === Resources.paragraphSeparator;
  }
}
