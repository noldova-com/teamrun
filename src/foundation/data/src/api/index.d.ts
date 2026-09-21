/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { Exception } from "@noldova/teamrun-foundation-exceptions";

/**
 * A value a store holds in a field or binds to a query: text, a number, or
 * `null`.
 */
export declare type DataValue = string | number | null;

/**
 * What happened to a record, as a change feed records it; the EF Core entity
 * states that describe a change.
 */
export declare enum ChangeOperation {
  /**
   * The record was created; the change carries its complete payload.
   */
  Insert = "Insert",
  /**
   * The record was replaced; the change carries its complete new payload.
   */
  Update = "Update",
  /**
   * The record was removed; the change carries its last payload.
   */
  Delete = "Delete"
}

/**
 * Raised by data packages for misuse of a store or an unexpected answer from
 * it: an operation on a closed connection, a completed transaction used
 * again, a record without the requested field, or a migration list out of
 * order.
 */
export declare class DataException extends Exception {
  /**
   * Initializes the exception with a message and optional options carrying
   * the cause.
   */
  public constructor(message: string, options?: ExceptionOptions);
}

/**
 * The identity of one store: a name and where it lives, such as a file path or
 * a server address. A provider opens a connection on a data source.
 */
export declare class DataSource {
  /**
   * The store's name.
   */
  public readonly name: string;

  /**
   * Where the store lives, in the form its provider understands.
   */
  public readonly location: string;

  /**
   * Initializes the identity. A blank name or location throws
   * `ArgumentException`.
   */
  public constructor(name: string, location: string);
}

/**
 * What a store is asked. Each store kind has its concrete form, such as SQL
 * text with parameters; every form renders itself as text for diagnostics.
 */
export declare abstract class Query {
  /**
   * Renders the query as text for logs and messages.
   */
  public abstract toString(): string;
}

/**
 * One result of a query, read by field name: a row in a relational store, a
 * flat document elsewhere. Reading a field the record does not have, or one
 * whose value has another type, throws `DataException`.
 */
export declare class DataRecord {
  /**
   * Initializes the record with a copy of the given field values.
   */
  public constructor(values: ReadonlyMap<string, DataValue>);

  /**
   * Returns true when the record has the field, whatever its value.
   */
  public hasField(name: string): boolean;

  /**
   * Reads a text field that is not `null`.
   */
  public readString(name: string): string;

  /**
   * Reads a text field, returning `null` for `null`.
   */
  public readNullableString(name: string): string | null;

  /**
   * Reads an integer field that is not `null`.
   */
  public readInteger(name: string): number;

  /**
   * Reads an integer field, returning `null` for `null`.
   */
  public readNullableInteger(name: string): number | null;

  /**
   * Reads a field's value as it is.
   */
  public readValue(name: string): DataValue;
}

/**
 * One entry of a change feed: what happened to which record, with the
 * record's payload at that moment, as text the application interprets.
 */
export declare class Change {
  /**
   * Position in the feed, a positive integer the store assigns.
   */
  public readonly sequence: number;

  /**
   * The kind of record, the container's name.
   */
  public readonly entity: string;

  /**
   * The record's id.
   */
  public readonly entityId: string;

  /**
   * What happened.
   */
  public readonly operation: ChangeOperation;

  /**
   * The record's payload after the operation, or before it for a delete.
   */
  public readonly payload: string;

  /**
   * ISO 8601 timestamp of the change.
   */
  public readonly createdAt: string;

  /**
   * Initializes the change. A sequence that is not a positive integer throws
   * `ArgumentOutOfRangeException`; a blank entity, id, or timestamp throws
   * `ArgumentException`.
   */
  public constructor(sequence: number, entity: string, entityId: string, operation: ChangeOperation, payload: string, createdAt: string);
}

/**
 * A named index over the fields of a container, a table or a collection,
 * unique or not. Declared by migrations; rendered by the store kind.
 */
export declare class Index {
  /**
   * The index's name.
   */
  public readonly name: string;

  /**
   * The table or collection the index belongs to.
   */
  public readonly container: string;

  /**
   * The indexed fields, in order; a copy.
   */
  public readonly fields: readonly string[];

  /**
   * True when the indexed fields identify one record.
   */
  public readonly isUnique: boolean;

  /**
   * Initializes the index. A blank name or container, or no fields, throws
   * `ArgumentException`.
   */
  public constructor(name: string, container: string, fields: readonly string[], isUnique: boolean);
}

/**
 * One step of a store's schema history, identified by fourteen digits of
 * timestamp, an underscore, and a PascalCase name, such as
 * `20260908120000_Initial`. Migrations apply in id order; what a migration
 * does is declared by the store kind that extends this class.
 */
