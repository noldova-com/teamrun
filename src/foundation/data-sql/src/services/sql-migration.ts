/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Migration } from "@noldova/teamrun-foundation-data";

import type { MigrationBuilder } from "./schema/migration-builder.js";

export abstract class SqlMigration extends Migration {
  protected constructor(id: string) {
    super(id);
  }

  public abstract up(builder: MigrationBuilder): void;
}
