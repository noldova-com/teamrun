/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DbContext, type DbContextOptions } from "@noldova/teamrun-foundation-data";
import type { SqlConnection, SqlMigration } from "@noldova/teamrun-foundation-data-sql";

import { NotesMigration } from "./notes-migration.fixture.js";

export class NotesContext extends DbContext<SqlConnection, SqlMigration> {
  private static readonly all: readonly SqlMigration[] = [new NotesMigration()];

  public constructor(options: DbContextOptions<SqlConnection, SqlMigration>) {
    super(options, NotesContext.all);
  }
}
