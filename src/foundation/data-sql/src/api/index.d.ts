/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { NameofSelector } from "@noldova/teamrun-foundation-core";
import { type Change, ChangeFeed, type ChangeOperation, Connection, DataProvider, type DataRecord, type DataSource, type DataValue, type Index, Migration, MigrationHistory, Migrator, Query, Transaction } from "@noldova/teamrun-foundation-data";

/**
 * The storage classes a migration may declare for a column; the dialect spells
 * them for its database.
 */
export declare enum ColumnType {
  /**
   * Text; also the class for JSON documents and ISO 8601 timestamps.
   */
  Text = "Text",
  /**
   * An integer.
   */
  Integer = "Integer"
}

/**
 * Names a column after a property of the model the table stores, as a
 * `nameof` selector: `t => t.conversationId`. The property's name is the
 * column's name.
 */
export declare type ColumnSelector<TModel> = (t: NameofSelector<TModel>) => keyof TModel & string;

/**
 * A SQL statement with `?` placeholders and the values bound to them, in
 * order. Renders as its text.
 */
export declare class SqlQuery extends Query {
  /**
   * The statement text.
   */
  public readonly text: string;

  /**
   * The bound values, in placeholder order; a copy.
   */
  public readonly parameters: readonly DataValue[];

  /**
   * Initializes the query. Blank text throws `ArgumentException`.
   */
  public constructor(text: string, parameters?: readonly DataValue[]);

  /**
   * Returns the statement text.
   */
  public override toString(): string;
}

/**
 * One column of a table as a migration declares it: a name, a storage class,
 * and whether `NULL` is allowed. Keys are constraints of the table, not
 * properties of the column.
 */
export declare class Column {
  /**
   * The column's name.
   */
  public readonly name: string;

  /**
   * The storage class.
   */
  public readonly type: ColumnType;

  /**
   * True when `NULL` is allowed; otherwise the column is `NOT NULL`.
   */
  public readonly isNullable: boolean;

  /**
   * Initializes the column. A blank name throws `ArgumentException`.
   */
  public constructor(name: string, type: ColumnType, isNullable: boolean);
}

/**
 * The primary key of a table: one column or several, in order.
 */
export declare class PrimaryKey {
  /**
   * The key columns, in order; a copy.
   */
  public readonly columns: readonly string[];

  /**
   * Initializes the key. No columns throws `ArgumentException`.
   */
  public constructor(columns: readonly string[]);
}

/**
 * A reference from a column of a table to a column of a principal table.
 */
export declare class ForeignKey {
  /**
   * The referencing column.
   */
  public readonly column: string;

  /**
   * The referenced table.
   */
  public readonly principalTable: string;

  /**
   * The referenced column.
   */
  public readonly principalColumn: string;

  /**
   * Initializes the reference. A blank column, table, or principal column
   * throws `ArgumentException`.
   */
  public constructor(column: string, principalTable: string, principalColumn: string);
}

/**
 * One table as a migration declares it: a name, its columns in order, its
 * primary key when it has one, and its foreign keys.
 */
export declare class Table {
  /**
   * The table's name.
   */
  public readonly name: string;

  /**
   * The columns in declaration order; a copy.
   */
  public readonly columns: readonly Column[];

  /**
   * The primary key, or `null` for a table without one.
   */
  public readonly primaryKey: PrimaryKey | null;

  /**
   * The foreign keys in declaration order; a copy.
   */
  public readonly foreignKeys: readonly ForeignKey[];

  /**
   * Initializes the table. A blank name or no columns throws
   * `ArgumentException`.
   */
  public constructor(name: string, columns: readonly Column[], primaryKey: PrimaryKey | null, foreignKeys: readonly ForeignKey[]);
}

/**
 * One step of a migration, rendered to a statement by a dialect; the EF Core
 * migration operation.
 */
export declare abstract class SchemaOperation {
  /**
   * Renders the statement in the dialect.
   */
  public abstract render(dialect: SqlDialect): string;
}

/**
 * Creates a table.
 */
export declare class CreateTableOperation extends SchemaOperation {
  /**
   * The table to create.
   */
  public readonly table: Table;

  /**
   * Initializes the operation.
   */
  public constructor(table: Table);

  /**
   * Renders the `CREATE TABLE` statement.
   */
  public override render(dialect: SqlDialect): string;
}

/**
 * Creates an index.
 */
export declare class CreateIndexOperation extends SchemaOperation {
  /**
   * The index to create.
   */
  public readonly index: Index;

