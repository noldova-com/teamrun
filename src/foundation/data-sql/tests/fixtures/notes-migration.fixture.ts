/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ColumnType, type MigrationBuilder, SqlMigration } from "@noldova/teamrun-foundation-data-sql";

import type { Note } from "./note.fixture.js";

export class NotesMigration extends SqlMigration {
  public constructor(id: string = "20260908130000_Notes") {
    super(id);
  }

  public override up(builder: MigrationBuilder): void {
    builder.createTable<Note>("notes",
      table => {
        table.column(t => t.id, ColumnType.Text);
        table.column(t => t.text, ColumnType.Text);
      },
      constraints => constraints.primaryKey(t => t.id));
    builder.createIndex<Note>("notes", t => t.text);
  }
}
