/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";
import { TestingException } from "./testing.exception.js";

export class AssertFailedException extends TestingException {
  public readonly expected: unknown;
  public readonly actual: unknown;

  public constructor(message?: string, expected?: unknown, actual?: unknown, options?: ExceptionOptions) {
    super(message ?? Resources.assertionFailed, options);

    this.expected = expected;
    this.actual = actual;
  }
}