  /**
   * Initializes the operation.
   */
  public constructor(index: Index);

  /**
   * Renders the `CREATE INDEX` or `CREATE UNIQUE INDEX` statement.
   */
  public override render(dialect: SqlDialect): string;
}

/**
 * How one database spells SQL. The shared rendering of tables, constraints,
 * indexes, and columns lives here; providers supply the parts that differ.
 */
export declare abstract class SqlDialect {
  /**
   * Spells a column's storage class, such as `TEXT`.
   */
  public abstract formatColumnType(type: ColumnType): string;

  /**
   * Renders `CREATE TABLE` with every column definition, then the primary
   * key and the foreign keys as table constraints.
   */
  public renderCreateTable(table: Table): string;

  /**
   * Renders `CREATE INDEX` or `CREATE UNIQUE INDEX` over the index's fields.
   */
  public renderCreateIndex(index: Index): string;

  /**
   * Renders one column definition, such as `id TEXT NOT NULL`.
   */
  public renderColumn(column: Column): string;

  /**
   * Renders the constraint `PRIMARY KEY (columns)`.
   */
  public renderPrimaryKey(primaryKey: PrimaryKey): string;

  /**
   * Renders the constraint `FOREIGN KEY (column) REFERENCES table (column)`.
   */
  public renderForeignKey(foreignKey: ForeignKey): string;
}

/**
 * A transaction over a SQL connection: `BEGIN` on creation, `COMMIT` or
 * `ROLLBACK` on completion.
 */
export declare class SqlTransaction extends Transaction {
  /**
   * Begins the transaction on the connection.
   */
  public constructor(connection: SqlConnection);

  /**
   * Executes `COMMIT`.
   */
  protected override commitCore(): void;

  /**
   * Executes `ROLLBACK`.
   */
  protected override rollbackCore(): void;
}

/**
 * A connection to a SQL database: executes queries, inserts, reads records,
 * and begins SQL transactions. Providers implement the operations.
 */
export declare abstract class SqlConnection extends Connection {
  /**
   * The dialect of the database.
   */
  public abstract get dialect(): SqlDialect;

  /**
   * Runs a query that returns no rows and returns the number of rows it
   * changed. Throws `DataException` when the connection is closed.
   */
  public abstract execute(query: SqlQuery): number;

  /**
   * Runs an `INSERT` and returns the row id the database assigned. Throws
   * `DataException` when the connection is closed.
   */
  public abstract insert(query: SqlQuery): number;

  /**
   * Runs a query and returns its rows as records. Throws `DataException`
   * when the connection is closed.
   */
  public abstract query(query: SqlQuery): readonly DataRecord[];

  /**
   * Begins a `SqlTransaction`. Throws `DataException` when the connection
   * is closed.
   */
  public override beginTransaction(): Transaction;
}

/**
 * The change feed in a framework-owned `__changes` table of the connected
 * database, created with its index on first use. The store assigns the
 * sequence; a record whose operation the feed does not know throws
 * `DataException`. Each operation ensures the table and index exist, so
 * initialization rolled back by a transaction is recreated on the next use.
 */
export declare class SqlChangeFeed extends ChangeFeed {
  /**
   * Initializes the feed over the connection.
   */
  public constructor(connection: SqlConnection);

  /**
   * Inserts the change and returns it with the assigned sequence.
   */
  protected override appendCore(entity: string, entityId: string, operation: ChangeOperation, payload: string): Change;

  /**
   * Selects the changes after the sequence in order, up to the limit.
   */
  protected override readAfterCore(sequence: number, limit: number): readonly Change[];
}

/**
 * A migration of a SQL schema: declares its tables and indexes on the
 * builder. There is no `down` until a rollback has a present need.
 */
export declare abstract class SqlMigration extends Migration {
  /**
   * Initializes the migration with its id.
   */
  protected constructor(id: string);

  /**
   * Declares the schema changes.
   */
  public abstract up(builder: MigrationBuilder): void;
}

/**
 * One column being declared inside `ColumnsBuilder.column`, fluently;
 * `toColumn` produces the model, which validates the declaration.
 */
export declare class ColumnBuilder {
  /**
   * The column's name.
   */
  public readonly name: string;

  /**
   * The storage class.
   */
  public readonly type: ColumnType;

  /**
   * Initializes the builder for a `NOT NULL` column.
   */
  public constructor(name: string, type: ColumnType);

  /**
   * Allows `NULL`.
   */
  public nullable(): this;

  /**
   * Produces the column model; a blank name throws `ArgumentException`.
   */
  public toColumn(): Column;
}