export declare abstract class Migration {
  /**
   * The id that orders the migration and records it as applied.
   */
  public readonly id: string;

  /**
   * Initializes the migration. An id that does not match the pattern throws
   * `ArgumentException`.
   */
  protected constructor(id: string);

  /**
   * Verifies that migrations are listed once each in ascending id order;
   * otherwise throws `DataException`.
   */
  public static validateOrder(migrations: readonly Migration[]): void;
}

/**
 * What a context needs to open its store: the provider and the data source;
 * the EF Core `DbContextOptions`. Built by `DbContextOptionsBuilder`.
 */
export declare class DbContextOptions<TConnection extends Connection, TMigration extends Migration> {
  /**
   * The provider that opens the connection and applies the migrations.
   */
  public readonly provider: DataProvider<TConnection, TMigration>;

  /**
   * The store to open.
   */
  public readonly dataSource: DataSource;

  /**
   * Initializes the options.
   */
  public constructor(provider: DataProvider<TConnection, TMigration>, dataSource: DataSource);
}

/**
 * A unit of work on a connection: committed or rolled back exactly once.
 * Disposing an incomplete transaction rolls it back. Store kinds implement
 * the two core operations.
 */
export declare abstract class Transaction implements Disposable {
  /**
   * True once the store successfully committed or rolled back.
   */
  public get isCompleted(): boolean;

  /**
   * Makes the work permanent. A completed transaction throws
   * `DataException`. If the store's commit fails, the transaction remains
   * incomplete so disposal can attempt rollback.
   */
  public commit(): void;

  /**
   * Discards the work. A completed transaction throws `DataException`.
   * Completion is recorded only after the store's rollback succeeds.
   */
  public rollback(): void;

  /**
   * Rolls back unless already completed.
   */
  public [Symbol.dispose](): void;

  /**
   * Commits in the store.
   */
  protected abstract commitCore(): void;

  /**
   * Rolls back in the store.
   */
  protected abstract rollbackCore(): void;
}

/**
 * The append-only log of every mutation of a store, read in sequence order:
 * the source of an application's events and of replication between machines.
 * Store kinds implement the two core operations; arguments are validated
 * here.
 */
export declare abstract class ChangeFeed {
  /**
   * Records a change and returns it with the sequence the store assigned. A
   * blank entity or id throws `ArgumentException`.
   */
  public append(entity: string, entityId: string, operation: ChangeOperation, payload: string): Change;

  /**
   * Reads changes with a sequence greater than the given one, at most
   * `limit` of them, one hundred by default. A negative sequence or a
   * limit that is not positive throws `ArgumentOutOfRangeException`.
   */
  public readAfter(sequence: number, limit?: number): readonly Change[];

  /**
   * Appends in the store.
   */
  protected abstract appendCore(entity: string, entityId: string, operation: ChangeOperation, payload: string): Change;

  /**
   * Reads from the store.
   */
  protected abstract readAfterCore(sequence: number, limit: number): readonly Change[];
}

/**
 * An open channel to one data source. Store kinds add their operations and
 * use `throwIfClosed` before each one; disposal closes the connection.
 */
export declare abstract class Connection implements Disposable {
  /**
   * The data source the connection was opened on.
   */
  public readonly dataSource: DataSource;

  /**
   * Initializes the connection for a data source.
   */
  protected constructor(dataSource: DataSource);

  /**
   * True until the connection is closed.
   */
  public abstract get isOpen(): boolean;

  /**
   * True while an action started by `transaction` is running.
   */
  public get isInTransaction(): boolean;

  /**
   * Starts a transaction.
   */
  public abstract beginTransaction(): Transaction;

  /**
   * Closes the connection; a second call does nothing.
   */
  public abstract close(): void;

  /**
   * Runs an action inside a transaction: committed when it returns, rolled
   * back when it throws, and the action's exception is rethrown. An action
   * started while another is running joins the outer transaction: nothing is
   * committed until the outermost action returns, and an inner failure rolls
   * the outer transaction back, with `DataException` when the outer action
   * swallowed it. A failed commit also triggers rollback. If the action or
   * commit and the rollback both fail, a `SuppressedError` retains the original
   * failure in `suppressed` and the rollback failure in `error`.
   */
  public transaction<T>(action: () => T): T;

  /**
   * Closes the connection.
   */
  public [Symbol.dispose](): void;

  /**
   * Throws `DataException` when the connection is closed.
   */
  protected throwIfClosed(): void;
}

/**
 * Where a store remembers which migrations have been applied. Store kinds
 * implement it over their own storage.
 */
