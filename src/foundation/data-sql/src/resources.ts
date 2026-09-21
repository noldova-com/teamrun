/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Resources {
  public static readonly beginTransaction: string = "BEGIN";
  public static readonly closeParenthesis: string = ")";
  public static readonly columnParameterName: string = "column";
  public static readonly columnsParameterName: string = "columns";
  public static readonly commitTransaction: string = "COMMIT";
  public static readonly createChangesIndex: string = "CREATE INDEX IF NOT EXISTS IX___changes_entity_entityId ON __changes (entity, entityId)";
  public static readonly createChangesTable: string =
    "CREATE TABLE IF NOT EXISTS __changes (sequence INTEGER PRIMARY KEY AUTOINCREMENT, entity TEXT NOT NULL, entityId TEXT NOT NULL, operation TEXT NOT NULL, payload TEXT NOT NULL, createdAt TEXT NOT NULL)";
  public static readonly createdAtColumn: string = "createdAt";
  public static readonly createIndex: string = "CREATE INDEX";
  public static readonly createMigrationsTable: string = "CREATE TABLE IF NOT EXISTS __migrations (id TEXT PRIMARY KEY, appliedAt TEXT NOT NULL)";
  public static readonly createTable: string = "CREATE TABLE";
  public static readonly createUniqueIndex: string = "CREATE UNIQUE INDEX";
  public static readonly entityColumn: string = "entity";
  public static readonly entityIdColumn: string = "entityId";
  public static readonly foreignKeyConstraint: string = "FOREIGN KEY";
  public static readonly idColumn: string = "id";
  public static readonly indexNamePrefix: string = "IX";
  public static readonly insertChange: string = "INSERT INTO __changes (entity, entityId, operation, payload, createdAt) VALUES (?, ?, ?, ?, ?)";
  public static readonly insertMigration: string = "INSERT INTO __migrations (id, appliedAt) VALUES (?, ?)";
  public static readonly keyWithoutColumns: string = "A primary key names at least one column.";
  public static readonly listSeparator: string = ", ";
  public static readonly nameParameterName: string = "name";
  public static readonly nameSeparator: string = "_";
  public static readonly notNullConstraint: string = "NOT NULL";
  public static readonly onKeyword: string = "ON";
  public static readonly openParenthesis: string = "(";
  public static readonly operationColumn: string = "operation";
  public static readonly payloadColumn: string = "payload";
  public static readonly primaryKeyConstraint: string = "PRIMARY KEY";
  public static readonly principalColumnParameterName: string = "principalColumn";
  public static readonly principalTableParameterName: string = "principalTable";
  public static readonly referencesConstraint: string = "REFERENCES";
  public static readonly rollbackTransaction: string = "ROLLBACK";
  public static readonly selectAppliedMigrations: string = "SELECT id FROM __migrations ORDER BY id";
  public static readonly selectChangesAfter: string =
    "SELECT sequence, entity, entityId, operation, payload, createdAt FROM __changes WHERE sequence > ? ORDER BY sequence LIMIT ?";
  public static readonly sequenceColumn: string = "sequence";
  public static readonly textParameterName: string = "text";
  public static readonly unknownOperation: string = "The change holds an operation the feed does not know.";
  public static readonly wordSeparator: string = " ";

  public static formatTableWithoutColumns(table: string): string {
    return `The table "${table}" defines no columns.`;
  }
}
