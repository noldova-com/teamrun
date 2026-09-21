/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DbContext, type DbContextOptions } from "@noldova/teamrun-foundation-data";

import type { MemoryConnection } from "./memory-connection.fixture.js";
import { NotesMigration } from "./notes-migration.fixture.js";

export class NotesContext extends DbContext<MemoryConnection, NotesMigration> {
  private static readonly all: readonly NotesMigration[] = [new NotesMigration("20260908130000_Notes"), new NotesMigration("20260908130001_Tags")];

  public constructor(options: DbContextOptions<MemoryConnection, NotesMigration>) {
    super(options, NotesContext.all);
  }
}