export declare abstract class MigrationHistory {
  /**
   * Returns the applied ids in ascending order, creating the storage when
   * absent.
   */
  public abstract getApplied(): readonly string[];

  /**
   * Records an id as applied.
   */
  public abstract record(id: string): void;
}

/**
 * Applies the migrations a store has not seen yet, in id order, and records
 * them; the EF Core migrator. Store kinds implement how one migration is
 * applied and recorded, atomically where the store allows.
 */
export declare abstract class Migrator<TMigration extends Migration> {
  /**
   * The history the migrator reads and, through `apply`, writes.
   */
  protected readonly history: MigrationHistory;

  /**
   * Initializes the migrator. Migrations that repeat an id or are not in
   * ascending order throw `DataException`.
   */
  protected constructor(migrations: readonly TMigration[], history: MigrationHistory);

  /**
   * Applies every pending migration and returns the ids applied by this
   * call, in order.
   */
  public migrate(): readonly string[];

  /**
   * Returns the migrations not yet recorded, in id order.
   */
  public getPendingMigrations(): readonly TMigration[];

  /**
   * Returns the applied ids in ascending order.
   */
  public getAppliedMigrations(): readonly string[];

  /**
   * Applies one migration and records it in the history.
   */
  protected abstract apply(migration: TMigration): void;
}

/**
 * One kind of store, such as SQLite: opens connections on its data sources
 * and creates the migrator and the change feed over them; the EF Core
 * database provider. A store kind extends it and a context receives it through its
 * options.
 */
export declare abstract class DataProvider<TConnection extends Connection, TMigration extends Migration> {
  /**
   * Opens a connection on the data source.
   */
  public abstract openConnection(dataSource: DataSource): TConnection;

  /**
   * Creates the migrator that applies the migrations over the connection.
   */
  public abstract createMigrator(connection: TConnection, migrations: readonly TMigration[]): Migrator<TMigration>;

  /**
   * Creates the change feed over the connection.
   */
  public abstract createChangeFeed(connection: TConnection): ChangeFeed;
}

/**
 * Builds the options a context is constructed from; the EF Core
 * `DbContextOptionsBuilder`. Providers add a method per store kind, such as
 * `useSQLite`, beside the general `use`.
 */
export declare class DbContextOptionsBuilder {
  /**
   * Returns options for the provider and data source.
   */
  public use<TConnection extends Connection, TMigration extends Migration>(
    provider: DataProvider<TConnection, TMigration>,
    dataSource: DataSource): DbContextOptions<TConnection, TMigration>;
}

/**
 * A context's `database`: the connection it owns, the migrations it applies
 * to it, and the store's change feed; the EF Core `DatabaseFacade`. Opening
 * the connection and creating the migrator and the feed happen here, when
 * the context is constructed.
 */
export declare class DatabaseFacade<TConnection extends Connection, TMigration extends Migration> {
  /**
   * The connection opened on the options' data source.
   */
  public readonly connection: TConnection;

  /**
   * The change feed of the store, over the connection.
   */
  public readonly changeFeed: ChangeFeed;

  /**
   * Opens the connection through the options' provider and creates the
   * migrator over it for the migrations and the change feed.
   */
  public constructor(options: DbContextOptions<TConnection, TMigration>, migrations: readonly TMigration[]);

  /**
   * Applies every pending migration and returns the ids applied by this
   * call, in order.
   */
  public migrate(): readonly string[];

  /**
   * Returns the applied ids in ascending order.
   */
  public getAppliedMigrations(): readonly string[];

  /**
   * Returns the migrations not yet applied, in id order.
   */
  public getPendingMigrations(): readonly TMigration[];

  /**
   * Starts a transaction on the connection.
   */
  public beginTransaction(): Transaction;

  /**
   * Runs an action inside a transaction on the connection: committed when it
   * returns, rolled back when it throws.
   */
  public transaction<T>(action: () => T): T;
}

/**
 * The one object an application talks to for one store; the EF Core
 * `DbContext`. Constructed from options and its migrations, it opens its
 * connection and exposes it with the migrations as `database`; disposal
 * closes the connection. Applications extend it with their record sets.
 */
export declare abstract class DbContext<TConnection extends Connection, TMigration extends Migration> implements Disposable {
  /**
   * The connection and the migrations of the store.
   */
  public readonly database: DatabaseFacade<TConnection, TMigration>;

  /**
   * Opens the store the options describe with the migrations, in id order;
   * migrations out of order throw `DataException`.
   */
  protected constructor(options: DbContextOptions<TConnection, TMigration>, migrations: readonly TMigration[]);

  /**
   * Closes the connection.
   */
  public [Symbol.dispose](): void;
}
