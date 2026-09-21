/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DataRecord, DataSource, DbContextOptions } from "@noldova/teamrun-foundation-data";
import { ColumnType, SqlConnection, SqlDialect, type SqlMigration, SqlProvider, type SqlQuery } from "@noldova/teamrun-foundation-data-sql";

declare module "@noldova/teamrun-foundation-data" {
  interface DbContextOptionsBuilder {
    /**
     * Returns options that open the SQLite database file at the location
     * through `SQLiteProvider`; the data source is named after the file
     * without its extension. A blank location throws `ArgumentException`.
     */
    useSQLite(location: string): DbContextOptions<SqlConnection, SqlMigration>;
  }
}

/**
 * How SQLite spells column types.
 */
export declare class SQLiteDialect extends SqlDialect {
  /**
   * `TEXT` or `INTEGER`.
   */
  public override formatColumnType(type: ColumnType): string;
}

/**
 * A connection to a SQLite database file through the host's `node:sqlite`,
 * opened with write-ahead logging and foreign keys on. The data source's
 * location is the file path. Rows hold text, numbers, and `NULL`; a row
 * holding another value, such as a blob, throws `DataException` when read.
 */
export declare class SQLiteConnection extends SqlConnection {
  /**
   * Opens the data source's file, creating its directory and the file when
   * absent.
   */
  public static open(dataSource: DataSource): SQLiteConnection;

  /**
   * The SQLite dialect.
   */
  public override get dialect(): SqlDialect;

  /**
   * True until the connection is closed.
   */
  public override get isOpen(): boolean;

  /**
   * Runs a query that returns no rows and returns the number of rows it
   * changed.
   */
  public override execute(query: SqlQuery): number;

  /**
   * Runs an `INSERT` and returns the row id SQLite assigned.
   */
  public override insert(query: SqlQuery): number;

  /**
   * Runs a query and returns its rows as records.
   */
  public override query(query: SqlQuery): readonly DataRecord[];

  /**
   * Closes the file; a second call does nothing.
   */
  public override close(): void;

  private constructor(dataSource: DataSource, handle: unknown);
}

/**
 * The SQLite provider: opens `SQLiteConnection` on a data source's file and
 * inherits the `SqlMigrator`. Reached through
 * `DbContextOptionsBuilder.useSQLite`.
 */
export declare class SQLiteProvider extends SqlProvider {
  /**
   * Opens the data source's file.
   */
  public override openConnection(dataSource: DataSource): SQLiteConnection;
}
