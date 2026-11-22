/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FailureCode } from "@noldova/desktop.protocol";
import { RuntimeRequestException } from "@noldova/desktop.window";

export class UnscriptedRequestError extends RuntimeRequestException {
  public override readonly name: string = "UnscriptedRequestError";

  public constructor(method: string) {
    super(FailureCode.UnknownMethod, `No answer scripted for ${method}`);
  }
}
