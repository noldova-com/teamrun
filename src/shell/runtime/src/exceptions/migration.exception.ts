/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception, type ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";

export class MigrationException extends Exception {
  public readonly migrationId: string;

  public constructor(migrationId: string, options?: ExceptionOptions) {
    super(Resources.formatMigrationFailed(migrationId), options);

    this.migrationId = migrationId;
  }
}
