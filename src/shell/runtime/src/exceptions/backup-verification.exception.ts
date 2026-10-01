/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception, type ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";

export class BackupVerificationException extends Exception {
  public constructor(options?: ExceptionOptions) {
    super(Resources.backupUnverified, options);
  }
}