/**
 * The columns of one table being declared inside
 * `MigrationBuilder.createTable`, named after the model's properties or by
 * text; the EF Core columns builder.
 */
export declare class ColumnsBuilder<TModel> {
  /**
   * Adds a column with the given name.
   */
  public column(name: string, type: ColumnType): ColumnBuilder;

  /**
   * Adds a column named after the selected property of the model.
   */
  public column(selector: ColumnSelector<TModel>, type: ColumnType): ColumnBuilder;

  /**
   * Produces the column models in declaration order.
   */
  public toColumns(): readonly Column[];
}

/**
 * The constraints of one table being declared inside
 * `MigrationBuilder.createTable`, with columns named after the models'
 * properties; the EF Core constraints builder.
 */
export declare class ConstraintsBuilder<TModel> {
  /**
   * Declares the primary key over the selected properties, in order. No
   * properties throws `ArgumentException`.
   */
  public primaryKey(...columns: readonly ColumnSelector<TModel>[]): this;

  /**
   * Declares a foreign key from the selected property to the selected
   * property of the principal model in the principal table.
   */
  public foreignKey<TPrincipal>(column: ColumnSelector<TModel>, principalTable: string, principalColumn: ColumnSelector<TPrincipal>): this;

  /**
   * Returns the primary key, or `null` when none was declared.
   */
  public toPrimaryKey(): PrimaryKey | null;

  /**
   * Returns the foreign keys in declaration order; a copy.
   */
  public toForeignKeys(): readonly ForeignKey[];
}

/**
 * Collects the operations of one migration in declaration order; the EF Core
 * migration builder. Tables and indexes are declared against the model a
 * table stores, so columns are named by `nameof` selectors.
 */
export declare class MigrationBuilder {
  /**
   * Adds a table whose columns the first callback declares and whose
   * constraints the second, when given, declares. A blank name or no columns
   * throws `ArgumentException`.
   */
  public createTable<TModel>(
    name: string,
    columns: (table: ColumnsBuilder<TModel>) => void,
    constraints?: (table: ConstraintsBuilder<TModel>) => void): void;

  /**
   * Adds an index named `IX_<table>_<columns>` over the selected
   * properties. A blank table or no properties throws `ArgumentException`.
   */
  public createIndex<TModel>(table: string, ...columns: readonly ColumnSelector<TModel>[]): void;

  /**
   * Adds a unique index named `IX_<table>_<columns>` over the selected
   * properties. A blank table or no properties throws `ArgumentException`.
   */
  public createUniqueIndex<TModel>(table: string, ...columns: readonly ColumnSelector<TModel>[]): void;

  /**
   * Returns the operations in declaration order; a copy.
   */
  public toOperations(): readonly SchemaOperation[];
}

/**
 * The migration history in a `__migrations` table of the connected database,
 * created when first read.
 */
export declare class SqlMigrationHistory extends MigrationHistory {
  /**
   * Initializes the history over the connection.
   */
  public constructor(connection: SqlConnection);

  /**
   * Creates the table when absent and returns the recorded ids in ascending
   * order.
   */
  public override getApplied(): readonly string[];

  /**
   * Inserts the id with the current time.
   */
  public override record(id: string): void;
}

/**
 * Applies SQL migrations: each one's operations and its history record run in
 * one transaction, rendered in the connection's dialect.
 */
export declare class SqlMigrator extends Migrator<SqlMigration> {
  /**
   * Initializes the migrator over the connection with its
   * `SqlMigrationHistory`. Migrations out of order throw `DataException`.
   */
  public constructor(connection: SqlConnection, migrations: readonly SqlMigration[]);

  /**
   * Renders and executes the migration's operations and records the id, in
   * one transaction.
   */
  protected override apply(migration: SqlMigration): void;
}

/**
 * A provider of one SQL database: opens its connections and creates the
 * `SqlMigrator` and the `SqlChangeFeed` over them. Database packages extend it with `openConnection`
 * and add their `use` method to `DbContextOptionsBuilder`.
 */
export declare abstract class SqlProvider extends DataProvider<SqlConnection, SqlMigration> {
  /**
   * Creates a `SqlMigrator` over the connection for the migrations.
   */
  public override createMigrator(connection: SqlConnection, migrations: readonly SqlMigration[]): Migrator<SqlMigration>;

  /**
   * Creates a `SqlChangeFeed` over the connection.
   */
  public override createChangeFeed(connection: SqlConnection): ChangeFeed;
}
