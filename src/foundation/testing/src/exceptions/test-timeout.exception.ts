/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { nameof } from "@noldova/teamrun-foundation-core";
import { ArgumentOutOfRangeException, type ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";
import { TestingException } from "./testing.exception.js";

export class TestTimeoutException extends TestingException {
  public readonly timeoutMilliseconds: number;

  public constructor(timeoutMilliseconds: number, options?: ExceptionOptions) {
    super(Resources.testTimedOut, options);

    ArgumentOutOfRangeException.throwIfNotPositiveInteger(timeoutMilliseconds, nameof<TestTimeoutException>(t => t.timeoutMilliseconds), Resources.timeoutInvalid);
    this.timeoutMilliseconds = timeoutMilliseconds;
  }
}
