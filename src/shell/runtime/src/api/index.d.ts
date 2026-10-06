/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { EventEmitter } from "node:events";
import type { DatabaseSync, SQLInputValue, SQLOutputValue, StatementResultingChanges } from "node:sqlite";
import type { Readable, Writable } from "node:stream";

import { type ArgumentException, type ArgumentOutOfRangeException, Exception, type ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import type {
  BuildIdentity, CommandInfo, CommandList, Event, Failure, FailureCode, ModuleStatusList, Notification, NotificationList, NotificationPost, PreShellData, QualifiedName, Response,
  RunningWork, RuntimeHandover, SettingChange, SettingDefinition, SettingEntry, SettingKey, SettingScope, SettingValue, SettingsSnapshot, StopPolicy, WorkReport
} from "@noldova/teamrun-shell-protocol";

/**
 * What a data directory holds, judged from its top-level entries other than the
 * shell's own: the ownership database and the discovery, backups, desktop,
 * modules, work and logs folders.
 */
export declare enum DataDirectoryState {
  /**
   * The directory is missing or holds nothing but the shell's own entries.
   */
  Empty = "Empty",

  /**
   * The directory holds the shell's database, so it uses the current layout.
   */
  Current = "Current",

  /**
   * The directory holds other entries but no shell database: data written by a
   * release that predates the shell.
   */
  PreShell = "PreShell"
}

/**
 * The exception thrown when a database backup fails its integrity check, or
 * the copy cannot be opened to check it. The copy is never published.
 */
export declare class BackupVerificationException extends Exception {
  /**
   * Creates the exception.
   *
   * @param options The failure that prevented the check, if any.
   * @example
   * ```ts
   * import { BackupVerificationException } from "@noldova/teamrun-shell-runtime";
   *
   * export function fail(): never {
   *   throw new BackupVerificationException();
   * }
   * ```
   */
  public constructor(options?: ExceptionOptions);
}

/**
 * The exception thrown when another process already owns a data directory.
 */
export declare class DataDirectoryOwnedException extends Exception {
  /**
   * The absolute path of the data directory another process owns.
   */
  public readonly root: string;

  /**
   * Creates the exception.
   *
   * @param root The absolute path of the owned data directory.
   * @param options The SQLite failure that reported the ownership, if any.
   * @example
   * ```ts
   * import { DataDirectoryOwnedException } from "@noldova/teamrun-shell-runtime";
   *
   * export function fail(): never {
   *   throw new DataDirectoryOwnedException("/home/person/.noldova/teamrun");
   * }
   * ```
   */
  public constructor(root: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when discovery metadata is malformed or has an
 * unsupported format version. Its message names the problem and, when read from
 * a file, the file.
 */
export declare class DiscoveryFormatException extends Exception {
  /**
   * Creates the exception.
   *
   * @param message What is wrong with the metadata.
   * @param options The parse failure, if any.
   * @example
   * ```ts
   * import { DiscoveryFormatException } from "@noldova/teamrun-shell-runtime";
   *
   * export function fail(): never {
   *   throw new DiscoveryFormatException("The discovery metadata is not a JSON object.");
   * }
   * ```
   */
  public constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a migration of the shell's or a module's database
 * fails. Its changes and its history row were rolled back together.
 */
export declare class MigrationException extends Exception {
  /**
   * The id of the migration that failed.
   */
  public readonly migrationId: string;

  /**
   * Creates the exception.
   *
   * @param database The database's name in the message, such as `shell database`.
   * @param migrationId The id of the failed migration.
   * @param options The SQLite failure, if any.
   * @example
   * ```ts
   * import { MigrationException } from "@noldova/teamrun-shell-runtime";
   *
   * export function fail(): never {
   *   throw new MigrationException("shell database", "create-settings");
   * }
   * ```
   */
  public constructor(database: string, migrationId: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a module's runtime part uses a database it does not
 * have, because it declares no migrations.
 */
export declare class ModuleDatabaseException extends Exception {
  /**
   * Creates the exception.
   *
   * @param message What went wrong.
   * @example
   * ```ts
   * import { ModuleDatabaseException } from "@noldova/teamrun-shell-runtime";
   *
   * export const failure: ModuleDatabaseException = new ModuleDatabaseException("The module notes has no database.");
   * ```
   */
  public constructor(message: string);
}

/**
 * The exception thrown when an operation needs the data directory's ownership
 * after it was released.
 */
export declare class OwnershipReleasedException extends Exception {
  /**
   * Creates the exception.
   * @example
   * ```ts
   * import { OwnershipReleasedException } from "@noldova/teamrun-shell-runtime";
   *
   * export function fail(): never {
   *   throw new OwnershipReleasedException();
   * }
   * ```
   */
  public constructor();
}

/**
 * The exception thrown when the data directory holds data written by a release
 * that predates the shell. Such data is neither migrated nor reset.
 */
export declare class PreShellDataException extends Exception {
  /**
   * The absolute path of the data directory.
   */
  public readonly root: string;

  /**
   * The directory's top-level entries that belong to the earlier release,
   * sorted.
   */
  public readonly entries: readonly string[];

  /**
   * Creates the exception.
   *
   * @param root The absolute path of the data directory.
   * @param entries The entries that belong to the earlier release; the array
   * is copied.
   * @example
   * ```ts
   * import { PreShellDataException } from "@noldova/teamrun-shell-runtime";
   *
   * export function fail(): never {
   *   throw new PreShellDataException("/home/person/.noldova/teamrun", ["teamrun.db"]);
   * }
   * ```
   */
  public constructor(root: string, entries: readonly string[]);
}

/**
 * The exception thrown when an operating-system command fails, cannot be found
 * or its output cannot be used.
 */
export declare class SystemCommandException extends Exception {
  /**
   * Creates the exception.
   *
   * @param message What failed.
   * @param options The process failure, if any.
   * @example
   * ```ts
   * import { SystemCommandException } from "@noldova/teamrun-shell-runtime";
   *
   * export function fail(): never {
   *   throw new SystemCommandException("icacls.exe failed");
   * }
   * ```
   */
  public constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when the shell database's schema is not one this build
 * recognizes: a migration history that is not a prefix of the known
 * migrations, a longer history from a newer build, or tables without a
 * history. The database is left unchanged.
 */
export declare class UnknownSchemaException extends Exception {
  /**
   * Creates the exception.
   *
   * @param message Why the schema is not recognized.
   * @example
   * ```ts
   * import { UnknownSchemaException } from "@noldova/teamrun-shell-runtime";
   *
   * export function fail(): never {
   *   throw new UnknownSchemaException("The shell database was written by a newer build.");
   * }
   * ```
   */
  public constructor(message: string);
}

/**
 * Restricts a folder so that only the current user can use it.
 */
export interface IFolderProtector {
  /**
   * Restricts the folder.
   *
   * @param folder The absolute path of an existing folder.
   * @returns A promise that resolves once the folder is restricted.
   * @throws {SystemCommandException} The promise rejects when an
   * operating-system command fails.
   * @example
   * ```ts
   * import type { IFolderProtector } from "@noldova/teamrun-shell-runtime";
   *
   * export class RecordingProtector implements IFolderProtector {
   *   public readonly folders: string[] = [];
   *
   *   public async protectAsync(folder: string): Promise<void> {
   *     this.folders.push(folder);
   *   }
   * }
   * ```
   */
  protectAsync(folder: string): Promise<void>;
}

/**
 * The plain JSON form of {@link RuntimeDiscovery}, as published in the
 * discovery file.
 */
export interface IRuntimeDiscoveryJson {
  /**
   * The version of this format; currently `1`.
   */
  readonly formatVersion: number;

  /**
   * The local endpoint clients connect to.
   */
  readonly endpoint: string;

  /**
   * The capability token clients authenticate with.
   */
  readonly token: string;

  /**
   * The owner process's id.
   */
  readonly processId: number;

  /**
   * The program the owner process runs from.
   */
  readonly executablePath: string;

  /**
   * The product version of the runtime's build.
   */
  readonly productVersion: string;

  /**
   * The local protocol's version.
   */
  readonly protocolVersion: number;

  /**
   * The fingerprint of the runtime's build.
   */
  readonly build: string;
}

/**
 * The result of inspecting a data directory.
 */
export declare class DataDirectoryInspection {
  /**
   * What the directory holds.
   */
  public readonly state: DataDirectoryState;

  /**
   * The directory's top-level entries other than the runtime's own, sorted.
   */
  public readonly entries: readonly string[];

  /**
   * Creates the result.
   *
   * @param state What the directory holds.
   * @param entries The top-level entries other than the runtime's own; the
   * array is copied.
   * @example
   * ```ts
   * import { DataDirectoryInspection, DataDirectoryState } from "@noldova/teamrun-shell-runtime";
   *
   * export const inspection: DataDirectoryInspection = new DataDirectoryInspection(DataDirectoryState.Empty, []);
   * ```
   */
  public constructor(state: DataDirectoryState, entries: readonly string[]);
}

/**
 * One ordered, transactional change to the shell database's schema.
 */
export declare class Migration {
  /**
   * The migration's stable id, recorded in the migration history.
   */
  public readonly id: string;

  /**
   * The SQL statements the migration runs, in order, inside its transaction.
   */
  public readonly statements: readonly string[];

  /**
   * Creates a migration.
   *
   * @param id Lowercase letters and digits separated by single hyphens, such as
   * `create-settings`. It must never change once released.
   * @param statements One or more SQL statements without transaction control;
   * the array is copied.
   * @throws {ArgumentException} When the id is malformed or there are no
   * statements.
   * @example
   * ```ts
   * import { Migration } from "@noldova/teamrun-shell-runtime";
   *
   * export const createSettings: Migration = new Migration("create-settings", ["CREATE TABLE settings (name TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT"]);
   * ```
   */
  public constructor(id: string, statements: readonly string[]);
}

/**
 * The discovery metadata a runtime publishes for its clients.
 */
export declare class RuntimeDiscovery {
  /**
   * The local endpoint clients connect to.
   */
  public readonly endpoint: string;

  /**
   * The capability token clients authenticate with.
   */
  public readonly token: string;

  /**
   * The owner process's id.
   */
  public readonly processId: number;

  /**
   * The program the owner process runs from.
   */
  public readonly executablePath: string;

  /**
   * The product version of the runtime's build.
   */
  public readonly productVersion: string;

  /**
   * The local protocol's version.
   */
  public readonly protocolVersion: number;

  /**
   * The fingerprint of the runtime's build.
   */
  public readonly build: string;

  /**
   * Creates the metadata.
   *
   * @param endpoint The local endpoint; not empty or whitespace.
   * @param token The capability token; not empty or whitespace.
   * @param processId The owner process's id; a positive integer.
   * @param executablePath The program the owner runs from; not empty or
   * whitespace.
   * @param productVersion The product version; not empty or whitespace.
   * @param protocolVersion The protocol version; a positive integer.
   * @param build The build fingerprint; not empty or whitespace.
   * @throws {ArgumentException} When a text value is empty or whitespace.
   * @throws {ArgumentOutOfRangeException} When the process id or the protocol
   * version is not a positive integer.
   * @example
   * ```ts
   * import { RuntimeDiscovery } from "@noldova/teamrun-shell-runtime";
   *
   * export const discovery: RuntimeDiscovery = new RuntimeDiscovery("127.0.0.1:52000", "capability-token", 4242, "/opt/teamrun/node", "0.0.1", 1, "build-fingerprint");
   * ```
   */
  public constructor(
    endpoint: string,
    token: string,
    processId: number,
    executablePath: string,
    productVersion: string,
    protocolVersion: number,
    build: string);

  /**
   * Reads metadata from its plain JSON form.
   *
   * @param value The parsed JSON; it must be an object with format version
   * `1`, non-empty text values and positive whole numbers.
   * @returns The metadata.
   * @throws {DiscoveryFormatException} When the value is not an object, has an
   * unsupported format version, or a field is missing or invalid; the message
   * names the field.
   * @example
   * ```ts
   * import { RuntimeDiscovery } from "@noldova/teamrun-shell-runtime";
   *
   * export function parseDiscovery(text: string): RuntimeDiscovery {
   *   return RuntimeDiscovery.fromJson(JSON.parse(text));
   * }
   * ```
   */
  public static fromJson(value: unknown): RuntimeDiscovery;

  /**
   * Returns the plain JSON form, with the format version.
   *
   * @returns A new object holding every field.
   * @example
   * ```ts
   * import type { RuntimeDiscovery } from "@noldova/teamrun-shell-runtime";
   *
   * export function serializeDiscovery(discovery: RuntimeDiscovery): string {
   *   return JSON.stringify(discovery.toJson());
   * }
   * ```
   */
  public toJson(): IRuntimeDiscoveryJson;
}

/**
 * Runs an operating-system program directly, without a shell.
 */
export declare class SystemCommand {
  /**
   * Runs the program and waits for it to exit. It is stopped after 30 seconds,
   * and its output is limited to 1 MiB.
   *
   * @param file The program's path.
   * @param commandArguments The arguments, passed without shell
   * interpretation.
   * @param environment The program's environment; the runtime's own by
   * default.
   * @returns A promise of the program's standard output.
   * @throws {SystemCommandException} The promise rejects when the program
   * cannot start, exits with a nonzero code, times out or writes too much.
   * @example
   * ```ts
   * import { SystemCommand } from "@noldova/teamrun-shell-runtime";
   *
   * export function readUserAsync(): Promise<string> {
   *   return new SystemCommand().runAsync("C:\\Windows\\System32\\whoami.exe", ["/user", "/fo", "csv", "/nh"], { SystemRoot: "C:\\Windows" });
   * }
   * ```
   */
  public runAsync(file: string, commandArguments: readonly string[], environment?: NodeJS.ProcessEnv): Promise<string>;
}

/**
 * The layout of a data directory: where the ownership database, the shell
 * database, the discovery file, backups and module folders live.
 */
export declare class DataDirectory {
  /**
   * The directory's absolute, normalized path.
   */
  public readonly root: string;

  /**
   * Creates the layout for a directory.
   *
   * @param root The directory's absolute path; it need not exist yet.
   * @throws {ArgumentException} When the path is not absolute.
   * @example
   * ```ts
   * import { DataDirectory } from "@noldova/teamrun-shell-runtime";
   *
   * export const directory: DataDirectory = new DataDirectory("/home/person/.noldova/teamrun");
   * ```
   */
  public constructor(root: string);

  /**
   * The path of the ownership database, `ownership.sqlite`.
   */
  public get ownershipDatabase(): string;

  /**
   * The path of the shell's database, `shell.sqlite`, which marks the current
   * layout.
   */
  public get shellDatabase(): string;

  /**
   * The path of the protected discovery folder, `discovery`.
   */
  public get discoveryFolder(): string;

  /**
   * The path of the discovery file, `discovery/runtime.json`.
   */
  public get discoveryFile(): string;

  /**
   * The path of the desktop's Electron profile folder, `desktop`.
   */
  public get profileFolder(): string;

  /**
   * The path of the running runtime's log, `logs/runtime.log`.
   */
  public get runtimeLog(): string;

  /**
   * The path of the previous run's log, `logs/runtime.previous.log`.
   */
  public get previousRuntimeLog(): string;

  /**
   * The path of the desktop's log, `logs/desktop.log`, which the desktop owns.
   */
  public get desktopLog(): string;

  /**
   * The path of the previous desktop start's log, `logs/desktop.previous.log`.
   */
  public get previousDesktopLog(): string;

  /**
   * The path of the database backups folder, `backups`.
   */
  public get backupsFolder(): string;

  /**
   * The path of the folder that holds every module's folder, `modules`.
   */
  public get modulesFolder(): string;

  /**
   * The path of the folder for work outside any project, `work`.
   */
  public get workFolder(): string;

  /**
   * The path of the logs folder, `logs`.
   */
  public get logsFolder(): string;

  /**
   * Returns the path of a module's folder, `modules/<id>`.
   *
   * @param id The module's id: lowercase kebab-case and not `shell`.
   * @returns The folder's path; the folder is not created.
   * @throws {ArgumentException} When the id is not a module id.
   * @example
   * ```ts
   * import type { DataDirectory } from "@noldova/teamrun-shell-runtime";
   *
   * export function locateCheckpoints(directory: DataDirectory): string {
   *   return directory.locateModuleFolder("checkpoints");
   * }
   * ```
   */
  public locateModuleFolder(id: string): string;

  /**
   * Returns the path of a module's folder for work outside any project,
   * `work/<id>`.
   *
   * @param id The module's id: lowercase kebab-case and not `shell`.
   * @returns The folder's path; the folder is not created.
   * @throws {ArgumentException} When the id is not a module id.
   * @example
   * ```ts
   * import type { DataDirectory } from "@noldova/teamrun-shell-runtime";
   *
   * export function locateChatWork(directory: DataDirectory): string {
   *   return directory.locateWorkFolder("chat");
   * }
   * ```
   */
  public locateWorkFolder(id: string): string;

  /**
   * Returns the path of a module's database, `modules/<id>/<id>.sqlite`.
   *
   * @param id The module's id: lowercase kebab-case and not `shell`.
   * @returns The database's path; nothing is created.
   * @throws {ArgumentException} When the id is not a module id.
   * @example
   * ```ts
   * import type { DataDirectory } from "@noldova/teamrun-shell-runtime";
   *
   * export function locateNotesDatabase(directory: DataDirectory): string {
   *   return directory.locateModuleDatabase("notes");
   * }
   * ```
   */
  public locateModuleDatabase(id: string): string;
}

/**
 * Inspects a data directory and moves data written before the shell aside.
 */
export declare class DataDirectoryInspector {
  /**
   * Inspects the directory's top-level entries, ignoring the shell's own
   * entries.
   *
   * @param dataDirectory The directory to inspect; it need not exist.
   * @returns A promise of the directory's state and entries.
   * @example
   * ```ts
   * import { DataDirectoryInspector, DataDirectoryState, type DataDirectory } from "@noldova/teamrun-shell-runtime";
   *
   * export async function holdsPreShellDataAsync(directory: DataDirectory): Promise<boolean> {
   *   return (await DataDirectoryInspector.inspectAsync(directory)).state === DataDirectoryState.PreShell;
   * }
   * ```
   */
  public static inspectAsync(dataDirectory: DataDirectory): Promise<DataDirectoryInspection>;

  /**
   * Moves every entry of a directory that holds data written before the
   * shell, except the runtime's own entries, into a new sibling folder named
   * `<directory>-before-shell-<UTC time>`. Nothing is deleted or overwritten.
   *
   * @param lock The held ownership of the directory.
   * @param moment The time that names the new folder; now by default.
   * @returns A promise of the new folder's path, or of `null` when the
   * directory holds no such data.
   * @throws {OwnershipReleasedException} When the ownership was released.
   * @throws {Error} The promise rejects when the folder already exists or an
   * entry cannot be moved; entries moved before the failure stay moved.
   * @example
   * ```ts
   * import { DataDirectoryInspector, type OwnershipLock } from "@noldova/teamrun-shell-runtime";
   *
   * export function moveAsideAsync(lock: OwnershipLock): Promise<string | null> {
   *   return DataDirectoryInspector.moveAsideAsync(lock, new Date("2026-10-01T12:00:00Z"));
   * }
   * ```
   */
  public static moveAsideAsync(lock: OwnershipLock, moment?: Date): Promise<string | null>;
}

/**
 * Makes and verifies SQLite backups that include committed write-ahead-log
 * data.
 */
export declare class DatabaseBackup {
  /**
   * Copies a database with SQLite's online backup, verifies the copy and
   * publishes it under the given name without overwriting anything. The copy
   * is readable and writable only by its owner.
   *
   * @param source An open database connection.
   * @param folder The folder for the backup; it is created when missing.
   * @param name The backup's file name.
   * @returns A promise of the published backup's path.
   * @throws {BackupVerificationException} The promise rejects when the copy
   * fails its integrity check.
   * @throws {Error} The promise rejects when a backup with that name already
   * exists or the copy fails.
   * @example
   * ```ts
   * import { DatabaseBackup } from "@noldova/teamrun-shell-runtime";
   *
   * export function backUpAsync(connection: Parameters<typeof DatabaseBackup.createAsync>[0], folder: string): Promise<string> {
   *   return DatabaseBackup.createAsync(connection, folder, "shell-before-migration-2-20261001T120000Z.sqlite");
   * }
   * ```
   */
  public static createAsync(source: DatabaseSync, folder: string, name: string): Promise<string>;

  /**
   * Checks a database file with SQLite's integrity check.
   *
   * @param file The database file's path.
   * @throws {BackupVerificationException} When the file cannot be opened as a
   * database or its integrity check reports a problem.
   * @example
   * ```ts
   * import { BackupVerificationException, DatabaseBackup } from "@noldova/teamrun-shell-runtime";
   *
   * export function isSound(file: string): boolean {
   *   try {
   *     DatabaseBackup.verify(file);
   *     return true;
   *   }
   *   catch (error) {
   *     if (error instanceof BackupVerificationException)
   *       return false;
   *     throw error;
   *   }
   * }
   * ```
   */
  public static verify(file: string): void;
}

/**
 * A SQLite database opened in write-ahead-log mode with its owner's migrations applied: the shell's, or a module's.
 * Its migration history lives in the database itself.
 */
export declare class MigratedDatabase implements Disposable {
  /**
   * The ids of the migrations the database holds after opening, in order.
   */
  public readonly appliedMigrations: readonly string[];

  /**
   * Wraps an open connection; the subclasses' `openAsync` methods create it.
   *
   * @param connection The open connection.
   * @param appliedMigrations The ids of the applied migrations, in order.
   * @example
   * ```ts
   * import { MigratedDatabase, Migration } from "@noldova/teamrun-shell-runtime";
   *
   * export class ReportsDatabase extends MigratedDatabase {
   *   public static async openAsync(file: string, backups: string): Promise<ReportsDatabase> {
   *     const migrations = [new Migration("create-reports", ["CREATE TABLE reports (id TEXT PRIMARY KEY) STRICT"])];
   *     const [connection, applied] = await MigratedDatabase.migrateAsync(file, "reports database", migrations, backups, "reports", new Date());
   *     return new ReportsDatabase(connection, applied);
   *   }
   * }
   * ```
   */
  protected constructor(connection: DatabaseSync, appliedMigrations: readonly string[]);

  /**
   * Runs a query and returns its first row.
   *
   * @param statement The SQL statement, with `?` placeholders.
   * @param values The placeholders' values, in order.
   * @returns The first row, or `undefined` when there is none.
   * @throws Error synchronously when the statement fails or the database is closed.
   * @example
   * ```ts
   * import type { ShellDatabase } from "@noldova/teamrun-shell-runtime";
   *
   * export function readBounds(database: ShellDatabase): unknown {
   *   return database.read("SELECT bounds AS value FROM window_states WHERE device = ? AND window = ?", "device-1", "main")?.["value"];
   * }
   * ```
   */
  public read(statement: string, ...values: SQLInputValue[]): Record<string, SQLOutputValue> | undefined;

  /**
   * Runs a query and returns all its rows.
   *
   * @param statement The SQL statement, with `?` placeholders.
   * @param values The placeholders' values, in order.
   * @returns The rows, in the query's order.
   * @throws Error synchronously when the statement fails or the database is closed.
   * @example
   * ```ts
   * import type { ShellDatabase } from "@noldova/teamrun-shell-runtime";
   *
   * export function countDevices(database: ShellDatabase): number {
   *   return database.readAll("SELECT DISTINCT device FROM window_states").length;
   * }
   * ```
   */
  public readAll(statement: string, ...values: SQLInputValue[]): Record<string, SQLOutputValue>[];

  /**
   * Runs a statement that changes the database.
   *
   * @param statement The SQL statement, with `?` placeholders.
   * @param values The placeholders' values, in order.
   * @returns How many rows changed and the last inserted row id.
   * @throws Error synchronously when the statement fails or the database is closed.
   * @example
   * ```ts
   * import type { ShellDatabase } from "@noldova/teamrun-shell-runtime";
   *
   * export function forget(database: ShellDatabase): number {
   *   return Number(database.run("DELETE FROM window_states WHERE device = ?", "device-1").changes);
   * }
   * ```
   */
  public run(statement: string, ...values: SQLInputValue[]): StatementResultingChanges;

  /**
   * Runs an action in one transaction: it commits when the action returns and rolls back when it throws. The action
   * must finish synchronously; an action that returns a promise does not compile, and one that returns a thenable at
   * run time is rolled back and refused, because an awaited step would run after the commit.
   *
   * @param action The work; it may read and change the database.
   * @returns What the action returned.
   * @throws {ArgumentException} When the action returned a thenable; nothing was committed.
   * @throws Error synchronously as the action threw it, after rolling back.
   * @example
   * ```ts
   * import type { ShellDatabase } from "@noldova/teamrun-shell-runtime";
   *
   * export function moveDevice(database: ShellDatabase, from: string, to: string): number {
   *   return database.transaction(() => Number(database.run("UPDATE window_states SET device = ? WHERE device = ?", to, from).changes));
   * }
   * ```
   * @example
   * ```ts
   * import type { ShellDatabase } from "@noldova/teamrun-shell-runtime";
   *
   * export function refuseAsync(database: ShellDatabase): void {
   *   // @ts-expect-error
   *   database.transaction(async () => 1);
   * }
   * ```
   */
  public transaction<T>(action: () => T & ([T] extends [PromiseLike<unknown>] ? never : unknown)): T;

  /**
   * Closes the database; closing again does nothing.
   *
   * @example
   * ```ts
   * import type { ShellDatabase } from "@noldova/teamrun-shell-runtime";
   *
   * export function closeDatabase(database: ShellDatabase): void {
   *   database.close();
   * }
   * ```
   */
  public close(): void;

  /**
   * Closes the database.
   */
  public [Symbol.dispose](): void;

  /**
   * Opens a database file and applies its pending migrations, each with its history row in one transaction. The
   * history must be a prefix of the given migrations. Before changing a database that already has migrations, it
   * publishes a verified backup named `<backupOwner>-before-migration-<position>-<time>.sqlite`.
   *
   * @param file The database file.
   * @param name The database's name in messages, such as `shell database`.
   * @param migrations Every migration its owner knows, in order.
   * @param backupsFolder The folder for backups.
   * @param backupOwner The backup names' prefix: `shell` or the module's id.
   * @param moment The time that names a backup.
   * @returns A promise of the open connection and the applied migrations' ids.
   * @throws {UnknownSchemaException} The promise rejects when the schema is not one the migrations recognize.
   * @throws {BackupVerificationException} The promise rejects when the backup fails verification; no migration has run.
   * @throws {MigrationException} The promise rejects when a migration fails; earlier migrations stay applied.
   * @example
   * ```ts
   * import { MigratedDatabase, Migration } from "@noldova/teamrun-shell-runtime";
   *
   * export class ReportsDatabase extends MigratedDatabase {
   *   public static async openAsync(file: string, backups: string): Promise<ReportsDatabase> {
   *     const migrations = [new Migration("create-reports", ["CREATE TABLE reports (id TEXT PRIMARY KEY) STRICT"])];
   *     const [connection, applied] = await MigratedDatabase.migrateAsync(file, "reports database", migrations, backups, "reports", new Date());
   *     return new ReportsDatabase(connection, applied);
   *   }
   * }
   * ```
   */
  protected static migrateAsync(
    file: string,
    name: string,
    migrations: readonly Migration[],
    backupsFolder: string,
    backupOwner: string,
    moment: Date): Promise<[DatabaseSync, readonly string[]]>;
}

/**
 * The shell database's migrations, in the order they apply: its window
 * states, then its settings.
 */
export declare class ShellMigrations {
  /**
   * Every migration of the shell's database.
   *
   * @example
   * ```ts
   * import { type OwnershipLock, ShellDatabase, ShellMigrations } from "@noldova/teamrun-shell-runtime";
   *
   * export function openAsync(lock: OwnershipLock): Promise<ShellDatabase> {
   *   return ShellDatabase.openAsync(lock, ShellMigrations.all);
   * }
   * ```
   */
  public static readonly all: readonly Migration[];
}

/**
 * The shell's own database, `shell.sqlite`, which serves the shell's facilities.
 */
export declare class ShellDatabase extends MigratedDatabase {
  /**
   * Opens the shell database of an owned data directory and applies the
   * pending migrations, each with its history row in one transaction. Before
   * changing a database that already has migrations, it publishes a verified
   * backup in the backups folder.
   *
   * @param lock The held ownership of the data directory.
   * @param migrations Every migration this build knows, in order.
   * @param moment The time that names a backup; now by default.
   * @returns A promise of the open database.
   * @throws {OwnershipReleasedException} When the ownership was released.
   * @throws {PreShellDataException} The promise rejects when the directory
   * holds data written before the shell.
   * @throws {UnknownSchemaException} The promise rejects when the schema is
   * not one this build recognizes.
   * @throws {BackupVerificationException} The promise rejects when the backup
   * fails verification; no migration has run.
   * @throws {MigrationException} The promise rejects when a migration fails;
   * earlier migrations stay applied.
   * @example
   * ```ts
   * import { Migration, ShellDatabase, type OwnershipLock } from "@noldova/teamrun-shell-runtime";
   *
   * export async function listMigrationsAsync(lock: OwnershipLock): Promise<readonly string[]> {
   *   using database = await ShellDatabase.openAsync(lock, [new Migration("create-settings", ["CREATE TABLE settings (name TEXT PRIMARY KEY) STRICT"])]);
   *   return database.appliedMigrations;
   * }
   * ```
   */
  public static openAsync(lock: OwnershipLock, migrations: readonly Migration[], moment?: Date): Promise<ShellDatabase>;
}

/**
 * A module's own database, `modules/<id>/<id>.sqlite` in the data directory. The runtime opens and migrates it before
 * the module's runtime part activates and closes it when the part deactivates; the part reaches it only through its
 * context, as an {@link IModuleDatabase}.
 */
export declare class ModuleDatabase extends MigratedDatabase implements IModuleDatabase {
  /**
   * Opens a module's database, creating its folder and file when missing, and applies its pending migrations as
   * {@link ShellDatabase.openAsync} does; a backup is named after the module.
   *
   * @param directory The owned data directory.
   * @param moduleId The module's id.
   * @param migrations Every migration the module's runtime part declares, in order.
   * @param moment The time that names a backup; now by default.
   * @returns A promise of the open database.
   * @throws {ArgumentException} When the id is not a module id.
   * @throws {UnknownSchemaException} The promise rejects when the schema is not one the migrations recognize.
   * @throws {BackupVerificationException} The promise rejects when the backup fails verification; no migration has run.
   * @throws {MigrationException} The promise rejects when a migration fails; earlier migrations stay applied.
   * @example
   * ```ts
   * import { Migration, ModuleDatabase, type DataDirectory } from "@noldova/teamrun-shell-runtime";
   *
   * export async function openNotesAsync(directory: DataDirectory): Promise<ModuleDatabase> {
   *   return ModuleDatabase.openAsync(directory, "notes", [new Migration("create-notes", ["CREATE TABLE notes (id TEXT PRIMARY KEY) STRICT"])]);
   * }
   * ```
   */
  public static openAsync(directory: DataDirectory, moduleId: string, migrations: readonly Migration[], moment?: Date): Promise<ModuleDatabase>;
}

/**
 * Removes what a diagnostic must not show: the home folder becomes `~`, and opaque values such as tokens become
 * `[redacted]`.
 */
export declare class DiagnosticRedactor {
  /**
   * Creates the redactor.
   *
   * @param homeFolder The home folder to show as `~`, matched with either path separator and in any case.
   * @example
   * ```ts
   * import { homedir } from "node:os";
   *
   * import { DiagnosticRedactor } from "@noldova/teamrun-shell-runtime";
   *
   * export const redactor: DiagnosticRedactor = new DiagnosticRedactor(homedir());
   * ```
   */
  public constructor(homeFolder: string);

  /**
   * Redacts a diagnostic.
   *
   * @param text The diagnostic.
   * @returns The diagnostic with the home folder shown as `~` and opaque values replaced.
   * @example
   * ```ts
   * import { DiagnosticRedactor } from "@noldova/teamrun-shell-runtime";
   *
   * export function redact(text: string): string {
   *   return new DiagnosticRedactor("/home/person").redact(text);
   * }
   * ```
   */
  public redact(text: string): string;
}

/**
 * A log file whose size is bounded. Each record is stamped with its time and redacted, and the file becomes the
 * previous file, replacing it, when a record would take it over its size limit.
 */
export declare class LogFile {
  /**
   * Creates the log file, which is not opened yet.
   *
   * @param file The file to write.
   * @param previousFile The file the log becomes when it is opened again or reaches its size limit.
   * @param redactor Redacts every record.
   * @param now Returns the time to stamp a record with; the current time by default.
   * @param limit The most bytes the file holds, 1 MiB by default. A record is cut to a quarter of it.
   * @example
   * ```ts
   * import { homedir } from "node:os";
   *
   * import { DiagnosticRedactor, LogFile } from "@noldova/teamrun-shell-runtime";
   *
   * export const log: LogFile = new LogFile("/data/logs/app.log", "/data/logs/app.previous.log", new DiagnosticRedactor(homedir()));
   * ```
   */
  public constructor(file: string, previousFile: string, redactor: DiagnosticRedactor, now?: () => Date, limit?: number);

  /**
   * Stamps and redacts a record.
   *
   * @param text The record, possibly of several lines, without its line ending.
   * @returns The line to write: the time, the redacted record, cut to a quarter of the size limit in bytes at a character boundary, and a line ending.
   * @example
   * ```ts
   * import type { LogFile } from "@noldova/teamrun-shell-runtime";
   *
   * export function line(log: LogFile): string {
   *   return log.format("The runtime started.");
   * }
   * ```
   */
  public format(text: string): string;

  /**
   * Starts an empty file. The existing file, if there is one, becomes the previous file, replacing it. When it cannot, the failure is thrown and the existing file keeps what it holds.
   *
   * @throws {Error} Thrown when the existing file cannot become the previous file or the file cannot be written.
   * @example
   * ```ts
   * import type { LogFile } from "@noldova/teamrun-shell-runtime";
   *
   * export function start(log: LogFile): void {
   *   log.open();
   * }
   * ```
   */
  public open(): void;

  /**
   * Appends a line. When it would take the file over its size limit, the file first becomes the previous file.
   *
   * @param line The line from {@link LogFile.format}.
   * @throws {Error} Thrown when the file cannot become the previous file, in which case it keeps what it holds, or cannot be written.
   * @example
   * ```ts
   * import type { LogFile } from "@noldova/teamrun-shell-runtime";
   *
   * export function note(log: LogFile): void {
   *   log.append(log.format("The runtime started."));
   * }
   * ```
   */
  public append(line: string): void;
}

/**
 * Prepares text that comes from outside the shell's own code for a log, so it cannot pass for a record of its own.
 */
export declare class LogText {
  /**
   * Splits a text into the lines a log shows.
   *
   * @param text The text, with any line endings.
   * @returns The lines, without the text's trailing white space. Every line ending ends a line: CR LF, LF, CR, vertical tab, form feed, U+0085, U+2028 and U+2029.
   * Each line keeps its tabs and loses every other control character, so terminal escapes do nothing.
   * @example
   * ```ts
   * import { LogText } from "@noldova/teamrun-shell-runtime";
   *
   * export const lines: readonly string[] = LogText.lines("Synced\rwith the server\n");
   * ```
   */
  public static lines(text: string): readonly string[];
}

/**
 * Publishes and withdraws a runtime's discovery metadata.
 */
export declare class DiscoveryPublisher {
  /**
   * Creates the publisher.
   *
   * @param lock The held ownership of the data directory.
   * @param protector Restricts the discovery folder when it is created.
   * @param replaceFileAsync Renames a file over another; `fs.promises.rename` by default.
   * @example
   * ```ts
   * import { DiscoveryPublisher, PosixFolderProtector, type OwnershipLock } from "@noldova/teamrun-shell-runtime";
   *
   * export function createPublisher(lock: OwnershipLock): DiscoveryPublisher {
   *   return new DiscoveryPublisher(lock, new PosixFolderProtector());
   * }
   * ```
   */
  public constructor(lock: OwnershipLock, protector: IFolderProtector, replaceFileAsync?: (from: string, to: string) => Promise<void>);

  /**
   * Writes the metadata to a new owner-only file in the discovery folder and
   * renames it over the discovery file, so readers see the old or the new
   * metadata, never a partial file. The folder is created and protected when
   * missing. While another process holds the old file open, which on Windows
   * makes the rename fail with `EPERM`, `EACCES` or `EBUSY`, the rename is
   * retried for about two seconds; a rename that still fails removes the new
   * file.
   *
   * @param discovery The metadata to publish.
   * @returns A promise of the discovery file's path.
   * @throws {OwnershipReleasedException} When the ownership was released.
   * @throws {Error} The promise rejects with the rename's error when it fails
   * for another reason or the old file stays held.
   * @throws {SystemCommandException} The promise rejects when the folder
   * cannot be protected.
   * @example
   * ```ts
   * import type { DiscoveryPublisher, RuntimeDiscovery } from "@noldova/teamrun-shell-runtime";
   *
   * export function publishAsync(publisher: DiscoveryPublisher, discovery: RuntimeDiscovery): Promise<string> {
   *   return publisher.publishAsync(discovery);
   * }
   * ```
   */
  public publishAsync(discovery: RuntimeDiscovery): Promise<string>;

  /**
   * Removes the discovery file when it holds exactly this metadata.
   *
   * @param discovery The metadata this runtime published.
   * @returns A promise of whether the file was removed.
   * @throws {OwnershipReleasedException} When the ownership was released.
   * @example
   * ```ts
   * import type { DiscoveryPublisher, RuntimeDiscovery } from "@noldova/teamrun-shell-runtime";
   *
   * export function withdrawAsync(publisher: DiscoveryPublisher, discovery: RuntimeDiscovery): Promise<boolean> {
   *   return publisher.withdrawAsync(discovery);
   * }
   * ```
   */
  public withdrawAsync(discovery: RuntimeDiscovery): Promise<boolean>;

  /**
   * Removes the discovery file that an earlier owner left behind, so clients do not reach this runtime with that owner's token.
   *
   * @returns A promise that settles once no discovery file remains.
   * @throws {OwnershipReleasedException} When the ownership was released.
   * @example
   * ```ts
   * import type { DiscoveryPublisher } from "@noldova/teamrun-shell-runtime";
   *
   * export async function takeOverAsync(publisher: DiscoveryPublisher): Promise<void> {
   *   await publisher.withdrawEarlierAsync();
   * }
   * ```
   */
  public withdrawEarlierAsync(): Promise<void>;
}

/**
 * Reads the discovery metadata a runtime published.
 */
export declare class DiscoveryReader {
  /**
   * Reads the discovery file of a data directory. Reading needs no ownership;
   * a file whose owner has died stays until a runtime replaces it, so use
   * {@link OwnershipLock.isOwned} to tell a live runtime from a stale file.
   *
   * @param dataDirectory The data directory.
   * @returns A promise of the metadata, or of `null` when there is no
   * discovery file, including one its owner withdraws while it is being read.
   * @throws {DiscoveryFormatException} The promise rejects when the file is not
   * valid JSON or not valid metadata; the message names the file.
   * @example
   * ```ts
   * import { DiscoveryReader, OwnershipLock, type DataDirectory } from "@noldova/teamrun-shell-runtime";
   *
   * export async function findLiveEndpointAsync(directory: DataDirectory): Promise<string | null> {
   *   const discovery = await DiscoveryReader.readAsync(directory);
   *   return discovery === null || !OwnershipLock.isOwned(directory) ? null : discovery.endpoint;
   * }
   * ```
   */
  public static readAsync(dataDirectory: DataDirectory): Promise<RuntimeDiscovery | null>;
}

/**
 * Chooses the folder protection for an operating system.
 */
export declare class FolderProtectorFactory {
  /**
   * Returns the folder protector for a platform.
   *
   * @param platform A Node.js platform name, such as `process.platform`.
   * @param command Runs Windows' system tools.
   * @param environment Supplies `SystemRoot` on Windows.
   * @returns A {@link WindowsFolderProtector} for `win32`, otherwise a
   * {@link PosixFolderProtector}.
   * @example
   * ```ts
   * import { FolderProtectorFactory, SystemCommand, type IFolderProtector } from "@noldova/teamrun-shell-runtime";
   *
   * export const protector: IFolderProtector = FolderProtectorFactory.create("linux", new SystemCommand(), {});
   * ```
   */
  public static create(platform: string, command: SystemCommand, environment: NodeJS.ProcessEnv): IFolderProtector;
}

/**
 * Restricts a folder to its owner with POSIX permissions (`0700`).
 */
export declare class PosixFolderProtector implements IFolderProtector {
  /**
   * Sets the folder's mode to `0700`.
   *
   * @param folder The absolute path of an existing folder.
   * @returns A promise that resolves once the mode is set.
   * @example
   * ```ts
   * import { PosixFolderProtector } from "@noldova/teamrun-shell-runtime";
   *
   * export function protectAsync(folder: string): Promise<void> {
   *   return new PosixFolderProtector().protectAsync(folder);
   * }
   * ```
   */
  public protectAsync(folder: string): Promise<void>;
}

/**
 * Restricts a folder to the current user on Windows: it removes inherited
 * permissions and grants the user full control, inherited by files and folders
 * created inside.
 */
export declare class WindowsFolderProtector implements IFolderProtector {
  /**
   * Creates the protector.
   *
   * @param command Runs `whoami.exe` and `icacls.exe` from
   * `%SystemRoot%\System32`.
   * @param environment Supplies `SystemRoot`.
   * @example
   * ```ts
   * import { SystemCommand, WindowsFolderProtector } from "@noldova/teamrun-shell-runtime";
   *
   * export const protector: WindowsFolderProtector = new WindowsFolderProtector(new SystemCommand(), { SystemRoot: "C:\\Windows" });
   * ```
   */
  public constructor(command: SystemCommand, environment: NodeJS.ProcessEnv);

  /**
   * Reads the current user's security identifier and replaces the folder's
   * permissions with full control for that user alone: it resets the folder
   * to the permissions it inherits, which drops every explicit entry, stops
   * inheriting, grants the user full control and reads the result back.
   *
   * @param folder The absolute path of an existing folder.
   * @returns A promise that resolves once only the current user has access.
   * @throws {SystemCommandException} The promise rejects when `SystemRoot` is
   * not set, a tool fails, the identifier cannot be read or the folder is
   * still open to anyone else afterwards.
   * @example
   * ```ts
   * import type { WindowsFolderProtector } from "@noldova/teamrun-shell-runtime";
   *
   * export function protectAsync(protector: WindowsFolderProtector, folder: string): Promise<void> {
   *   return protector.protectAsync(folder);
   * }
   * ```
   */
  public protectAsync(folder: string): Promise<void>;
}

/**
 * The exclusive ownership of a data directory, held for the owning process's
 * lifetime by an exclusive transaction in the ownership database. The
 * operating system releases it when the process ends.
 */
export declare class OwnershipLock implements Disposable {
  /**
   * The owned data directory.
   */
  public readonly dataDirectory: DataDirectory;

  private constructor();

  /**
   * Takes the directory's ownership, creating the directory when missing. It
   * waits up to 250 milliseconds for a brief {@link OwnershipLock.isOwned}
   * probe to finish.
   *
   * @param dataDirectory The directory to own.
   * @returns The held ownership.
   * @throws {DataDirectoryOwnedException} When another connection, in this or
   * another process, holds the ownership.
   * @throws {Error} When the ownership database cannot be used.
   * @example
   * ```ts
   * import { DataDirectory, OwnershipLock } from "@noldova/teamrun-shell-runtime";
   *
   * export function canOwn(root: string): boolean {
   *   using lock = OwnershipLock.acquire(new DataDirectory(root));
   *   return lock.isHeld;
   * }
   * ```
   */
  public static acquire(dataDirectory: DataDirectory): OwnershipLock;

  /**
   * Tells whether a runtime owns the directory now, without taking the
   * ownership: it tries the exclusive transaction and rolls it back at once.
   * Nothing is created when the directory has no ownership database.
   *
   * @param dataDirectory The directory to probe.
   * @returns `true` when another connection holds the ownership.
   * @throws {Error} When the ownership database cannot be used.
   * @example
   * ```ts
   * import { DataDirectory, OwnershipLock } from "@noldova/teamrun-shell-runtime";
   *
   * export const isLive: boolean = OwnershipLock.isOwned(new DataDirectory("/home/person/.noldova/teamrun"));
   * ```
   */
  public static isOwned(dataDirectory: DataDirectory): boolean;

  /**
   * Whether the ownership is still held.
   */
  public get isHeld(): boolean;

  /**
   * Confirms that the ownership is still held.
   *
   * @throws {OwnershipReleasedException} When it was released.
   * @example
   * ```ts
   * import type { OwnershipLock } from "@noldova/teamrun-shell-runtime";
   *
   * export function ensureOwned(lock: OwnershipLock): void {
   *   lock.requireHeld();
   * }
   * ```
   */
  public requireHeld(): void;

  /**
   * Releases the ownership; releasing again does nothing.
   *
   * @example
   * ```ts
   * import type { OwnershipLock } from "@noldova/teamrun-shell-runtime";
   *
   * export function releaseOwnership(lock: OwnershipLock): void {
   *   lock.release();
   * }
   * ```
   */
  public release(): void;

  /**
   * Releases the ownership.
   */
  public [Symbol.dispose](): void;
}

/**
 * How a newer or older build relates to another, judged by product version.
 */
export declare enum BuildRelation {
  /**
   * The build's product version is higher.
   */
  Newer = "Newer",

  /**
   * Both builds have the same product version, as successive development builds do.
   */
  SameVersion = "SameVersion",

  /**
   * The build's product version is lower.
   */
  Older = "Older"
}

/**
 * The transport of a runtime's local endpoint.
 */
export declare enum EndpointKind {
  /**
   * Loopback TCP, used on Windows.
   */
  Tcp = "Tcp",

  /**
   * A local Unix socket, used on macOS and Linux.
   */
  Socket = "Socket"
}

/**
 * The exception thrown when a runtime cannot be reached, closes the connection or refuses it.
 */
export declare class ConnectionException extends Exception {
  /**
   * The failure the runtime answered with, a `Disconnected` failure when an established connection has ended,
   * or `null` when the runtime could not be reached, did not finish the handshake or did not answer in time.
   */
  public readonly failure: Failure | null;

  /**
   * Creates the exception.
   *
   * @param message What went wrong.
   * @param failure The runtime's failure, or `null` when there was none. Defaults to `null`.
   * @param options The underlying error, if any.
   * @example
   * ```ts
   * import { Failure, FailureCode } from "@noldova/teamrun-shell-protocol";
   * import { ConnectionException } from "@noldova/teamrun-shell-runtime";
   *
   * export function refuse(): never {
   *   const failure = new Failure(FailureCode.Unauthorized, "The capability token is not valid for this runtime.");
   *   throw new ConnectionException(failure.message, failure);
   * }
   * ```
   */
  public constructor(message: string, failure?: Failure | null, options?: ExceptionOptions);
}

/**
 * The exception thrown when a runtime cannot be started, does not start in time, or another build's runtime does not stop.
 */
export declare class LaunchException extends Exception {
  /**
   * Creates the exception.
   *
   * @param message What went wrong.
   * @param options The underlying error, if any.
   * @example
   * ```ts
   * import { LaunchException } from "@noldova/teamrun-shell-runtime";
   *
   * export function fail(): never {
   *   throw new LaunchException("The runtime did not start in time.");
   * }
   * ```
   */
  public constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a module's program is not found or cannot be started.
 */
export declare class ProcessStartException extends Exception {
  /**
   * Creates the exception.
   *
   * @param message What went wrong.
   * @param options The underlying error, if any.
   * @example
   * ```ts
   * import { ProcessStartException } from "@noldova/teamrun-shell-runtime";
   *
   * export function fail(): never {
   *   throw new ProcessStartException("The program \"git\" is not on the PATH.");
   * }
   * ```
   */
  public constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when the build's product file cannot be read: the file
 * is missing or not JSON, or a field is missing or blank. Its message names
 * the file and the problem.
 */
export declare class ProductFileException extends Exception {
  /**
   * Creates the exception.
   *
   * @param message What is wrong.
   * @param options The cause, when another error led to this one.
   * @example
   * ```ts
   * import { ProductFileException } from "@noldova/teamrun-shell-runtime";
   *
   * export function fail(): never {
   *   throw new ProductFileException("The build's product file has no build.");
   * }
   * ```
   */
  public constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception a method handler throws to answer its request with a specific failure.
 */
export declare class MethodFailureException extends Exception {
  /**
   * The failure the request is answered with.
   */
  public readonly failure: Failure;

  /**
   * Creates the exception.
   *
   * @param failure The failure to answer with; its message becomes the exception's message.
   * @example
   * ```ts
   * import { Failure, FailureCode } from "@noldova/teamrun-shell-protocol";
   * import { MethodFailureException } from "@noldova/teamrun-shell-runtime";
   *
   * export function fail(path: string): never {
   *   throw new MethodFailureException(new Failure(FailureCode.NotFound, `The note ${path} does not exist.`, { path }));
   * }
   * ```
   */
  public constructor(failure: Failure);
}

/**
 * The exception thrown when the data directory holds data from a release that predates the shell. The runtime is refusing until the data is moved aside.
 */
export declare class PreShellDataFoundException extends Exception {
  /**
   * Where the old data is.
   */
  public readonly data: PreShellData;

  /**
   * Creates the exception.
   *
   * @param data Where the old data is.
   * @example
   * ```ts
   * import { PreShellData } from "@noldova/teamrun-shell-protocol";
   * import { PreShellDataFoundException } from "@noldova/teamrun-shell-runtime";
   *
   * export function fail(): never {
   *   throw new PreShellDataFoundException(new PreShellData("/home/person/.noldova/teamrun"));
   * }
   * ```
   */
  public constructor(data: PreShellData);
}

/**
 * The exception thrown when the build's module declarations cannot be read: the
 * file is missing or not JSON, its format version is unsupported, or a
 * declaration lacks a valid field. Its message names the file and the problem.
 */
export declare class DeclarationsFormatException extends Exception {
  /**
   * Creates the exception.
   *
   * @param message What is wrong.
   * @param options The cause, when another error led to this one.
   * @example
   * ```ts
   * import { DeclarationsFormatException } from "@noldova/teamrun-shell-runtime";
   *
   * export function fail(): never {
   *   throw new DeclarationsFormatException("A module declaration's id is missing or invalid.");
   * }
   * ```
   */
  public constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a module's runtime package does not export a
 * `RuntimePart` class whose instances can activate and deactivate.
 */
export declare class ModuleLoadException extends Exception {
  /**
   * Creates the exception.
   *
   * @param message What is wrong.
   * @example
   * ```ts
   * import { ModuleLoadException } from "@noldova/teamrun-shell-runtime";
   *
   * export function fail(): never {
   *   throw new ModuleLoadException("The package does not export a RuntimePart class.");
   * }
   * ```
   */
  public constructor(message: string);
}

/**
 * The exception thrown when a module asks for a service it may not use, one
 * that is not published, or one that is not of the requested type.
 */
export declare class ServiceAccessException extends Exception {
  /**
   * Creates the exception.
   *
   * @param message What went wrong.
   * @example
   * ```ts
   * import { ServiceAccessException } from "@noldova/teamrun-shell-runtime";
   *
   * export function fail(): never {
   *   throw new ServiceAccessException("No service tasks.store is published.");
   * }
   * ```
   */
  public constructor(message: string);
}

/**
 * The exception thrown when a method, event or service name is registered twice, an event is published after it was withdrawn, or a module registers a name its declaration does not contribute or publishes a service under another owner's id.
 */
export declare class RegistrationException extends Exception {
  /**
   * Creates the exception.
   *
   * @param message What went wrong.
   * @example
   * ```ts
   * import { RegistrationException } from "@noldova/teamrun-shell-runtime";
   *
   * export function fail(): never {
   *   throw new RegistrationException("The method notes.open is already registered.");
   * }
   * ```
   */
  public constructor(message: string);
}

/**
 * The exception thrown when a setting is not declared, does not accept a
 * value or a scope, or is a device setting given no device. A method that
 * lets it escape answers with its failure.
 */
export declare class SettingException extends MethodFailureException {
  /**
   * Creates the exception.
   *
   * @param message What went wrong.
   * @param code The failure code a client receives: `NotFound` for an
   * unknown setting, `InvalidParams` otherwise.
   * @example
   * ```ts
   * import { FailureCode } from "@noldova/teamrun-shell-protocol";
   * import { SettingException } from "@noldova/teamrun-shell-runtime";
   *
   * export function fail(): never {
   *   throw new SettingException("No setting named clock.speed is declared.", FailureCode.NotFound);
   * }
   * ```
   */
  public constructor(message: string, code: FailureCode);
}

/**
 * Thrown when another build's runtime owns the data directory and the client
 * was told not to take it over.
 */
export declare class BuildMismatchException extends Exception {
  /**
   * The running runtime's build identity and the program it runs from.
   */
  public readonly handover: RuntimeHandover;

  /**
   * Creates the exception.
   *
   * @param handover The running runtime's identity and program.
   * @example
   * ```ts
   * import { type BuildIdentity, RuntimeHandover } from "@noldova/teamrun-shell-protocol";
   * import { BuildMismatchException } from "@noldova/teamrun-shell-runtime";
   *
   * export function refuse(running: BuildIdentity): never {
   *   throw new BuildMismatchException(new RuntimeHandover(running, "/opt/teamrun/teamrun"));
   * }
   * ```
   */
  public constructor(handover: RuntimeHandover);
}

/**
 * Thrown when no runtime owns the data directory and the client was told not
 * to start one.
 */
export declare class NoRuntimeException extends Exception {
  /**
   * The data directory's root.
   */
  public readonly root: string;

  /**
   * Creates the exception.
   *
   * @param root The data directory's root.
   * @example
   * ```ts
   * import { NoRuntimeException } from "@noldova/teamrun-shell-runtime";
   *
   * export function refuse(root: string): never {
   *   throw new NoRuntimeException(root);
   * }
   * ```
   */
  public constructor(root: string);
}

/**
 * The exception thrown when a newer build's runtime owns the data directory, so this older build hands the person over to it.
 */
export declare class RuntimeHandoverException extends Exception {
  /**
   * The newer runtime's build identity and the program it runs from.
   */
  public readonly handover: RuntimeHandover;

  /**
   * Creates the exception.
   *
   * @param handover The newer runtime's identity and program.
   * @example
   * ```ts
   * import { type BuildIdentity, RuntimeHandover } from "@noldova/teamrun-shell-protocol";
   * import { RuntimeHandoverException } from "@noldova/teamrun-shell-runtime";
   *
   * export function handOver(newer: BuildIdentity): never {
   *   throw new RuntimeHandoverException(new RuntimeHandover(newer, "/opt/teamrun/teamrun"));
   * }
   * ```
   */
  public constructor(handover: RuntimeHandover);
}

/**
 * The exception thrown when an older build's runtime refuses to stop because work is in progress, so the person must choose to wait or stop it.
 */
export declare class WorkInProgressException extends Exception {
  /**
   * The work in progress.
   */
  public readonly work: RunningWork;

  /**
   * Creates the exception.
   *
   * @param work The work the runtime reported.
   * @example
   * ```ts
   * import { RunningWork } from "@noldova/teamrun-shell-protocol";
   * import { WorkInProgressException } from "@noldova/teamrun-shell-runtime";
   *
   * export function fail(): never {
   *   throw new WorkInProgressException(new RunningWork(["Indexing the project"]));
   * }
   * ```
   */
  public constructor(work: RunningWork);
}

/**
 * Something whose idleness an {@link IdleMonitor} watches.
 */
export interface IIdleParticipant {
  /**
   * Whether nothing keeps the participant busy.
   */
  readonly isIdle: boolean;

  /**
   * Called when the participant has stayed idle for the monitor's whole grace period.
   * @example
   * ```ts
   * import type { IIdleParticipant } from "@noldova/teamrun-shell-runtime";
   *
   * export class Session implements IIdleParticipant {
   *   public isIdle: boolean = true;
   *
   *   public handleIdle(): void {
   *     console.log("The session stayed idle for the whole grace period.");
   *   }
   * }
   * ```
   */
  handleIdle(): void;
}

/**
 * Starts the runtime's process detached, so that it outlives the client that started it.
 */
export interface IProcessStarter {
  /**
   * Starts a program detached, without standard input or output, writing its standard error to a file.
   *
   * @param executable The program to run.
   * @param launchArguments The program's arguments.
   * @param environment The program's environment.
   * @param errorFile The file the program's standard error is appended to.
   * @returns A promise of the started process's id, once the process exists.
   * @throws {LaunchException} Rejected when the program cannot be started.
   * @example
   * ```ts
   * import type { IProcessStarter } from "@noldova/teamrun-shell-runtime";
   *
   * export class RecordingStarter implements IProcessStarter {
   *   public readonly started: string[] = [];
   *
   *   public async startAsync(executable: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv, errorFile: string): Promise<number> {
   *     this.started.push([executable, ...launchArguments, errorFile].join(" "));
   *     return Object.keys(environment).length;
   *   }
   * }
   * ```
   */
  startAsync(executable: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv, errorFile: string): Promise<number>;
}

/**
 * Handles requests for one registered method.
 */
export interface IMethodHandler {
  /**
   * Handles one request.
   *
   * @param context The request's payload and its cancellation signal, which aborts on cancellation, deadline or disconnect.
   * @returns A promise of the response payload. Reject with {@link MethodFailureException} or a protocol exception to answer with a specific failure; a JSON reading error is answered as invalid parameters, and anything else as an internal failure.
   * A payload too large for one frame is answered as `FrameTooLarge`, and one that cannot be written as JSON as an internal
   * failure; the connection stays open.
   * @example
   * ```ts
   * import type { JsonValue } from "@noldova/teamrun-foundation-json";
   * import type { IMethodHandler, RequestContext } from "@noldova/teamrun-shell-runtime";
   *
   * export class EchoHandler implements IMethodHandler {
   *   public async handleAsync(context: RequestContext): Promise<JsonValue> {
   *     context.signal.throwIfAborted();
   *     return { client: context.client, payload: context.payload };
   *   }
   * }
   * ```
   */
  handleAsync(context: RequestContext): Promise<JsonValue>;
}

/**
 * A module's runtime part. A module's runtime package exports it as the class
 * `RuntimePart`, which the runtime constructs without arguments. Its
 * constructor only sets fields: the runtime constructs it before migrating the
 * module's database, so work belongs in {@link IRuntimePart.activateAsync}.
 */
export interface IRuntimePart {
  /**
   * The migrations of the module's database, in order: a fixed list the part
   * declares, never computed from data. The runtime applies the pending ones
   * before activating the part and gives the part the open database through its
   * context. A part without migrations has no database.
   */
  readonly migrations?: readonly Migration[];

  /**
   * Activates the part once, after the modules it depends on: it registers its
   * methods and events, publishes its services and keeps heavy work for later.
   *
   * @param context What the part may register and use.
   * @returns A promise that resolves once the part is active; a rejection
   * marks the module failed and withdraws what it registered.
   * @example
   * ```ts
   * import type { IRuntimePart, IRuntimePartContext } from "@noldova/teamrun-shell-runtime";
   *
   * export class RuntimePart implements IRuntimePart {
   *   public async activateAsync(context: IRuntimePartContext): Promise<void> {
   *     context.registerMethod("notes.list", { handleAsync: async () => [] });
   *   }
   *
   *   public async deactivateAsync(): Promise<void> {
   *   }
   * }
   * ```
   */
  activateAsync(context: IRuntimePartContext): Promise<void>;

  /**
   * Deactivates the part when the runtime stops, before the runtime withdraws
   * what the part registered: it releases its timers, files and processes.
   *
   * @returns A promise that resolves once the part has released everything.
   * @example
   * ```ts
   * import type { IRuntimePart } from "@noldova/teamrun-shell-runtime";
   *
   * export function stopAsync(part: IRuntimePart): Promise<void> {
   *   return part.deactivateAsync();
   * }
   * ```
   */
  deactivateAsync(): Promise<void>;
}

/**
 * A module's own database as its runtime part uses it: queries, changes and
 * transactions. The runtime owns its lifetime.
 */
export interface IModuleDatabase {
  /**
   * Runs a query and returns its first row.
   *
   * @param statement The SQL statement, with `?` placeholders.
   * @param values The placeholders' values, in order.
   * @returns The first row, or `undefined` when there is none.
   * @throws Error synchronously when the statement fails.
   * @example
   * ```ts
   * import type { IModuleDatabase } from "@noldova/teamrun-shell-runtime";
   *
   * export function readTitle(database: IModuleDatabase, id: string): unknown {
   *   return database.read("SELECT title FROM notes WHERE id = ?", id)?.["title"];
   * }
   * ```
   */
  read(statement: string, ...values: SQLInputValue[]): Record<string, SQLOutputValue> | undefined;

  /**
   * Runs a query and returns all its rows.
   *
   * @param statement The SQL statement, with `?` placeholders.
   * @param values The placeholders' values, in order.
   * @returns The rows, in the query's order.
   * @throws Error synchronously when the statement fails.
   * @example
   * ```ts
   * import type { IModuleDatabase } from "@noldova/teamrun-shell-runtime";
   *
   * export function countNotes(database: IModuleDatabase): number {
   *   return database.readAll("SELECT id FROM notes").length;
   * }
   * ```
   */
  readAll(statement: string, ...values: SQLInputValue[]): Record<string, SQLOutputValue>[];

  /**
   * Runs a statement that changes the database.
   *
   * @param statement The SQL statement, with `?` placeholders.
   * @param values The placeholders' values, in order.
   * @returns How many rows changed and the last inserted row id.
   * @throws Error synchronously when the statement fails.
   * @example
   * ```ts
   * import type { IModuleDatabase } from "@noldova/teamrun-shell-runtime";
   *
   * export function addNote(database: IModuleDatabase, id: string): void {
   *   database.run("INSERT INTO notes (id) VALUES (?)", id);
   * }
   * ```
   */
  run(statement: string, ...values: SQLInputValue[]): StatementResultingChanges;

  /**
   * Runs an action in one transaction, as {@link MigratedDatabase.transaction}
   * does: the action finishes synchronously, and one that returns a promise
   * does not compile.
   *
   * @param action The work.
   * @returns What the action returned.
   * @throws {ArgumentException} When the action returned a thenable; nothing was committed.
   * @throws Error synchronously as the action threw it, after rolling back.
   * @example
   * ```ts
   * import type { IModuleDatabase } from "@noldova/teamrun-shell-runtime";
   *
   * export function renameNote(database: IModuleDatabase, from: string, to: string): void {
   *   database.transaction(() => {
   *     database.run("INSERT INTO notes (id) VALUES (?)", to);
   *     database.run("DELETE FROM notes WHERE id = ?", from);
   *   });
   * }
   * ```
   */
  transaction<T>(action: () => T & ([T] extends [PromiseLike<unknown>] ? never : unknown)): T;
}

/**
 * A runtime part's access to settings: it reads its own settings, its
 * dependencies' and the shell's, changes only its own, and describes the
 * setting scopes its declaration lists. Calls are synchronous; values live
 * in the shell's database.
 */
export interface IModuleSettings {
  /**
   * Reads a setting's value in effect: the value set for the scope object,
   * else for each enclosing scope, else for the application, else the
   * default. A device setting reads the given device's value.
   *
   * @param name The setting's name.
   * @param scope The scope object; `null` by default, the application.
   * @param device The device, for a device setting; `null` by default.
   * @returns The value in effect.
   * @throws {RegistrationException} When the setting is another module's that
   * is not a dependency.
   * @throws {SettingException} When no such setting is declared, or the
   * setting does not list the scope.
   * @example
   * ```ts
   * import type { JsonValue } from "@noldova/teamrun-foundation-json";
   * import type { IRuntimePartContext } from "@noldova/teamrun-shell-runtime";
   *
   * export function readStep(context: IRuntimePartContext): JsonValue {
   *   return context.settings.read("clock.tickStep");
   * }
   * ```
   */
  read(name: string, scope?: SettingScope | null, device?: string | null): JsonValue;

  /**
   * Sets one of the module's own settings for the application, a scope
   * object or, for a device setting, a device.
   *
   * @param name The setting's name.
   * @param value The value; one the setting accepts.
   * @param scope The scope object; `null` by default, the application.
   * @param device The device, for a device setting; `null` by default.
   * @throws {RegistrationException} When the setting is not the module's own.
   * @throws {SettingException} When the setting is unknown, does not accept
   * the value or the scope, or is a device setting given no device.
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/teamrun-shell-runtime";
   *
   * export function slowDown(context: IRuntimePartContext): void {
   *   context.settings.write("clock.tickStep", 1);
   * }
   * ```
   */
  write(name: string, value: JsonValue, scope?: SettingScope | null, device?: string | null): void;

  /**
   * Removes one of the module's own setting values, so the enclosing value
   * or the default takes effect.
   *
   * @param name The setting's name.
   * @param scope The scope object; `null` by default, the application.
   * @param device The device, for a device setting; `null` by default.
   * @throws {RegistrationException} When the setting is not the module's own.
   * @throws {SettingException} As `write` does.
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/teamrun-shell-runtime";
   *
   * export function restore(context: IRuntimePartContext): void {
   *   context.settings.reset("clock.tickStep");
   * }
   * ```
   */
  reset(name: string, scope?: SettingScope | null, device?: string | null): void;

  /**
   * Follows a readable setting: the listener receives each change, a value
   * set or reset for any scope or device, with the value then in effect for
   * that key. It stops when the part deactivates.
   *
   * @param name The setting's name.
   * @param listener Called after each change commits.
   * @throws {RegistrationException} As `read` does.
   * @throws {SettingException} When no such setting is declared.
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/teamrun-shell-runtime";
   *
   * export function follow(context: IRuntimePartContext, apply: (step: number) => void): void {
   *   context.settings.onChanged("clock.tickStep", t => apply(Number(t.value)));
   * }
   * ```
   */
  onChanged(name: string, listener: (change: SettingChange) => void): void;

  /**
   * Records which scope object encloses one of the module's scope objects,
   * such as a conversation's project, or that none does.
   *
   * @param scope One of the module's scope objects.
   * @param parent The enclosing object, of the module's own scopes or a
   * dependency's; `null` when the application encloses it.
   * @throws {RegistrationException} When the scope is not the module's or the
   * parent's scope is neither its own nor a dependency's.
   * @example
   * ```ts
   * import { QualifiedName, SettingScope } from "@noldova/teamrun-shell-protocol";
   * import type { IRuntimePartContext } from "@noldova/teamrun-shell-runtime";
   *
   * export function place(context: IRuntimePartContext, conversation: string, project: string): void {
   *   context.settings.setScopeParent(
   *     new SettingScope(QualifiedName.parse("chat.conversation"), conversation),
   *     new SettingScope(QualifiedName.parse("projects.project"), project));
   * }
   * ```
   */
  setScopeParent(scope: SettingScope, parent: SettingScope | null): void;

  /**
   * Removes the values set for one of the module's scope objects and its
   * enclosure, when the object is deleted.
   *
   * @param scope One of the module's scope objects.
   * @throws {RegistrationException} When the scope is not the module's.
   * @example
   * ```ts
   * import { QualifiedName, SettingScope } from "@noldova/teamrun-shell-protocol";
   * import type { IRuntimePartContext } from "@noldova/teamrun-shell-runtime";
   *
   * export function forget(context: IRuntimePartContext, conversation: string): void {
   *   context.settings.removeScope(new SettingScope(QualifiedName.parse("chat.conversation"), conversation));
   * }
   * ```
   */
  removeScope(scope: SettingScope): void;
}

/**
 * A module's lines in the runtime's log.
 */
export interface IModuleLog {
  /**
   * Writes a message to `logs/runtime.log`, each of its lines starting with
   * the module's id, with the home folder shown as `~` and opaque values such
   * as tokens removed.
   *
   * @param message The message.
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/teamrun-shell-runtime";
   *
   * export function report(context: IRuntimePartContext, count: number): void {
   *   context.log.write(`Indexed ${count} files.`);
   * }
   * ```
   */
  write(message: string): void;
}

/**
 * What a module's runtime part may register and use. The runtime withdraws
 * everything registered through it when the part deactivates or fails to
 * activate.
 */
export interface IRuntimePartContext {
  /**
   * The module's id.
   */
  readonly moduleId: string;

  /**
   * The module's folder in the data directory, `modules/<id>`, for its
   * database and files; the module creates it when it needs it.
   */
  readonly moduleFolder: string;

  /**
   * The module's own database, migrated and open. Its calls are synchronous
   * and every client shares one runtime, so queries stay short and long work
   * happens outside a database call. The runtime closes it when the part
   * deactivates.
   *
   * @throws {ModuleDatabaseException} When the part declares no migrations.
   */
  readonly database: IModuleDatabase;

  /**
   * The module's access to settings: its own, its dependencies' and the
   * shell's.
   */
  readonly settings: IModuleSettings;

  /**
   * The module's lines in the runtime's log.
   */
  readonly log: IModuleLog;

  /**
   * The module's folder in the data directory's `work` folder,
   * `work/<id>`, for work outside any project; the module creates and
   * removes what it puts inside.
   *
   * @returns A promise of the folder, created when it is first asked for.
   * @example
   * ```ts
   * import path from "node:path";
   *
   * import type { IRuntimePartContext } from "@noldova/teamrun-shell-runtime";
   *
   * export async function locateScratchAsync(context: IRuntimePartContext, conversation: string): Promise<string> {
   *   return path.join(await context.getWorkFolderAsync(), conversation);
   * }
   * ```
   */
  getWorkFolderAsync(): Promise<string>;

  /**
   * Reports work in progress, which the runtime lists in `shell.work` and
   * which keeps it from stopping while idle. TeamRun asks the person before
   * quitting while it runs.
   *
   * @param description What the work is, as the person reads it.
   * @returns The work item: its signal aborts when the person stops the
   * work, and disposing it ends the work. Work still open ends when the part
   * deactivates.
   * @throws {ArgumentException} When the description is empty or whitespace.
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/teamrun-shell-runtime";
   *
   * export async function indexAsync(context: IRuntimePartContext, index: (signal: AbortSignal) => Promise<void>): Promise<void> {
   *   using work = context.beginWork("Indexing the project");
   *   await index(work.signal);
   * }
   * ```
   */
  beginWork(description: string): WorkItem;

  /**
   * Starts a program the runtime owns on the module's behalf. The program is
   * found on the PATH unless it is an absolute path that names its drive or
   * share on Windows; on Windows each PATHEXT extension among `.com`, `.exe`,
   * `.bat` and `.cmd` is tried, after the name itself when it has one of
   * them, and a `.bat` or `.cmd` file runs through `cmd.exe` with its
   * arguments escaped. The program gets only the system variables
   * {@link ProcessRequest} lists and the ones the request names. The runtime
   * records it, ends it
   * and what it started when the part deactivates or the runtime stops,
   * giving it 3 seconds to exit first, and ends what a crashed runtime left
   * running on its next start. Aborting the request's signal stops the
   * program the same way; a signal already aborted rejects with its reason.
   *
   * @param request The program, its arguments, working folder, environment
   * and abort signal.
   * @returns A promise of the running program, once it has started.
   * @throws {ProcessStartException} Rejected when the program is a relative
   * path, is not found or cannot start, when a batch file's argument holds
   * a line break or a null character, or once the part is deactivating.
   * @example
   * ```ts
   * import { type IRuntimePartContext, type OwnedProcess, ProcessRequest } from "@noldova/teamrun-shell-runtime";
   *
   * export function startStatusAsync(context: IRuntimePartContext, project: string): Promise<OwnedProcess> {
   *   return context.startProcessAsync(new ProcessRequest("git", ["status", "--porcelain"], project, { GIT_PAGER: "cat" }, ["SSH_AUTH_SOCK"]));
   * }
   * ```
   */
  startProcessAsync(request: ProcessRequest): Promise<OwnedProcess>;

  /**
   * Registers a handler for one of the methods the module's declaration
   * contributes.
   *
   * @param name The method's name, `<id>.<name>`.
   * @param handler Its handler.
   * @throws {RegistrationException} When the declaration does not contribute
   * the method or it is already registered.
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/teamrun-shell-runtime";
   *
   * export function serve(context: IRuntimePartContext): void {
   *   context.registerMethod("notes.list", { handleAsync: async () => [] });
   * }
   * ```
   */
  registerMethod(name: string, handler: IMethodHandler): void;

  /**
   * Declares one of the events the module's declaration contributes.
   *
   * @param name The event's name, `<id>.<name>`.
   * @returns The channel the module publishes the event through.
   * @throws {RegistrationException} When the declaration does not contribute
   * the event or it is already declared.
   * @example
   * ```ts
   * import type { EventChannel, IRuntimePartContext } from "@noldova/teamrun-shell-runtime";
   *
   * export function announce(context: IRuntimePartContext): EventChannel {
   *   return context.declareEvent("notes.changed");
   * }
   * ```
   */
  declareEvent(name: string): EventChannel;

  /**
   * Registers one of the commands the module's declaration contributes. A
   * window runs it through `shell.runCommand`; it is withdrawn when the
   * module deactivates.
   *
   * @param command The command, its title, icon, default key and handler.
   * @throws {RegistrationException} When the declaration does not contribute
   * the command or it is already registered.
   * @example
   * ```ts
   * import { type IRuntimePartContext, RuntimeCommand } from "@noldova/teamrun-shell-runtime";
   *
   * export function serveTick(context: IRuntimePartContext): void {
   *   context.registerCommand(new RuntimeCommand("clock.tick", "Tick", "timer", "Mod+Alt+T", { handleAsync: async () => null }));
   * }
   * ```
   */
  registerCommand(command: RuntimeCommand): void;

  /**
   * Posts a notification of a kind the module's declaration contributes; posting the same kind and key again replaces the
   * earlier one. Its commands must be the module's own or a dependency's. It is dismissed when the module deactivates.
   *
   * @param post What to show.
   * @returns The notification's handle, which updates or dismisses it.
   * @throws {RegistrationException} When the declaration does not contribute the kind, or a command belongs to another
   * module that is not a dependency.
   * @example
   * ```ts
   * import type { IRuntimePartContext, NotificationHandle } from "@noldova/teamrun-shell-runtime";
   * import { NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/teamrun-shell-protocol";
   *
   * export function announce(context: IRuntimePartContext): NotificationHandle {
   *   return context.postNotification(new NotificationPost(QualifiedName.parse("clock.alarm"), null, "Alarm", null, NotificationSeverity.Info, null, [], null));
   * }
   * ```
   */
  postNotification(post: NotificationPost): NotificationHandle;

  /**
   * Publishes a service for the modules that depend on this one.
   *
   * @param name The service's name, `<id>.<name>` with the module's own id.
   * @param service The service, an instance of a class the module's API
   * exports.
   * @throws {RegistrationException} When the name has another owner or is
   * already published.
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/teamrun-shell-runtime";
   *
   * export class NoteStore {
   *   public readonly titles: string[] = [];
   * }
   *
   * export function publish(context: IRuntimePartContext): void {
   *   context.publishService("notes.store", new NoteStore());
   * }
   * ```
   */
  publishService(name: string, service: object): void;

  /**
   * Finds a service of the shell or of a module this one depends on.
   *
   * @param name The service's name, `<owner>.<name>`; the owner is `shell`
   * or a dependency's id.
   * @param type The class the service is an instance of.
   * @returns The service.
   * @throws {ServiceAccessException} When the owner is neither the shell nor a
   * dependency, nothing is published under the name, or the service is not an
   * instance of the type.
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/teamrun-shell-runtime";
   *
   * export class TaskStore {
   *   public readonly titles: string[] = [];
   * }
   *
   * export function countTasks(context: IRuntimePartContext): number {
   *   return context.getService("tasks.store", TaskStore).titles.length;
   * }
   * ```
   */
  getService<T extends object>(name: string, type: abstract new (...args: never[]) => T): T;
}

/**
 * Loads a module's runtime part from its package.
 */
export interface IRuntimePartLoader {
  /**
   * Loads and constructs the part.
   *
   * @param packageName The module's runtime package.
   * @returns A promise of the part.
   * @throws {ModuleLoadException} Rejected when the package exports no usable
   * `RuntimePart` class; an import failure rejects as it is.
   * @example
   * ```ts
   * import type { IRuntimePart, IRuntimePartLoader } from "@noldova/teamrun-shell-runtime";
   *
   * export function loadNotesAsync(loader: IRuntimePartLoader): Promise<IRuntimePart> {
   *   return loader.loadAsync("@noldova/teamrun-modules-notes-runtime");
   * }
   * ```
   */
  loadAsync(packageName: string): Promise<IRuntimePart>;
}

/**
 * Receives what a {@link RuntimeClient} learns after its handshake.
 */
export interface IRuntimeClientListener {
  /**
   * Called for each event the runtime publishes to an authenticated connection of the same build.
   *
   * @param event The event.
   * @example
   * ```ts
   * import type { Event, Failure } from "@noldova/teamrun-shell-protocol";
   * import type { IRuntimeClientListener } from "@noldova/teamrun-shell-runtime";
   *
   * export class WindowListener implements IRuntimeClientListener {
   *   public onEvent(event: Event): void {
   *     console.log(event.name.text, event.payload);
   *   }
   *
   *   public onDisconnected(failure: Failure | null): void {
   *     console.log(failure?.message ?? "The connection to the runtime closed.");
   *   }
   * }
   * ```
   */
  onEvent(event: Event): void;

  /**
   * Called once when an established connection closes.
   *
   * @param failure Why the client ended the connection: `FrameTooLarge` for a frame over the limit, `InvalidMessage` for
   * one that is not a valid message. Null when the runtime or the client's own `close` ended it.
   * @example
   * ```ts
   * import type { Event, Failure } from "@noldova/teamrun-shell-protocol";
   * import type { IRuntimeClientListener } from "@noldova/teamrun-shell-runtime";
   *
   * export class WindowListener implements IRuntimeClientListener {
   *   public onEvent(event: Event): void {
   *     console.log(event.name.text, event.payload);
   *   }
   *
   *   public onDisconnected(failure: Failure | null): void {
   *     console.log(failure?.message ?? "The connection to the runtime closed.");
   *   }
   * }
   * ```
   */
  onDisconnected(failure: Failure | null): void;
}

/**
 * A runtime's per-start capability token. It is compared through fixed-length digests in constant time.
 */
export declare class CapabilityToken {
  /**
   * The token's text, published only in protected discovery metadata.
   */
  public readonly value: string;

  /**
   * Creates a token from existing text.
   *
   * @param value The token's text.
   * @throws {ArgumentException} When the text is empty or whitespace.
   * @example
   * ```ts
   * import { CapabilityToken } from "@noldova/teamrun-shell-runtime";
   *
   * export function isValid(published: string, presented: string): boolean {
   *   return new CapabilityToken(published).matches(presented);
   * }
   * ```
   */
  public constructor(value: string);

  /**
   * Creates a token of 32 random bytes in hexadecimal.
   *
   * @returns A new token.
   * @example
   * ```ts
   * import { CapabilityToken } from "@noldova/teamrun-shell-runtime";
   *
   * export const token = CapabilityToken.generate();
   * ```
   */
  public static generate(): CapabilityToken;

  /**
   * Compares a candidate with the token in constant time, whatever its length.
   *
   * @param candidate The text a client presented.
   * @returns `true` when the candidate is the token.
   * @example
   * ```ts
   * import type { CapabilityToken } from "@noldova/teamrun-shell-runtime";
   *
   * export function admits(token: CapabilityToken, presented: string): boolean {
   *   return token.matches(presented);
   * }
   * ```
   */
  public matches(candidate: string): boolean;
}

/**
 * The Linux AppImage a program runs from, as the AppImage runtime names it in `APPIMAGE` and `APPDIR`.
 */
export declare class AppImageSource {
  /**
   * The AppImage file.
   */
  public readonly file: string;

  /**
   * The folder the program runs from: the AppImage's mount point, or the folder it was extracted to.
   */
  public readonly folder: string;

  /**
   * Whether the folder is a mount point, as `/proc/self/mountinfo` lists it; otherwise the program runs from an extraction.
   *
   * @throws {Error} When `/proc/self/mountinfo` cannot be read.
   * @example
   * ```ts
   * import { AppImageSource } from "@noldova/teamrun-shell-runtime";
   *
   * export function isMounted(): boolean {
   *   return AppImageSource.find(process.env, process.execPath)?.isMounted ?? false;
   * }
   * ```
   */
  public get isMounted(): boolean;

  private constructor();

  /**
   * Finds the AppImage a program runs from.
   *
   * @param environment The environment the AppImage runtime set.
   * @param executablePath The program.
   * @returns The AppImage, or `null` when `APPIMAGE` or `APPDIR` is not an absolute path or the program is not inside `APPDIR`.
   * @example
   * ```ts
   * import { AppImageSource } from "@noldova/teamrun-shell-runtime";
   *
   * export function findFile(): string | null {
   *   return AppImageSource.find(process.env, process.execPath)?.file ?? null;
   * }
   * ```
   */
  public static find(environment: NodeJS.ProcessEnv, executablePath: string): AppImageSource | null;

  /**
   * Names the file that starts a program again: its AppImage when it runs from one, since the AppImage's folder ends with the process that holds it, and the program otherwise.
   *
   * @param environment The environment the AppImage runtime set.
   * @param executablePath The program.
   * @returns The AppImage or the program.
   * @example
   * ```ts
   * import { AppImageSource } from "@noldova/teamrun-shell-runtime";
   *
   * export function locate(): string {
   *   return AppImageSource.locateProgram(process.env, process.execPath);
   * }
   * ```
   */
  public static locateProgram(environment: NodeJS.ProcessEnv, executablePath: string): string;
}

/**
 * How {@link RuntimeLauncher.attachAsync} treats a missing runtime and
 * another build's runtime.
 */
export declare class AttachOptions {
  /**
   * Whether to start a runtime when none runs.
   */
  public readonly start: boolean;

  /**
   * Whether to ask an older build's runtime, or another build of the same
   * version, to stop and take its place.
   */
  public readonly takeOver: boolean;

  /**
   * Creates the options.
   *
   * @param start Whether to start a runtime when none runs; yes by default.
   * @param takeOver Whether to take over another build's runtime; yes by
   * default.
   * @example
   * ```ts
   * import { AttachOptions } from "@noldova/teamrun-shell-runtime";
   *
   * export const attachOnly: AttachOptions = new AttachOptions(false, false);
   * ```
   */
  public constructor(start?: boolean, takeOver?: boolean);
}

/**
 * Time limits of a {@link RuntimeClient}.
 */
export declare class ClientSettings {
  /**
   * How long the handshake may take, in milliseconds.
   */
  public readonly handshakeTimeout: number;

  /**
   * The default time limit of a call, in milliseconds.
   */
  public readonly callTimeout: number;

  /**
   * How long after a call's time limit the client still waits for the runtime's answer, in milliseconds.
   */
  public readonly answerGrace: number;

  /**
   * The largest frame the client reads or writes, in characters.
   */
  public readonly maximumFrameLength: number;

  /**
   * Creates the settings.
   *
   * @param handshakeTimeout Milliseconds for the handshake. Defaults to 5 seconds.
   * @param callTimeout The default time limit of a call in milliseconds. Defaults to 10 minutes.
   * @param answerGrace Milliseconds to wait for an answer after a call's limit. Defaults to 5 seconds.
   * @param maximumFrameLength The largest frame in characters. Defaults to 16 MiB.
   * @throws {ArgumentOutOfRangeException} When a value is not a positive integer.
   * @example
   * ```ts
   * import { ClientSettings } from "@noldova/teamrun-shell-runtime";
   *
   * export const settings = new ClientSettings(2_000, 30_000);
   * ```
   */
  public constructor(handshakeTimeout?: number, callTimeout?: number, answerGrace?: number, maximumFrameLength?: number);
}

/**
 * A runtime's local endpoint: loopback TCP on Windows, a Unix socket elsewhere.
 */
export declare class Endpoint {
  /**
   * The endpoint's transport.
   */
  public readonly kind: EndpointKind;

  /**
   * The loopback port, or `null` for a socket.
   */
  public readonly port: number | null;

  /**
   * The socket's absolute path, or `null` for TCP.
   */
  public readonly path: string | null;

  private constructor();

  /**
   * Creates a loopback TCP endpoint.
   *
   * @param port The port, from 1 to 65535.
   * @returns The endpoint.
   * @throws {ArgumentOutOfRangeException} When the port is out of range.
   * @example
   * ```ts
   * import { Endpoint } from "@noldova/teamrun-shell-runtime";
   *
   * export const endpoint = Endpoint.tcp(52100);
   * ```
   */
  public static tcp(port: number): Endpoint;

  /**
   * Creates a Unix socket endpoint.
   *
   * @param socketPath The socket's absolute path.
   * @returns The endpoint.
   * @throws {ArgumentException} When the path is not absolute.
   * @example
   * ```ts
   * import { Endpoint } from "@noldova/teamrun-shell-runtime";
   *
   * export const endpoint = Endpoint.socket("/home/person/.noldova/teamrun/discovery/runtime.sock");
   * ```
   */
  public static socket(socketPath: string): Endpoint;

  /**
   * Reads an endpoint from its text in discovery metadata.
   *
   * @param text `tcp://127.0.0.1:<port>` or a socket's absolute path.
   * @returns The endpoint.
   * @throws {ArgumentException} When the text is neither form.
   * @example
   * ```ts
   * import { Endpoint } from "@noldova/teamrun-shell-runtime";
   *
   * export const port = Endpoint.parse("tcp://127.0.0.1:52100").port;
   * ```
   */
  public static parse(text: string): Endpoint;

  /**
   * Formats the endpoint for discovery metadata.
   *
   * @returns `tcp://127.0.0.1:<port>` or the socket's path.
   * @example
   * ```ts
   * import { Endpoint } from "@noldova/teamrun-shell-runtime";
   *
   * export const text = Endpoint.tcp(52100).toString();
   * ```
   */
  public toString(): string;
}

/**
 * A declared event's publishing side. Disposing it withdraws the event.
 */
export declare class EventChannel implements Disposable {
  /**
   * Creates the channel.
   *
   * @param publisher Publishes one payload.
   * @param withdraw Withdraws the event's declaration.
   * @example
   * ```ts
   * import type { JsonValue } from "@noldova/teamrun-foundation-json";
   * import { EventChannel } from "@noldova/teamrun-shell-runtime";
   *
   * export function createChannel(published: JsonValue[], declared: Set<string>): EventChannel {
   *   declared.add("notes.changed");
   *   return new EventChannel(payload => published.push(payload), () => declared.delete("notes.changed"));
   * }
   * ```
   */
  public constructor(publisher: (payload: JsonValue) => void, withdraw: () => void);

  /**
   * Publishes the event to every authenticated connection of the runtime's build. An event too large for one frame, or
   * one whose payload cannot be written as JSON, reaches no connection and is logged in the runtime's diagnostics.
   *
   * @param payload The event's payload.
   * @throws {RegistrationException} When the event was withdrawn.
   * @example
   * ```ts
   * import { QualifiedName } from "@noldova/teamrun-shell-protocol";
   * import type { EventRegistry } from "@noldova/teamrun-shell-runtime";
   *
   * export function announce(events: EventRegistry, path: string): void {
   *   const channel = events.declare(new QualifiedName("notes", "changed"));
   *   channel.publish({ path });
   *   channel[Symbol.dispose]();
   * }
   * ```
   */
  public publish(payload: JsonValue): void;

  /**
   * Withdraws the event's declaration.
   */
  public [Symbol.dispose](): void;
}

/**
 * How a client starts or attaches to the runtime of one data directory.
 */
export declare class LaunchSettings {
  /**
   * The data directory whose runtime the client uses.
   */
  public readonly dataDirectory: DataDirectory;

  /**
   * The program that runs the runtime's entry, such as Node.js or Electron in Node mode.
   */
  public readonly executablePath: string;

  /**
   * The path of the runtime's entry script, {@link RuntimeEntry.entryPath}.
   */
  public readonly entryPath: string;

  /**
   * The environment a started runtime receives.
   */
  public readonly environment: NodeJS.ProcessEnv;

  /**
   * The platform, as in `process.platform`; Linux starts through the descriptor-closing Bash launcher.
   */
  public readonly platform: string;

  /**
   * How long a started runtime stays idle before it stops, in milliseconds.
   */
  public readonly idleGraceMilliseconds: number;

  /**
   * How long attaching may take, including a takeover, in milliseconds,
   * unless the data directory is owned.
   */
  public readonly launchTimeout: number;

  /**
   * How often attaching looks again for the runtime, in milliseconds.
   */
  public readonly pollInterval: number;

  /**
   * The settings of the clients the launcher connects.
   */
  public readonly clientSettings: ClientSettings;

  /**
   * How long attaching may take, in milliseconds, while the data directory
   * is owned, by the runtime the launcher started or by another.
   */
  public readonly launchLimit: number;

  /**
   * Creates the settings.
   *
   * @param dataDirectory The data directory.
   * @param executablePath The program that runs the entry.
   * @param entryPath The entry script's path.
   * @param environment The started runtime's environment.
   * @param platform The platform, as in `process.platform`.
   * @param idleGraceMilliseconds The idle grace in milliseconds. Defaults to 30 seconds.
   * @param launchTimeout The attach limit in milliseconds. Defaults to 20 seconds.
   * @param pollInterval The polling interval in milliseconds. Defaults to 100 milliseconds.
   * @param clientSettings The clients' settings. Defaults to {@link ClientSettings}' defaults.
   * @param launchLimit The attach limit, in milliseconds, while the data directory is owned.
   * Defaults to 60 seconds, or the launch timeout when that is longer.
   * @throws {ArgumentException} When a path is empty or whitespace.
   * @throws {ArgumentOutOfRangeException} When a duration is not a positive integer, or the
   * launch limit is shorter than the launch timeout.
   * @example
   * ```ts
   * import { DataDirectory, LaunchSettings, RuntimeEntry } from "@noldova/teamrun-shell-runtime";
   *
   * export const settings = new LaunchSettings(
   *   new DataDirectory("/home/person/.noldova/teamrun"),
   *   process.execPath,
   *   RuntimeEntry.entryPath,
   *   process.env,
   *   process.platform);
   * ```
   */
  public constructor(
    dataDirectory: DataDirectory,
    executablePath: string,
    entryPath: string,
    environment: NodeJS.ProcessEnv,
    platform: string,
    idleGraceMilliseconds?: number,
    launchTimeout?: number,
    pollInterval?: number,
    clientSettings?: ClientSettings,
    launchLimit?: number);
}

/**
 * The program and arguments that start a detached runtime. On Linux it wraps the program in Bash that closes inherited descriptors above standard error, without startup files or inherited options. Given a copy record, a program inside an AppImage runs from its own copy of the AppImage instead, which that Bash holds for as long as the program runs: a mount of the AppImage when the program's folder is mounted, or else an extraction in a `teamrun-runtime-` folder of the temporary folder. Bash writes the copy to the record, removes the record once the copy ends, and passes an end signal on to the program.
 */
export declare class ProcessLaunchCommand {
  /**
   * The program to start.
   */
  public readonly executable: string;

  /**
   * The program's arguments, passed literally.
   */
  public readonly arguments: readonly string[];

  /**
   * Creates the command.
   *
   * @param platform The platform, as in `process.platform`.
   * @param executablePath The program that runs the runtime.
   * @param launchArguments Its arguments; the array is copied.
   * @param environment The environment the program is started with, whose `APPIMAGE` and `APPDIR` name the AppImage it runs from.
   * @param copyRecord The file Bash records the program's own copy of its AppImage in, or `null` to start a program inside an AppImage as any other.
   * @throws {ArgumentException} When the program's path is empty or whitespace.
   * @throws {LaunchException} On Linux, when `/bin/bash` is not executable or `/proc/self/fd` cannot be read.
   * @example
   * ```ts
   * import { spawn } from "node:child_process";
   *
   * import { ProcessLaunchCommand, RuntimeEntry } from "@noldova/teamrun-shell-runtime";
   *
   * export function start(dataDirectory: string): void {
   *   const command = new ProcessLaunchCommand(process.platform, process.execPath, [RuntimeEntry.entryPath, "--data-dir", dataDirectory], process.env, null);
   *   spawn(command.executable, command.arguments, { detached: true, stdio: "ignore" }).unref();
   * }
   * ```
   */
  public constructor(platform: string, executablePath: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv, copyRecord: string | null);
}

/**
 * What a refusing runtime answers every handshake with, and the one method a refused connection may call besides `shell.stop`.
 */
export declare class Refusal {
  /**
   * The failure every handshake is answered with.
   */
  public readonly failure: Failure;

  /**
   * The only method a refused connection may call besides `shell.stop`, which every connection may call.
   */
  public readonly method: QualifiedName;

  /**
   * Creates the refusal.
   *
   * @param failure The handshake's failure.
   * @param method The method a refused connection may call besides `shell.stop`.
   * @example
   * ```ts
   * import { Failure, FailureCode, PreShellData, ShellMethods } from "@noldova/teamrun-shell-protocol";
   * import { Refusal, type RuntimeServer } from "@noldova/teamrun-shell-runtime";
   *
   * export function refuseUntilMoved(server: RuntimeServer, root: string): void {
   *   const failure = new Failure(FailureCode.PreShellData, "Move the old data aside.", new PreShellData(root).toJson());
   *   server.refuse(new Refusal(failure, ShellMethods.moveAside));
   * }
   * ```
   */
  public constructor(failure: Failure, method: QualifiedName);
}

/**
 * A registered method handler. Disposing it removes the registration.
 */
export declare class Registration implements Disposable {
  /**
   * Creates the registration.
   *
   * @param release Removes the registration.
   * @example
   * ```ts
   * import { Registration } from "@noldova/teamrun-shell-runtime";
   *
   * export function track(names: Set<string>, name: string): Registration {
   *   names.add(name);
   *   return new Registration(() => names.delete(name));
   * }
   * ```
   */
  public constructor(release: () => void);

  /**
   * Removes the registration.
   */
  public [Symbol.dispose](): void;
}

/**
 * One request as a method handler sees it.
 */
export declare class RequestContext {
  /**
   * The name the calling client gave in its connection's handshake, such as `desktop`.
   */
  public readonly client: string;

  /**
   * The request's payload, which the handler validates.
   */
  public readonly payload: JsonValue;

  /**
   * Aborts when the request is cancelled, reaches its deadline or its connection closes.
   */
  public readonly signal: AbortSignal;

  /**
   * Creates the context.
   *
   * @param client The calling client's name; it must contain a non-whitespace character.
   * @param payload The payload.
   * @param signal The cancellation signal.
   * @throws {ArgumentException} When the client name is empty or whitespace only.
   * @example
   * ```ts
   * import type { JsonValue } from "@noldova/teamrun-foundation-json";
   * import { type IMethodHandler, RequestContext } from "@noldova/teamrun-shell-runtime";
   *
   * export function callDirectlyAsync(handler: IMethodHandler, payload: JsonValue): Promise<JsonValue> {
   *   return handler.handleAsync(new RequestContext("test", payload, AbortSignal.timeout(1_000)));
   * }
   * ```
   */
  public constructor(client: string, payload: JsonValue, signal: AbortSignal);
}

/**
 * A module as the build declares it to the runtime, read from the build's
 * `declarations.json`.
 */
export declare class ModuleDeclaration {
  /**
   * The module's id.
   */
  public readonly id: string;

  /**
   * The module's own version, `<major>.<minor>.<patch>`.
   */
  public readonly version: string;

  /**
   * The name people see.
   */
  public readonly displayName: string;

  /**
   * What the module does, in a sentence people see.
   */
  public readonly description: string;

  /**
   * The ids of the modules it depends on.
   */
  public readonly dependencies: readonly string[];

  /**
   * Its runtime package, or `null` when it has no runtime part.
   */
  public readonly runtimePackage: string | null;

  /**
   * The names it contributes, by kind, such as `methods` and `events`.
   */
  public readonly contributions: ReadonlyMap<string, readonly string[]>;

  /**
   * The definitions of the settings it declares.
   */
  public readonly settings: readonly SettingDefinition[];

  /**
   * Creates the declaration.
   *
   * @param id The module's id: lowercase kebab-case and not `shell`.
   * @param version Its own version, `<major>.<minor>.<patch>`: three whole
   * numbers of up to nine digits without leading zeros, such as `0.0.1`.
   * @param displayName The name people see; not whitespace only.
   * @param description What the module does; not whitespace only.
   * @param dependencies The ids of the modules it depends on.
   * @param runtimePackage Its runtime package, or `null`.
   * @param contributions The names it contributes, by kind.
   * @param settings The definitions of its settings, each its own; none by
   * default.
   * @throws {ArgumentException} When the id, the version, the display name or
   * the description is not valid, or a setting belongs to another owner, is of
   * the shell's own kind `KeyBindings`, or is an `Action` whose command the
   * module does not contribute.
   * @example
   * ```ts
   * import { ModuleDeclaration } from "@noldova/teamrun-shell-runtime";
   *
   * export const notes: ModuleDeclaration = new ModuleDeclaration("notes", "0.0.1", "Notes", "Keeps notes.", [], "@noldova/teamrun-modules-notes-runtime", new Map([["methods", ["notes.list"]]]));
   * ```
   */
  public constructor(
    id: string,
    version: string,
    displayName: string,
    description: string,
    dependencies: readonly string[],
    runtimePackage: string | null,
    contributions: ReadonlyMap<string, readonly string[]>,
    settings?: readonly SettingDefinition[]);

  /**
   * Reads a declaration from its form in `declarations.json`.
   *
   * @param value The value read from the file.
   * @returns The declaration.
   * @throws {DeclarationsFormatException} When the value is no object or a
   * field is missing or invalid, including a setting's definition.
   * @example
   * ```ts
   * import { ModuleDeclaration } from "@noldova/teamrun-shell-runtime";
   *
   * export const notes: ModuleDeclaration = ModuleDeclaration.fromJson({ id: "notes", version: "0.0.1", displayName: "Notes", description: "Keeps notes.", dependencies: [], runtimePackage: null, contributes: {} });
   * ```
   */
  public static fromJson(value: unknown): ModuleDeclaration;

  /**
   * Lists the names the module contributes of one kind.
   *
   * @param kind The kind, such as `methods`.
   * @returns The names; empty when it contributes none of the kind.
   * @example
   * ```ts
   * import type { ModuleDeclaration } from "@noldova/teamrun-shell-runtime";
   *
   * export function listMethods(declaration: ModuleDeclaration): readonly string[] {
   *   return declaration.listContributions("methods");
   * }
   * ```
   */
  public listContributions(kind: string): readonly string[];
}

/**
 * How a runtime process runs, read from its entry arguments.
 */
export declare class RuntimeOptions {
  /**
   * The data directory the runtime owns.
   */
  public readonly dataDirectory: DataDirectory;

  /**
   * How long the runtime stays without connections and work before it stops, in milliseconds.
   */
  public readonly idleGraceMilliseconds: number;

  /**
   * The server's limits.
   */
  public readonly serverSettings: ServerSettings;

  /**
   * The build's module declarations, `_build/modules/declarations.json` in the
   * repository the runtime package is installed in, unless given.
   */
  public readonly declarationsFile: string;

  /**
   * The name of the start log in the logs folder that the launcher which started this runtime reads, or `null` when no launcher started it. The runtime keeps that file when it removes start logs left behind.
   */
  public readonly startLogName: string | null;

  /**
   * How long a starting runtime keeps trying to take the data directory over from an owner that publishes no discovery file, because it is starting or stopping, in milliseconds.
   */
  public readonly takeoverMilliseconds: number;

  /**
   * Creates the options.
   *
   * @param dataDirectory The data directory.
   * @param idleGraceMilliseconds The idle grace in milliseconds. Defaults to 30 seconds.
   * @param serverSettings The server's limits. Defaults to {@link ServerSettings}' defaults.
   * @param declarationsFile The build's module declarations. Defaults to the build's file beside the installed runtime.
   * @param startLogName The start log's file name, `start-<UUID>.log`, or `null`. Defaults to `null`.
   * @param takeoverMilliseconds How long to keep trying to take over from an owner without a discovery file, in milliseconds. Defaults to 5 seconds.
   * @throws {ArgumentException} When the start log's name is not of that form.
   * @example
   * ```ts
   * import { DataDirectory, RuntimeOptions, ServerSettings } from "@noldova/teamrun-shell-runtime";
   *
   * export const options = new RuntimeOptions(new DataDirectory("/home/person/.noldova/teamrun"), 60_000, new ServerSettings());
   * ```
   */
  public constructor(dataDirectory: DataDirectory, idleGraceMilliseconds?: number, serverSettings?: ServerSettings, declarationsFile?: string, startLogName?: string | null, takeoverMilliseconds?: number);

  /**
   * Reads the options from entry arguments.
   *
   * @param entryArguments `--data-dir <absolute path>`, and optionally `--idle-grace <milliseconds>` and `--start-log <start log name>`.
   * @returns The options.
   * @throws {ArgumentException} When the data directory is missing or not absolute, or an argument is unknown, lacks its value or is not valid.
   * @example
   * ```ts
   * import { RuntimeOptions } from "@noldova/teamrun-shell-runtime";
   *
   * export const options = RuntimeOptions.parse(["--data-dir", "/home/person/.noldova/teamrun", "--idle-grace", "60000"]);
   * ```
   */
  public static parse(entryArguments: readonly string[]): RuntimeOptions;
}

/**
 * Limits of a {@link RuntimeServer}.
 */
export declare class ServerSettings {
  /**
   * The largest frame the server reads or writes, in characters.
   */
  public readonly maximumFrameLength: number;

  /**
   * How long a connection may wait before its handshake, in milliseconds.
   */
  public readonly handshakeTimeout: number;

  /**
   * A request's time limit when it names none, in milliseconds.
   */
  public readonly defaultRequestTimeout: number;

  /**
   * The longest time limit a request may ask for, in milliseconds.
   */
  public readonly maximumRequestTimeout: number;

  /**
   * Creates the settings.
   *
   * @param maximumFrameLength The largest frame in characters. Defaults to 16 MiB.
   * @param handshakeTimeout Milliseconds before a handshake. Defaults to 5 seconds.
   * @param defaultRequestTimeout The default request limit in milliseconds. Defaults to 10 minutes.
   * @param maximumRequestTimeout The longest request limit in milliseconds. Defaults to 1 hour.
   * @throws {ArgumentOutOfRangeException} When a value is not a positive integer, or the default limit exceeds the longest.
   * @example
   * ```ts
   * import { ServerSettings } from "@noldova/teamrun-shell-runtime";
   *
   * export const settings = new ServerSettings(1024 * 1024, 5_000, 60_000, 600_000);
   * ```
   */
  public constructor(maximumFrameLength?: number, handshakeTimeout?: number, defaultRequestTimeout?: number, maximumRequestTimeout?: number);
}

/**
 * One piece of work in progress that keeps the runtime from idling and that stopping would interrupt. Disposing it ends the work.
 */
export declare class WorkItem implements Disposable {
  /**
   * What the work is, as shown to the person.
   */
  public readonly description: string;

  /**
   * Creates the work item; {@link WorkTracker.begin} creates them.
   *
   * @param description What the work is.
   * @param finish Ends the work.
   * @throws {ArgumentException} When the description is empty or whitespace.
   * @example
   * ```ts
   * import { WorkItem } from "@noldova/teamrun-shell-runtime";
   *
   * export function createItem(running: Set<WorkItem>): WorkItem {
   *   const item = new WorkItem("Indexing the project", t => running.delete(t));
   *   running.add(item);
   *   return item;
   * }
   * ```
   */
  public constructor(description: string, finish: (item: WorkItem) => void);

  /**
   * Aborts when the runtime stops the work.
   */
  public get signal(): AbortSignal;

  /**
   * Asks the work to stop by aborting its signal.
   * @example
   * ```ts
   * import type { WorkTracker } from "@noldova/teamrun-shell-runtime";
   *
   * export function cancelLater(work: WorkTracker): void {
   *   const item = work.begin("Indexing the project");
   *   setTimeout(() => item.cancel(), 1_000);
   * }
   * ```
   */
  public cancel(): void;

  /**
   * Ends the work.
   */
  public [Symbol.dispose](): void;
}

/**
 * A program a module asks the runtime to start. The program's environment
 * holds PATH, TEMP, TMP and TMPDIR, then HOME, LANG and LC_ALL, or on Windows
 * SystemRoot, windir, PATHEXT, ComSpec and USERPROFILE, then the runtime's
 * variables the request inherits, then the request's own variables.
 */
export declare class ProcessRequest {
  /**
   * The program: a name searched for on the PATH, or an absolute path.
   */
  public readonly program: string;

  /**
   * The program's arguments.
   */
  public readonly arguments: readonly string[];

  /**
   * The absolute folder the program runs in.
   */
  public readonly workingFolder: string;

  /**
   * The variables set for the program.
   */
  public readonly environment: Readonly<Record<string, string>>;

  /**
   * The names of the runtime's variables the program inherits.
   */
  public readonly inherit: readonly string[];

  /**
   * Stops the program when it aborts.
   */
  public readonly signal?: AbortSignal;

  /**
   * Creates the request.
   *
   * @param program A name searched for on the PATH, or an absolute path.
   * @param launchArguments The program's arguments.
   * @param workingFolder The absolute folder the program runs in.
   * @param environment The variables set for the program.
   * @param inherit The names of the runtime's variables the program inherits.
   * @param signal Stops the program when it aborts.
   * @throws {ArgumentException} When the program is empty or whitespace, the
   * working folder is not absolute, or a variable's name is empty or holds
   * `=` or a null character.
   * @example
   * ```ts
   * import { ProcessRequest } from "@noldova/teamrun-shell-runtime";
   *
   * export function requestStatus(project: string, signal: AbortSignal): ProcessRequest {
   *   return new ProcessRequest("git", ["status"], project, { GIT_PAGER: "cat" }, ["SSH_AUTH_SOCK"], signal);
   * }
   * ```
   */
  public constructor(
    program: string,
    launchArguments: readonly string[],
    workingFolder: string,
    environment?: Readonly<Record<string, string>>,
    inherit?: readonly string[],
    signal?: AbortSignal);
}

/**
 * How long the runtime waits for its modules' programs to end.
 */
export declare class ProcessSettings {
  /**
   * How long a program asked to stop may take to exit before it is killed.
   */
  public readonly graceMilliseconds: number;

  /**
   * How long the runtime waits for killed programs to end before it reports
   * them.
   */
  public readonly endMilliseconds: number;

  /**
   * How often the runtime records that its programs are still running.
   */
  public readonly seenMilliseconds: number;

  /**
   * Creates the settings.
   *
   * @param graceMilliseconds How long a program asked to stop may take to
   * exit; 3 seconds by default.
   * @param endMilliseconds How long killed programs may take to end; 5
   * seconds by default.
   * @param seenMilliseconds How often the runtime records that its programs
   * are still running; 5 seconds by default.
   * @throws {ArgumentOutOfRangeException} When a time is not a positive
   * integer.
   * @example
   * ```ts
   * import { ProcessSettings } from "@noldova/teamrun-shell-runtime";
   *
   * export function createQuickSettings(): ProcessSettings {
   *   return new ProcessSettings(500, 1_000);
   * }
   * ```
   */
  public constructor(graceMilliseconds?: number, endMilliseconds?: number, seenMilliseconds?: number);
}

/**
 * The product and build this runtime belongs to, as the build wrote them to
 * `_build/product.json` beside the installed runtime: the product's identity,
 * its version and the build's fingerprint. The runtime, the desktop and the
 * command line read it once, at start, instead of having it compiled in.
 */
export declare class ProductInfo {
  /**
   * The product's name, such as the one in messages and window titles.
   */
  public readonly name: string;

  /**
   * The product's slug: its lowercase name for programs, packages and
   * variables.
   */
  public readonly slug: string;

  /**
   * The packaged application's ID.
   */
  public readonly applicationId: string;

  /**
   * The development application's ID, before the checkout's hash is added.
   */
  public readonly developmentApplicationId: string;

  /**
   * The data folder under the home folder, its segments separated by `/`.
   */
  public readonly dataFolder: string;

  /**
   * The per-device folder on Windows, under the local application data
   * folder, its segments separated by `/`.
   */
  public readonly windowsDeviceFolder: string;

  /**
   * The per-device folder on macOS, under `Library/Application Support`, its
   * segments separated by `/`.
   */
  public readonly macosDeviceFolder: string;

  /**
   * The per-device folder on Linux, under the state folder, its segments
   * separated by `/`.
   */
  public readonly linuxDeviceFolder: string;

  /**
   * The environment variable that names another data directory.
   */
  public readonly dataDirectoryVariable: string;

  /**
   * The folder of the product's icons, relative to the repository, its
   * segments separated by `/`.
   */
  public readonly icons: string;

  /**
   * The product version.
   */
  public readonly version: string;

  /**
   * The build's fingerprint: the same inputs give the same fingerprint, and
   * any change gives another.
   */
  public readonly build: string;

  private constructor();

  /**
   * The product file of the installed runtime's build.
   */
  public static get file(): string;

  /**
   * The installed runtime's product, read from {@link ProductInfo.file} on
   * first use and kept.
   *
   * @throws {ProductFileException} When the file cannot be read or a field is
   * missing or blank.
   * @example
   * ```ts
   * import { ProductInfo } from "@noldova/teamrun-shell-runtime";
   *
   * export function describeBuild(): string {
   *   const product = ProductInfo.current;
   *   return `${product.name} ${product.version} (build ${product.build})`;
   * }
   * ```
   */
  public static get current(): ProductInfo;

  /**
   * Reads a product file.
   *
   * @param file The product file.
   * @returns The product it describes.
   * @throws {ProductFileException} When the file cannot be read or a field is
   * missing or blank.
   * @example
   * ```ts
   * import path from "node:path";
   *
   * import { ProductInfo } from "@noldova/teamrun-shell-runtime";
   *
   * export function readVersion(checkout: string): string {
   *   return ProductInfo.read(path.join(checkout, "_build", "product.json")).version;
   * }
   * ```
   */
  public static read(file: string): ProductInfo;
}

/**
 * How a program exited: with an exit code, or ended by a signal.
 */
export declare class ProcessExit {
  /**
   * The exit code, or `null` when a signal ended the program.
   */
  public readonly code: number | null;

  /**
   * The signal that ended the program, or `null` when it exited.
   */
  public readonly signal: NodeJS.Signals | null;

  /**
   * Creates the exit.
   *
   * @param code The exit code, or `null`.
   * @param signal The signal, or `null`.
   * @throws {ArgumentException} When both or neither are `null`.
   * @example
   * ```ts
   * import { ProcessExit } from "@noldova/teamrun-shell-runtime";
   *
   * export function endedBySignal(): ProcessExit {
   *   return new ProcessExit(null, "SIGTERM");
   * }
   * ```
   */
  public constructor(code: number | null, signal: NodeJS.Signals | null);

  /**
   * Whether the program exited with code 0.
   */
  public get isClean(): boolean;
}

/**
 * A program the runtime runs for a module, as the runtime reports it: never
 * with its arguments or environment.
 */
export declare class RunningProgram {
  /**
   * The module the program runs for.
   */
  public readonly moduleId: string;

  /**
   * The program's path.
   */
  public readonly program: string;

  /**
   * The program's process id.
   */
  public readonly processId: number;

  /**
   * When the program started.
   */
  public readonly started: Date;

  /**
   * Whether the program itself has exited cleanly on macOS or Linux while
   * the process group it leads still runs; the process id then names that
   * group.
   */
  public readonly hasExited: boolean;

  /**
   * Creates the report.
   *
   * @param moduleId The module the program runs for.
   * @param program The program's path.
   * @param processId The program's process id.
   * @param started When the program started.
   * @param hasExited Whether the program has exited while its process group
   * still runs; `false` by default.
   * @example
   * ```ts
   * import { RunningProgram } from "@noldova/teamrun-shell-runtime";
   *
   * export function describeGit(): RunningProgram {
   *   return new RunningProgram("git", "/usr/bin/git", 4_210, new Date());
   * }
   * ```
   */
  public constructor(moduleId: string, program: string, processId: number, started: Date, hasExited?: boolean);
}

/**
 * A program the runtime started for a module, with its standard streams.
 */
export declare class OwnedProcess {
  /**
   * The program's process id.
   */
  public readonly processId: number;

  /**
   * The program's path.
   */
  public readonly program: string;

  /**
   * When the program started.
   */
  public readonly started: Date;

  /**
   * Resolves when the program exits.
   */
  public readonly exited: Promise<ProcessExit>;

  /**
   * Creates the process; {@link ProcessSupervisor.startAsync} creates them.
   *
   * @param child The started child process.
   * @param program The program's path.
   * @param started When the program started.
   * @param exited Resolves when the program exits.
   * @param stop Ends the program and what it started.
   * @example
   * ```ts
   * import { once } from "node:events";
   * import { spawn } from "node:child_process";
   *
   * import { OwnedProcess, ProcessExit } from "@noldova/teamrun-shell-runtime";
   *
   * export function own(file: string): OwnedProcess {
   *   const child = spawn(file, [], { stdio: "pipe" });
   *   const exited = once(child, "exit").then(([code, signal]) => new ProcessExit(code, signal));
   *   return new OwnedProcess(child, file, new Date(), exited, async () => void child.kill());
   * }
   * ```
   */
  public constructor(child: ChildProcessWithoutNullStreams, program: string, started: Date, exited: Promise<ProcessExit>, stop: (process: OwnedProcess) => Promise<void>);

  /**
   * The program's standard input.
   */
  public get input(): Writable;

  /**
   * The program's standard output; a program whose output is not read
   * blocks once the pipe is full.
   */
  public get output(): Readable;

  /**
   * The program's standard error; a program whose errors are not read
   * blocks once the pipe is full.
   */
  public get errors(): Readable;

  /**
   * Whether the program has exited.
   */
  public get hasExited(): boolean;

  /**
   * Ends the program and what it started: on Windows it closes the program's
   * input, and elsewhere it sends its process group SIGTERM; whatever still
   * runs after the grace period, 3 seconds in the runtime, is killed. Calling
   * it again returns the same promise.
   *
   * @returns A promise of how the program exited.
   * @example
   * ```ts
   * import type { OwnedProcess, ProcessExit } from "@noldova/teamrun-shell-runtime";
   *
   * export function cancelAsync(process: OwnedProcess): Promise<ProcessExit> {
   *   return process.stopAsync();
   * }
   * ```
   */
  public stopAsync(): Promise<ProcessExit>;
}

/**
 * Compares builds by product version.
 */
export declare class BuildComparer {
  /**
   * Compares one build with another.
   *
   * @param own The build doing the comparing.
   * @param other The other build.
   * @returns How the own build relates to the other.
   * @throws {ArgumentException} When a product version is not of the form major.minor.patch.
   * @example
   * ```ts
   * import type { BuildIdentity } from "@noldova/teamrun-shell-protocol";
   * import { BuildComparer, BuildRelation } from "@noldova/teamrun-shell-runtime";
   *
   * export function isNewer(own: BuildIdentity, other: BuildIdentity): boolean {
   *   return BuildComparer.compare(own, other) === BuildRelation.Newer;
   * }
   * ```
   */
  public static compare(own: BuildIdentity, other: BuildIdentity): BuildRelation;
}

/**
 * A connection to a runtime. A connection to another build's runtime accepts only {@link RuntimeClient.stopAsync}.
 */
export declare class RuntimeClient {
  /**
   * The client's name, which prefixes its request ids.
   */
  public readonly clientName: string;

  private constructor();

  /**
   * The other build's identity and program when the runtime belongs to another build, otherwise `null`.
   */
  public get handover(): RuntimeHandover | null;

  /**
   * Where the data from before the shell is when the runtime refuses until it is moved aside, otherwise `null`.
   */
  public get preShellData(): PreShellData | null;

  /**
   * Whether the connection is open.
   */
  public get isConnected(): boolean;

  /**
   * Connects and performs the handshake.
   *
   * @param endpoint The runtime's endpoint.
   * @param token The capability token from discovery metadata.
   * @param identity The client's build identity.
   * @param clientName The client's name.
   * @param listener Receives events and the disconnection.
   * @param settings The time limits. Defaults to {@link ClientSettings}' defaults.
   * @returns A promise of the connected client; its {@link handover} is set when the runtime belongs to another build, and its {@link preShellData} when the runtime refuses until old data is moved aside.
   * @throws {ArgumentException} Synchronously rejected when the client name is empty or whitespace.
   * @throws {ConnectionException} Rejected when the runtime cannot be reached, closes, refuses the token or does not answer in time.
   * @example
   * ```ts
   * import { Endpoint, type IRuntimeClientListener, RuntimeBuild, RuntimeClient, type RuntimeDiscovery } from "@noldova/teamrun-shell-runtime";
   *
   * export function connectAsync(discovery: RuntimeDiscovery, listener: IRuntimeClientListener): Promise<RuntimeClient> {
   *   return RuntimeClient.connectAsync(Endpoint.parse(discovery.endpoint), discovery.token, RuntimeBuild.identity, "desktop", listener);
   * }
   * ```
   */
  public static connectAsync(
    endpoint: Endpoint,
    token: string,
    identity: BuildIdentity,
    clientName: string,
    listener: IRuntimeClientListener,
    settings?: ClientSettings): Promise<RuntimeClient>;

  /**
   * Sends a request and waits for its response.
   *
   * @param method The method's qualified name.
   * @param payload The request's payload.
   * @param timeoutMilliseconds The request's time limit in milliseconds. Defaults to the settings' call limit.
   * @param signal Aborting it sends a cancellation; the response then reports it.
   * @returns A promise of the response, successful or failed. A request too large for one frame is not sent; it fails with
   * `FrameTooLarge`, as an answer too large for one frame does.
   * @throws {ArgumentOutOfRangeException} Synchronously when the time limit is not a positive integer.
   * @throws {TypeError} Synchronously when the payload cannot be written as JSON, such as one that contains itself.
   * @throws {ConnectionException} Rejected with a `Disconnected` failure when the connection is closed or closes, and with none when the runtime does not answer within the limit and its grace.
   * @example
   * ```ts
   * import { QualifiedName, type Response } from "@noldova/teamrun-shell-protocol";
   * import type { RuntimeClient } from "@noldova/teamrun-shell-runtime";
   *
   * export function openNoteAsync(client: RuntimeClient, path: string, signal: AbortSignal): Promise<Response> {
   *   return client.callAsync(new QualifiedName("notes", "open"), { path }, 30_000, signal);
   * }
   * ```
   */
  public callAsync(method: QualifiedName, payload: JsonValue, timeoutMilliseconds?: number, signal?: AbortSignal): Promise<Response>;

  /**
   * Asks the runtime to stop; the only request another build may send, and one a refused connection may send.
   *
   * @param policy Whether to stop only when no work is in progress, or to stop the work.
   * @returns A promise of the response: success, or a conflict whose details list the work in progress.
   * @throws {ConnectionException} Rejected as for {@link callAsync}.
   * @example
   * ```ts
   * import { StopPolicy } from "@noldova/teamrun-shell-protocol";
   * import type { RuntimeClient } from "@noldova/teamrun-shell-runtime";
   *
   * export async function stopIfIdleAsync(client: RuntimeClient): Promise<boolean> {
   *   return !(await client.stopAsync(StopPolicy.IfIdle)).hasFailed;
   * }
   * ```
   */
  public stopAsync(policy: StopPolicy): Promise<Response>;

  /**
   * Asks a refusing runtime to move the data from before the shell aside; with {@link stopAsync}, the only request a refused connection may send.
   *
   * @returns A promise of the response: success, after which the runtime serves new connections normally, or a failure.
   * @throws {ConnectionException} Rejected as for {@link callAsync}.
   * @example
   * ```ts
   * import type { RuntimeClient } from "@noldova/teamrun-shell-runtime";
   *
   * export async function moveAsideAsync(client: RuntimeClient): Promise<boolean> {
   *   return client.preShellData !== null && !(await client.moveAsideAsync()).hasFailed;
   * }
   * ```
   */
  public moveAsideAsync(): Promise<Response>;

  /**
   * Closes the connection.
   * @example
   * ```ts
   * import type { RuntimeClient } from "@noldova/teamrun-shell-runtime";
   *
   * export function disconnect(client: RuntimeClient): void {
   *   client.close();
   * }
   * ```
   */
  public close(): void;
}

/**
 * Starts a detached process with Node.js's child processes. On Windows the process inherits the starting process's inheritable handles; Node.js keeps its own standard handles out of them, but Electron's main process does not.
 */
export declare class ChildProcessStarter implements IProcessStarter {
  /**
   * Starts a program detached, without standard input or output, appending its standard error to a file.
   *
   * @param executable The program to run.
   * @param launchArguments The program's arguments.
   * @param environment The program's environment.
   * @param errorFile The file the program's standard error is appended to; it is created when missing.
   * @returns A promise of the started process's id.
   * @throws {LaunchException} Rejected when the program cannot be started.
   * @example
   * ```ts
   * import { ChildProcessStarter } from "@noldova/teamrun-shell-runtime";
   *
   * export function startAsync(errorFile: string): Promise<number> {
   *   return new ChildProcessStarter().startAsync(process.execPath, ["--version"], process.env, errorFile);
   * }
   * ```
   */
  public startAsync(executable: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv, errorFile: string): Promise<number>;
}

/**
 * The running runtime's log, `logs/runtime.log`. Every line is stamped with its time and redacted, and the log is a {@link LogFile}: it stays within its size limit by becoming `logs/runtime.previous.log` when it fills. Opening it under ownership keeps the previous run's log as `logs/runtime.previous.log` and removes the start logs that launchers left behind.
 */
export declare class RuntimeLog {
  /**
   * The stream the runtime writes its diagnostics to; each write is one record, stamped and redacted like a line, without its trailing line ending. It writes to the log until the log closes.
   */
  public readonly diagnostics: Writable;

  private constructor();

  /**
   * Opens a new log. The current log becomes the previous one, replacing it; when that fails the open is rejected and the current log keeps what it holds. Start logs other than the runtime's own are removed, and those that cannot be removed are left.
   *
   * @param lock The held ownership of the data directory.
   * @param ownStartLogName The start log of the launcher that started this runtime, which is kept, or `null`.
   * @param now Returns the time to stamp a line with; the current time by default.
   * @param error Receives the report when the log can no longer be written; standard error by default.
   * @returns A promise of the open log.
   * @throws {OwnershipReleasedException} Rejected when the ownership was released.
   * @example
   * ```ts
   * import { type OwnershipLock, RuntimeLog } from "@noldova/teamrun-shell-runtime";
   *
   * export async function noteAsync(lock: OwnershipLock): Promise<void> {
   *   const log = await RuntimeLog.openAsync(lock, null);
   *   log.writeLine("The runtime started.");
   *   await log.closeAsync();
   * }
   * ```
   */
  public static openAsync(lock: OwnershipLock, ownStartLogName: string | null, now?: () => Date, error?: Writable): Promise<RuntimeLog>;

  /**
   * Writes one line at once, as when the process is about to end; nothing is written after the log closes. When a line cannot be written, the failure is reported once on the error stream and nothing more is written to the log.
   *
   * @param text The line, without its line ending.
   * @example
   * ```ts
   * import type { RuntimeLog } from "@noldova/teamrun-shell-runtime";
   *
   * export function note(log: RuntimeLog, failure: Error): void {
   *   log.writeLine(String(failure.stack));
   * }
   * ```
   */
  public writeLine(text: string): void;

  /**
   * Finishes the diagnostics stream and closes the log; closing again does nothing.
   *
   * @returns A promise that settles once the log is closed.
   * @example
   * ```ts
   * import type { RuntimeLog } from "@noldova/teamrun-shell-runtime";
   *
   * export async function finishAsync(log: RuntimeLog): Promise<void> {
   *   await log.closeAsync();
   * }
   * ```
   */
  public closeAsync(): Promise<void>;
}

/**
 * Starts or attaches to the runtime of a data directory, taking over from an older build and handing over to a newer one.
 */
export declare class RuntimeLauncher {
  /**
   * Creates the launcher.
   *
   * @param settings How to start and attach.
   * @param identity The client's build identity.
   * @param starter Starts the runtime's process. Defaults to {@link ChildProcessStarter}; the desktop passes one that keeps its own handles out of the runtime on Windows.
   * @example
   * ```ts
   * import { type IRuntimeClientListener, type LaunchSettings, RuntimeBuild, type RuntimeClient, RuntimeLauncher } from "@noldova/teamrun-shell-runtime";
   *
   * export function attachAsync(settings: LaunchSettings, listener: IRuntimeClientListener): Promise<RuntimeClient> {
   *   return new RuntimeLauncher(settings, RuntimeBuild.identity).attachAsync("desktop", listener);
   * }
   * ```
   */
  public constructor(settings: LaunchSettings, identity: BuildIdentity, starter?: IProcessStarter);

  /**
   * Returns a connection to the data directory's runtime of this build, starting one when none runs. An older build's runtime is asked to stop and replaced.
   *
   * @param clientName The client's name.
   * @param listener Receives events and the disconnection.
   * @param policy What to do when an older runtime has work in progress. Defaults to {@link StopPolicy.IfIdle}.
   * @param options Whether to start a runtime when none runs and whether to take over an older build's runtime. Both default to yes.
   * @returns A promise of the connected client.
   * @throws {NoRuntimeException} Rejected when no runtime runs and the options say not to start one.
   * @throws {BuildMismatchException} Rejected when an older build's runtime, or another build of the same version, owns the directory and the options say not to take it over.
   * @throws {RuntimeHandoverException} Rejected when a newer build's runtime owns the directory.
   * @throws {PreShellDataFoundException} Rejected when the runtime refuses until data from before the shell is moved aside.
   * @throws {WorkInProgressException} Rejected when an older runtime has work in progress and the policy is to stop only if idle.
   * @throws {LaunchException} Rejected when the runtime cannot start, exits before it is reachable, does not start in time, holds the directory without becoming reachable within the launch limit, or an older runtime refuses to stop or does not stop in time.
   * @throws {ConnectionException} Rejected when the runtime refuses the connection.
   * @example
   * ```ts
   * import { type IRuntimeClientListener, type LaunchSettings, RuntimeBuild, type RuntimeClient, RuntimeLauncher } from "@noldova/teamrun-shell-runtime";
   *
   * export function attachAsync(settings: LaunchSettings, listener: IRuntimeClientListener): Promise<RuntimeClient> {
   *   return new RuntimeLauncher(settings, RuntimeBuild.identity).attachAsync("desktop", listener);
   * }
   * ```
   */
  public attachAsync(clientName: string, listener: IRuntimeClientListener, policy?: StopPolicy, options?: AttachOptions): Promise<RuntimeClient>;

  /**
   * Like {@link attachAsync}, but first moves data from before the shell aside when the runtime refuses because of it. Call it after the person agreed to the move.
   *
   * @param clientName The client's name.
   * @param listener Receives events and the disconnection.
   * @param policy What to do when an older runtime has work in progress. Defaults to {@link StopPolicy.IfIdle}.
   * @returns A promise of the connected client, once the data is moved aside.
   * @throws {LaunchException} Rejected when the runtime fails to move the data, or as for {@link attachAsync}.
   * @throws {RuntimeHandoverException} Rejected as for {@link attachAsync}.
   * @throws {WorkInProgressException} Rejected as for {@link attachAsync}.
   * @example
   * ```ts
   * import { type IRuntimeClientListener, PreShellDataFoundException, type RuntimeClient, type RuntimeLauncher } from "@noldova/teamrun-shell-runtime";
   *
   * export async function attachAsync(
   *   launcher: RuntimeLauncher,
   *   listener: IRuntimeClientListener,
   *   confirmAsync: (location: string) => Promise<boolean>): Promise<RuntimeClient> {
   *   try {
   *     return await launcher.attachAsync("desktop", listener);
   *   }
   *   catch (error) {
   *     if (!(error instanceof PreShellDataFoundException) || !await confirmAsync(error.data.location))
   *       throw error;
   *     return launcher.moveAsideAsync("desktop", listener);
   *   }
   * }
   * ```
   */
  public moveAsideAsync(clientName: string, listener: IRuntimeClientListener, policy?: StopPolicy): Promise<RuntimeClient>;
}

/**
 * The runtime's endpoint server: handshake, requests routed through a method registry, events, deadlines, cancellation and frame limits.
 */
export declare class RuntimeServer implements IEventSink {
  /**
   * Creates the server.
   *
   * @param identity The runtime's build identity.
   * @param token The capability token clients must present.
   * @param handover What another build's client receives in its handshake answer.
   * @param methods The registry requests are routed through.
   * @param settings The server's limits.
   * @param changed Called whenever a connection opens or closes.
   * @param diagnostics Receives a line for each event the server could not send.
   * @example
   * ```ts
   * import { RuntimeHandover } from "@noldova/teamrun-shell-protocol";
   * import { CapabilityToken, type MethodRegistry, RuntimeBuild, RuntimeServer, ServerSettings } from "@noldova/teamrun-shell-runtime";
   *
   * export function createServer(methods: MethodRegistry, changed: () => void): RuntimeServer {
   *   const identity = RuntimeBuild.identity;
   *   return new RuntimeServer(identity, CapabilityToken.generate(), new RuntimeHandover(identity, process.execPath), methods, new ServerSettings(), changed, process.stderr);
   * }
   * ```
   */
  public constructor(
    identity: BuildIdentity,
    token: CapabilityToken,
    handover: RuntimeHandover,
    methods: MethodRegistry,
    settings: ServerSettings,
    changed: () => void,
    diagnostics: Writable);

  /**
   * The number of open connections, authenticated or not.
   */
  public get sessionCount(): number;

  /**
   * Listens on a loopback port the system assigns.
   *
   * @returns A promise of the endpoint.
   * @throws {ConnectionException} Rejected when the server has no address.
   * @example
   * ```ts
   * import type { Endpoint, RuntimeServer } from "@noldova/teamrun-shell-runtime";
   *
   * export function listenAsync(server: RuntimeServer): Promise<Endpoint> {
   *   return server.listenTcpAsync();
   * }
   * ```
   */
  public listenTcpAsync(): Promise<Endpoint>;

  /**
   * Listens on a Unix socket, replacing a stale socket file.
   *
   * @param socketPath The socket's absolute path, at most 103 bytes.
   * @returns A promise of the endpoint.
   * @throws {ArgumentException} Rejected when the path is not absolute or too long.
   * @example
   * ```ts
   * import path from "node:path";
   *
   * import type { DataDirectory, Endpoint, RuntimeServer } from "@noldova/teamrun-shell-runtime";
   *
   * export function listenAsync(server: RuntimeServer, directory: DataDirectory): Promise<Endpoint> {
   *   return server.listenSocketAsync(path.join(directory.discoveryFolder, "runtime.sock"));
   * }
   * ```
   */
  public listenSocketAsync(socketPath: string): Promise<Endpoint>;

  /**
   * Starts refusing: every later handshake is answered with the refusal's failure, and the connection may call only the refusal's method and `shell.stop`.
   *
   * @param refusal The failure and the method allowed.
   * @example
   * ```ts
   * import { Failure, FailureCode, PreShellData, ShellMethods } from "@noldova/teamrun-shell-protocol";
   * import { Refusal, type RuntimeServer } from "@noldova/teamrun-shell-runtime";
   *
   * export function refuseUntilMoved(server: RuntimeServer, root: string): void {
   *   const failure = new Failure(FailureCode.PreShellData, "Move the old data aside.", new PreShellData(root).toJson());
   *   server.refuse(new Refusal(failure, ShellMethods.moveAside));
   * }
   * ```
   */
  public refuse(refusal: Refusal): void;

  /**
   * Stops refusing and ends the refused connections, which reconnect. Requests a refused connection sent before it ended stay refused.
   * @example
   * ```ts
   * import type { RuntimeServer } from "@noldova/teamrun-shell-runtime";
   *
   * export function finishMoving(server: RuntimeServer): void {
   *   server.admit();
   * }
   * ```
   */
  public admit(): void;

  /**
   * Sends an event to every authenticated connection of the runtime's build. An event too large for one frame, or one
   * that cannot be written as JSON, reaches no connection; the server writes a line to its diagnostics instead.
   *
   * @param event The event.
   * @example
   * ```ts
   * import { Event, QualifiedName } from "@noldova/teamrun-shell-protocol";
   * import type { RuntimeServer } from "@noldova/teamrun-shell-runtime";
   *
   * export function announce(server: RuntimeServer, path: string): void {
   *   server.broadcast(new Event(new QualifiedName("notes", "changed"), { path }));
   * }
   * ```
   */
  public broadcast(event: Event): void;

  /**
   * Stops accepting connections, ends the open ones and removes the socket file.
   *
   * @returns A promise that settles once the server has closed.
   * @example
   * ```ts
   * import type { RuntimeServer } from "@noldova/teamrun-shell-runtime";
   *
   * export async function shutDownAsync(server: RuntimeServer): Promise<void> {
   *   await server.closeAsync();
   * }
   * ```
   */
  public closeAsync(): Promise<void>;
}

/**
 * Something that delivers events to connected clients.
 */
export interface IEventSink {
  /**
   * Delivers an event.
   *
   * @param event The event.
   * @example
   * ```ts
   * import { Event, QualifiedName } from "@noldova/teamrun-shell-protocol";
   * import type { IEventSink } from "@noldova/teamrun-shell-runtime";
   *
   * export function announce(sink: IEventSink, path: string): void {
   *   sink.broadcast(new Event(new QualifiedName("notes", "changed"), { path }));
   * }
   * ```
   */
  broadcast(event: Event): void;
}

/**
 * Ends the AppImage copies that runtimes started by launchers left behind on Linux, as their copy records in the logs folder name them.
 */
export declare class AppImageCopyCleanup {
  /**
   * Reads each copy record, `logs/copy-<id>.log`. When the Bash that held its copies no longer runs, a recorded mount ends if the recorded process is still the mount of the recorded AppImage, a recorded extraction is removed if its folder is a `teamrun-runtime-` folder directly in the temporary folder, and the record is removed. Records of a Bash that still runs are left. A record whose file, Bash command line, process or folder cannot be read, ended or removed is left too, and the reason is written to the diagnostics; a process without a command line no longer runs. The logs folder is created when it is missing.
   *
   * @param directory The data directory, whose ownership the runtime holds.
   * @param diagnostics Where a record that is left after a failure is written, with the reason.
   * @returns A promise that resolves once the leftover copies are ended.
   * @throws {Error} Rejected when the logs folder cannot be created or listed.
   * @example
   * ```ts
   * import { AppImageCopyCleanup, type OwnershipLock } from "@noldova/teamrun-shell-runtime";
   *
   * export function cleanAsync(lock: OwnershipLock): Promise<void> {
   *   return AppImageCopyCleanup.removeAsync(lock.dataDirectory, process.stderr);
   * }
   * ```
   */
  public static removeAsync(directory: DataDirectory, diagnostics: Writable): Promise<void>;
}

/**
 * Calls its participant once it has stayed idle for a whole grace period.
 */
export declare class IdleMonitor implements Disposable {
  /**
   * Creates the monitor, unarmed.
   *
   * @param graceMilliseconds The grace period in milliseconds.
   * @param participant The participant to watch.
   * @throws {ArgumentOutOfRangeException} When the grace is not a positive integer.
   * @example
   * ```ts
   * import { type IIdleParticipant, IdleMonitor } from "@noldova/teamrun-shell-runtime";
   *
   * export function watch(participant: IIdleParticipant): IdleMonitor {
   *   const monitor = new IdleMonitor(30_000, participant);
   *   monitor.check();
   *   return monitor;
   * }
   * ```
   */
  public constructor(graceMilliseconds: number, participant: IIdleParticipant);

  /**
   * Whether a grace period is running.
   */
  public get isArmed(): boolean;

  /**
   * Starts the grace period when the participant is idle and none runs, or cancels it when the participant is busy.
   * @example
   * ```ts
   * import { type IIdleParticipant, IdleMonitor } from "@noldova/teamrun-shell-runtime";
   *
   * export function watch(participant: IIdleParticipant): IdleMonitor {
   *   const monitor = new IdleMonitor(30_000, participant);
   *   monitor.check();
   *   return monitor;
   * }
   * ```
   */
  public check(): void;

  /**
   * Cancels a running grace period and stops watching; later checks do nothing.
   */
  public [Symbol.dispose](): void;
}

/**
 * The runtime of one data directory: ownership, the shell's database, the endpoint, discovery, registries, work and idle shutdown.
 */
export declare class RuntimeHost implements IIdleParticipant {
  /**
   * The runtime's build identity.
   */
  public readonly identity: BuildIdentity;

  /**
   * The work in progress.
   */
  public readonly work: WorkTracker;

  /**
   * The registry requests are routed through; `shell.stop` is registered, and `shell.moveAside` when the runtime started refusing.
   */
  public readonly methods: MethodRegistry;

  /**
   * The commands the modules' runtime parts registered, which `shell.commands`
   * lists and `shell.runCommand` runs.
   */
  public readonly commands: CommandRegistry;

  /**
   * The runtime's notifications, which `shell.notifications` lists and its event follows.
   */
  public readonly notifications: NotificationCenter;

  /**
   * The registry of events published to clients.
   */
  public readonly events: EventRegistry;

  /**
   * The build's modules: activated before discovery is published, or after
   * data from before the shell is moved aside; `shell.modules` reports where
   * they stand, and they are deactivated when the runtime stops.
   */
  public readonly modules: ModuleHost;

  /**
   * The runtime's log, opened under ownership; its {@link RuntimeLog.diagnostics} stream receives the runtime's diagnostics, such as module failures.
   */
  public readonly log: RuntimeLog;

  private constructor();

  /**
   * Whether the runtime has no connection and no work in progress.
   */
  public get isIdle(): boolean;

  /**
   * The programs the runtime runs for its modules, in the order they started;
   * empty until the modules are activated.
   */
  public get programs(): readonly RunningProgram[];

  /**
   * Takes ownership, opens the shell's database, ends the programs an earlier runtime left running, listens and publishes discovery. When the directory holds data from before the shell, the runtime refuses instead: every handshake is answered with a {@link FailureCode.PreShellData} failure whose details give the location, and only `shell.moveAside` and `shell.stop` are served until it has moved the data aside and opened the database. Concurrent `shell.moveAside` requests share one move, and a request after the move succeeds without moving anything.
   *
   * @param options How the runtime runs.
   * @param platform The platform, as in `process.platform`; Windows listens on loopback TCP, others on a socket in the discovery folder.
   * @param environment The environment the discovery folder's protection uses.
   * @returns A promise of the running host.
   * @throws {DeclarationsFormatException} Rejected, before taking ownership, when the build's module declarations cannot be read.
   * @throws {DataDirectoryOwnedException} Rejected when another runtime owns the directory and has published its discovery file, or still owns it once the options' takeover time has passed.
   * @example
   * ```ts
   * import { RuntimeHost, RuntimeOptions } from "@noldova/teamrun-shell-runtime";
   *
   * export async function runAsync(entryArguments: readonly string[]): Promise<string> {
   *   const host = await RuntimeHost.startAsync(RuntimeOptions.parse(entryArguments), process.platform, process.env);
   *   return host.waitForStopAsync();
   * }
   * ```
   */
  public static startAsync(options: RuntimeOptions, platform: string, environment: NodeJS.ProcessEnv): Promise<RuntimeHost>;

  /**
   * Stops the runtime because it stayed idle.
   * @example
   * ```ts
   * import type { RuntimeHost } from "@noldova/teamrun-shell-runtime";
   *
   * export function stopAsIfIdle(host: RuntimeHost): void {
   *   host.handleIdle();
   * }
   * ```
   */
  public handleIdle(): void;

  /**
   * Stops the runtime: cancels work, ends connections, withdraws discovery, closes the database and releases ownership. Later calls do nothing.
   *
   * @param reason Why the runtime stops; {@link waitForStopAsync} resolves with it.
   * @example
   * ```ts
   * import type { RuntimeHost } from "@noldova/teamrun-shell-runtime";
   *
   * export function stopForUpdate(host: RuntimeHost): void {
   *   host.requestStop("update");
   * }
   * ```
   */
  public requestStop(reason: string): void;

  /**
   * Waits until the runtime has stopped.
   *
   * @returns A promise of the stop's reason, rejected with the error when stopping failed.
   * @example
   * ```ts
   * import { RuntimeHost, RuntimeOptions } from "@noldova/teamrun-shell-runtime";
   *
   * export async function runAsync(entryArguments: readonly string[]): Promise<string> {
   *   const host = await RuntimeHost.startAsync(RuntimeOptions.parse(entryArguments), process.platform, process.env);
   *   return host.waitForStopAsync();
   * }
   * ```
   */
  public waitForStopAsync(): Promise<string>;
}

/**
 * What one module's runtime part may register and use; disposing it withdraws
 * everything registered through it, newest first.
 */
export declare class ModuleContext implements IRuntimePartContext, Disposable {
  /**
   * The module's folder in the data directory.
   */
  public readonly moduleFolder: string;

  /**
   * Creates the context.
   *
   * @param declaration The module's declaration.
   * @param dataDirectory The data directory.
   * @param methods The registry its methods join.
   * @param events The registry its events join.
   * @param commands The registry its commands join.
   * @param notifications The runtime's notifications, which its posts join.
   * @param notificationPolicy The rules its posts follow.
   * @param services The registry its services join.
   * @param settings The shell's settings, which the module reads and writes
   * within its rights.
   * @param work The runtime's work in progress, which the module's work joins.
   * @param processes The runtime's programs, which the module's programs join.
   * @param diagnostics The runtime's log, which the module's lines join.
   * @param redactor Removes the home folder and opaque values from the module's lines.
   * @param database The module's open database, when its runtime part declares migrations.
   * @example
   * ```ts
   * import { randomUUID } from "node:crypto";
   * import { homedir } from "node:os";
   *
   * import {
   *   CommandRegistry, DataDirectory, DiagnosticRedactor, EventRegistry, MethodRegistry, ModuleContext, ModuleDeclaration, NotificationCenter, NotificationPolicy,
   *   type ProcessSupervisor, ServiceRegistry, type SettingsService, WorkTracker
   * } from "@noldova/teamrun-shell-runtime";
   *
   * export function createContext(events: EventRegistry, settings: SettingsService, processes: ProcessSupervisor): ModuleContext {
   *   const notes = new ModuleDeclaration("notes", "0.0.1", "Notes", "Keeps notes.", [], null, new Map());
   *   return new ModuleContext(
   *     notes, new DataDirectory("/home/person/.noldova/teamrun"), new MethodRegistry(), events, new CommandRegistry(),
   *     new NotificationCenter(() => undefined, () => new Date(), randomUUID), new NotificationPolicy([notes], () => true), new ServiceRegistry(), settings,
   *     new WorkTracker(() => undefined), processes, process.stderr, new DiagnosticRedactor(homedir()));
   * }
   * ```
   */
  public constructor(
    declaration: ModuleDeclaration,
    dataDirectory: DataDirectory,
    methods: MethodRegistry,
    events: EventRegistry,
    commands: CommandRegistry,
    notifications: NotificationCenter,
    notificationPolicy: NotificationPolicy,
    services: ServiceRegistry,
    settings: SettingsService,
    work: WorkTracker,
    processes: ProcessSupervisor,
    diagnostics: Writable,
    redactor: DiagnosticRedactor,
    database?: IModuleDatabase);

  /**
   * The module's id.
   */
  public get moduleId(): string;

  /**
   * The module's own database.
   *
   * @throws {ModuleDatabaseException} When the module's runtime part declares no migrations.
   */
  public get database(): IModuleDatabase;

  /**
   * The module's access to settings.
   */
  public readonly settings: IModuleSettings;

  /**
   * The module's lines in the runtime's log.
   */
  public readonly log: IModuleLog;

  /**
   * See {@link IRuntimePartContext.getWorkFolderAsync}.
   *
   * @returns A promise of the module's folder in `work`, created when it is first asked for.
   * @example
   * ```ts
   * import type { ModuleContext } from "@noldova/teamrun-shell-runtime";
   *
   * export function prepareAsync(context: ModuleContext): Promise<string> {
   *   return context.getWorkFolderAsync();
   * }
   * ```
   */
  public getWorkFolderAsync(): Promise<string>;

  /**
   * See {@link IRuntimePartContext.beginWork}.
   *
   * @param description What the work is, as the person reads it.
   * @returns The work item.
   * @throws {ArgumentException} When the description is empty or whitespace.
   * @example
   * ```ts
   * import type { ModuleContext, WorkItem } from "@noldova/teamrun-shell-runtime";
   *
   * export function beginIndexing(context: ModuleContext): WorkItem {
   *   return context.beginWork("Indexing the project");
   * }
   * ```
   */
  public beginWork(description: string): WorkItem;

  /**
   * See {@link IRuntimePartContext.startProcessAsync}.
   *
   * @param request The program to start.
   * @returns A promise of the running program.
   * @throws {ProcessStartException} Rejected when the program cannot start.
   * @example
   * ```ts
   * import { type ModuleContext, type OwnedProcess, ProcessRequest } from "@noldova/teamrun-shell-runtime";
   *
   * export function startStatusAsync(context: ModuleContext, project: string): Promise<OwnedProcess> {
   *   return context.startProcessAsync(new ProcessRequest("git", ["status"], project));
   * }
   * ```
   */
  public startProcessAsync(request: ProcessRequest): Promise<OwnedProcess>;

  /**
   * See {@link IRuntimePartContext.registerMethod}.
   *
   * @param name The method's name.
   * @param handler Its handler.
   * @throws {RegistrationException} When the declaration does not contribute
   * the method or it is already registered.
   * @example
   * ```ts
   * import type { ModuleContext } from "@noldova/teamrun-shell-runtime";
   *
   * export function serve(context: ModuleContext): void {
   *   context.registerMethod("notes.list", { handleAsync: async () => [] });
   * }
   * ```
   */
  public registerMethod(name: string, handler: IMethodHandler): void;

  /**
   * See {@link IRuntimePartContext.declareEvent}.
   *
   * @param name The event's name.
   * @returns The event's channel.
   * @throws {RegistrationException} When the declaration does not contribute
   * the event or it is already declared.
   * @example
   * ```ts
   * import type { EventChannel, ModuleContext } from "@noldova/teamrun-shell-runtime";
   *
   * export function announce(context: ModuleContext): EventChannel {
   *   return context.declareEvent("notes.changed");
   * }
   * ```
   */
  public declareEvent(name: string): EventChannel;

  /**
   * See {@link IRuntimePartContext.registerCommand}.
   *
   * @param command The command.
   * @throws {RegistrationException} When the declaration does not contribute
   * the command or it is already registered.
   * @example
   * ```ts
   * import { type ModuleContext, RuntimeCommand } from "@noldova/teamrun-shell-runtime";
   *
   * export function serveTick(context: ModuleContext): void {
   *   context.registerCommand(new RuntimeCommand("clock.tick", "Tick", null, null, { handleAsync: async () => null }));
   * }
   * ```
   */
  public registerCommand(command: RuntimeCommand): void;

  /**
   * See {@link IRuntimePartContext.postNotification}.
   *
   * @param post What to show.
   * @returns The notification's handle.
   * @throws {RegistrationException} When the declaration does not contribute the kind, or a command belongs to another
   * module that is not a dependency.
   * @example
   * ```ts
   * import type { ModuleContext, NotificationHandle } from "@noldova/teamrun-shell-runtime";
   * import { NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/teamrun-shell-protocol";
   *
   * export function announce(context: ModuleContext): NotificationHandle {
   *   return context.postNotification(new NotificationPost(QualifiedName.parse("notes.saved"), null, "Saved", null, NotificationSeverity.Success, null, [], null));
   * }
   * ```
   */
  public postNotification(post: NotificationPost): NotificationHandle;

  /**
   * See {@link IRuntimePartContext.publishService}.
   *
   * @param name The service's name under the module's own id.
   * @param service The service.
   * @throws {RegistrationException} When the name has another owner or is
   * already published.
   * @example
   * ```ts
   * import type { ModuleContext } from "@noldova/teamrun-shell-runtime";
   *
   * export function publish(context: ModuleContext): void {
   *   context.publishService("notes.store", new Map<string, string>());
   * }
   * ```
   */
  public publishService(name: string, service: object): void;

  /**
   * See {@link IRuntimePartContext.getService}.
   *
   * @param name The service's name.
   * @param type The class the service is an instance of.
   * @returns The service.
   * @throws {ServiceAccessException} When the module may not use the service,
   * it is not published, or it is not an instance of the type.
   * @example
   * ```ts
   * import type { ModuleContext } from "@noldova/teamrun-shell-runtime";
   *
   * export function countTasks(context: ModuleContext): number {
   *   return context.getService("tasks.store", Map).size;
   * }
   * ```
   */
  public getService<T extends object>(name: string, type: abstract new (...args: never[]) => T): T;

  /**
   * Withdraws everything registered through the context, newest first,
   * dismisses the module's notifications, and aborts and ends its work.
   *
   * @example
   * ```ts
   * import type { ModuleContext } from "@noldova/teamrun-shell-runtime";
   *
   * export function withdraw(context: ModuleContext): void {
   *   context[Symbol.dispose]();
   * }
   * ```
   */
  public [Symbol.dispose](): void;
}

/**
 * Reads the build's module declarations.
 */
export declare class ModuleDeclarationReader {
  /**
   * Reads the declarations file.
   *
   * @param file The file, as the build writes it.
   * @returns A promise of the declarations, in the build's order.
   * @throws {DeclarationsFormatException} Rejected when the file cannot be read,
   * is not JSON, has another format version or holds an invalid declaration;
   * the message names the file.
   * @example
   * ```ts
   * import { ModuleDeclarationReader, type ModuleDeclaration } from "@noldova/teamrun-shell-runtime";
   *
   * export function readAsync(file: string): Promise<readonly ModuleDeclaration[]> {
   *   return ModuleDeclarationReader.readAsync(file);
   * }
   * ```
   */
  public static readAsync(file: string): Promise<readonly ModuleDeclaration[]>;
}

/**
 * The shell's settings: the definitions the shell and the modules declare,
 * and their values in the shell's database, per scope object and, for a
 * device setting, per device. A stored value that no longer fits its
 * definition is kept, ignored and reported once to the diagnostics.
 */
export declare class SettingsService {
  /**
   * Creates the service over an open shell database.
   *
   * @param database The shell's database, migrated with the shell's
   * migrations.
   * @param definitions Every setting's definition.
   * @param diagnostics Where an ignored stored value is reported.
   * @example
   * ```ts
   * import type { ShellDatabase } from "@noldova/teamrun-shell-runtime";
   * import { SettingsService } from "@noldova/teamrun-shell-runtime";
   *
   * export function createSettings(database: ShellDatabase): SettingsService {
   *   return new SettingsService(database, [], process.stderr);
   * }
   * ```
   */
  public constructor(database: ShellDatabase, definitions: readonly SettingDefinition[], diagnostics: Writable);

  /**
   * Finds a setting's definition.
   *
   * @param name The setting's name.
   * @returns The definition.
   * @throws {SettingException} When no such setting is declared.
   * @example
   * ```ts
   * import { QualifiedName, type SettingDefinition } from "@noldova/teamrun-shell-protocol";
   * import type { SettingsService } from "@noldova/teamrun-shell-runtime";
   *
   * export function defineMode(settings: SettingsService): SettingDefinition {
   *   return settings.define(QualifiedName.parse("shell.mode"));
   * }
   * ```
   */
  public define(name: QualifiedName): SettingDefinition;

  /**
   * Reads the value in effect for a key: the value set for its scope
   * object, else each enclosing scope's, else the application's, else the
   * default. A device setting reads the key's device, and its default when
   * the key names none.
   *
   * @param key Which value.
   * @returns The value in effect.
   * @throws {SettingException} When no such setting is declared, or the
   * setting does not list the key's scope.
   * @example
   * ```ts
   * import type { JsonValue } from "@noldova/teamrun-foundation-json";
   * import { QualifiedName, SettingKey } from "@noldova/teamrun-shell-protocol";
   * import type { SettingsService } from "@noldova/teamrun-shell-runtime";
   *
   * export function readMode(settings: SettingsService): JsonValue {
   *   return settings.read(new SettingKey(QualifiedName.parse("shell.mode")));
   * }
   * ```
   */
  public read(key: SettingKey): JsonValue;

  /**
   * Reads the value in effect for a key as `read` does, and whether a value
   * is stored for the key itself. It validates the key as `write` does: a
   * device setting needs the key's device.
   *
   * @param key Which value.
   * @returns The setting's name, the value in effect and whether a value is
   * stored for the key, `false` when the value comes from an enclosing
   * scope, the application or the default.
   * @throws {SettingException} When no such setting is declared, the
   * setting does not list the key's scope, or a device setting's key names
   * no device.
   * @example
   * ```ts
   * import { QualifiedName, type SettingEntry, SettingKey, SettingScope } from "@noldova/teamrun-shell-protocol";
   * import type { SettingsService } from "@noldova/teamrun-shell-runtime";
   *
   * export function readMute(settings: SettingsService): SettingEntry {
   *   return settings.readEntry(new SettingKey(QualifiedName.parse("chat.muted"), new SettingScope(QualifiedName.parse("chat.conversation"), "c42")));
   * }
   * ```
   */
  public readEntry(key: SettingKey): SettingEntry;

  /**
   * Reads a device setting's application values on every device that set
   * one; a device without one is at the default.
   *
   * @param name The setting's name.
   * @returns The values by device.
   * @throws {SettingException} When no such setting is declared.
   * @example
   * ```ts
   * import type { JsonValue } from "@noldova/teamrun-foundation-json";
   * import { QualifiedName } from "@noldova/teamrun-shell-protocol";
   * import type { SettingsService } from "@noldova/teamrun-shell-runtime";
   *
   * export function readQuiet(settings: SettingsService): ReadonlyMap<string, JsonValue> {
   *   return settings.readDevices(QualifiedName.parse("shell.doNotDisturb"));
   * }
   * ```
   */
  public readDevices(name: QualifiedName): ReadonlyMap<string, JsonValue>;

  /**
   * Describes every setting and its value for the application on a device.
   *
   * @param device The device whose device settings it gives, or `null` for
   * their defaults.
   * @returns The snapshot.
   * @example
   * ```ts
   * import type { SettingsSnapshot } from "@noldova/teamrun-shell-protocol";
   * import type { SettingsService } from "@noldova/teamrun-shell-runtime";
   *
   * export function describe(settings: SettingsService): SettingsSnapshot {
   *   return settings.snapshot(null);
   * }
   * ```
   */
  public snapshot(device: string | null): SettingsSnapshot;

  /**
   * Sets a value and tells the listeners. A shared setting ignores the
   * key's device.
   *
   * @param write The key and the value.
   * @throws {SettingException} When the setting is unknown, does not accept
   * the value or the scope, or is a device setting given no device or a
   * scope.
   * @example
   * ```ts
   * import { QualifiedName, SettingKey, SettingValue } from "@noldova/teamrun-shell-protocol";
   * import type { SettingsService } from "@noldova/teamrun-shell-runtime";
   *
   * export function darken(settings: SettingsService): void {
   *   settings.write(new SettingValue(new SettingKey(QualifiedName.parse("shell.mode")), "Dark"));
   * }
   * ```
   */
  public write(write: SettingValue): void;

  /**
   * Removes a value, so the enclosing value or the default takes effect,
   * and tells the listeners the value now in effect.
   *
   * @param key Which value.
   * @throws {SettingException} As `write` does.
   * @example
   * ```ts
   * import { QualifiedName, SettingKey } from "@noldova/teamrun-shell-protocol";
   * import type { SettingsService } from "@noldova/teamrun-shell-runtime";
   *
   * export function restore(settings: SettingsService): void {
   *   settings.reset(new SettingKey(QualifiedName.parse("shell.mode")));
   * }
   * ```
   */
  public reset(key: SettingKey): void;

  /**
   * Records which scope object encloses another, or that none does.
   *
   * @param scope The enclosed object.
   * @param parent The enclosing object, or `null` for the application.
   * @example
   * ```ts
   * import { QualifiedName, SettingScope } from "@noldova/teamrun-shell-protocol";
   * import type { SettingsService } from "@noldova/teamrun-shell-runtime";
   *
   * export function release(settings: SettingsService): void {
   *   settings.setScopeParent(new SettingScope(QualifiedName.parse("chat.conversation"), "c42"), null);
   * }
   * ```
   */
  public setScopeParent(scope: SettingScope, parent: SettingScope | null): void;

  /**
   * Removes a scope object's values and its enclosure, in one transaction.
   *
   * @param scope The object.
   * @example
   * ```ts
   * import { QualifiedName, SettingScope } from "@noldova/teamrun-shell-protocol";
   * import type { SettingsService } from "@noldova/teamrun-shell-runtime";
   *
   * export function forget(settings: SettingsService): void {
   *   settings.removeScope(new SettingScope(QualifiedName.parse("chat.conversation"), "c42"));
   * }
   * ```
   */
  public removeScope(scope: SettingScope): void;

  /**
   * Follows every change: each value set or reset, with the value then in
   * effect for its key, after the change commits.
   *
   * @param listener Called for each change.
   * @returns What stops the listener when disposed.
   * @example
   * ```ts
   * import type { SettingsService } from "@noldova/teamrun-shell-runtime";
   *
   * export function watch(settings: SettingsService, report: (name: string) => void): Disposable {
   *   return settings.onChanged(t => report(t.key.name.text));
   * }
   * ```
   */
  public onChanged(listener: (change: SettingChange) => void): Disposable;
}

/**
 * Runs the build's modules in the runtime: it activates them after their
 * dependencies, records where each stands and deactivates them in reverse.
 */
export declare class ModuleHost {
  /**
   * The services the modules publish.
   */
  public readonly services: ServiceRegistry;

  /**
   * The rules notifications follow: a kind its module declares, a module that is active for a window's post, and commands
   * that are the module's own or a dependency's.
   */
  public readonly notificationPolicy: NotificationPolicy;

  /**
   * Creates the host.
   *
   * @param declarations The build's module declarations.
   * @param dataDirectory The data directory.
   * @param methods The registry the modules' methods join.
   * @param events The registry the modules' events join.
   * @param commands The registry the modules' commands join.
   * @param notifications The runtime's notifications; a module's are dismissed when it deactivates.
   * @param loader Loads runtime parts.
   * @param diagnostics Receives the full error of each part that cannot be
   * loaded, activated or deactivated, which the module statuses leave out,
   * and the lines the modules log.
   * @param work The runtime's work in progress; a module's is aborted and ended when it deactivates.
   * @param redactor Removes the home folder and opaque values from the lines the modules log.
   * @example
   * ```ts
   * import { randomUUID } from "node:crypto";
   * import { homedir } from "node:os";
   *
   * import {
   *   CommandRegistry, DataDirectory, DiagnosticRedactor, type EventRegistry, MethodRegistry, ModuleHost, NotificationCenter, PackageRuntimePartLoader, WorkTracker
   * } from "@noldova/teamrun-shell-runtime";
   *
   * export function createHost(events: EventRegistry): ModuleHost {
   *   return new ModuleHost(
   *     [], new DataDirectory("/home/person/.noldova/teamrun"), new MethodRegistry(), events, new CommandRegistry(),
   *     new NotificationCenter(() => undefined, () => new Date(), randomUUID), new PackageRuntimePartLoader(), process.stderr,
   *     new WorkTracker(() => undefined), new DiagnosticRedactor(homedir()));
   * }
   * ```
   */
  public constructor(
    declarations: readonly ModuleDeclaration[],
    dataDirectory: DataDirectory,
    methods: MethodRegistry,
    events: EventRegistry,
    commands: CommandRegistry,
    notifications: NotificationCenter,
    loader: IRuntimePartLoader,
    diagnostics: Writable,
    work: WorkTracker,
    redactor: DiagnosticRedactor);

  /**
   * Where every module stands, in activation order, as `shell.modules`
   * answers. A module is active when its runtime part, if any, and all its
   * dependencies activated; failed when its part could not be loaded or
   * failed to activate; blocked when a dependency is not active, which its
   * cause names. Causes are safe to show and hold no error text.
   */
  public get report(): ModuleStatusList;

  /**
   * Activates the modules once, each after the modules it depends on; a
   * dependency the build does not include or a cycle blocks the modules that
   * need it. A part that fails to activate has the programs it started
   * ended.
   *
   * @param settings The shell's settings, which the modules read and write.
   * @param processes The runtime's programs, which the modules' programs join.
   * @returns A promise that resolves once every module is active, failed or
   * blocked.
   * @example
   * ```ts
   * import type { ModuleHost, ProcessSupervisor, SettingsService } from "@noldova/teamrun-shell-runtime";
   *
   * export async function startAsync(host: ModuleHost, settings: SettingsService, processes: ProcessSupervisor): Promise<number> {
   *   await host.activateAsync(settings, processes);
   *   return host.report.modules.length;
   * }
   * ```
   */
  public activateAsync(settings: SettingsService, processes: ProcessSupervisor): Promise<void>;

  /**
   * The definitions of the settings every declared module declares, in
   * module order.
   *
   * @example
   * ```ts
   * import type { SettingDefinition } from "@noldova/teamrun-shell-protocol";
   * import type { ModuleHost } from "@noldova/teamrun-shell-runtime";
   *
   * export function listSettings(host: ModuleHost): readonly SettingDefinition[] {
   *   return host.settingDefinitions;
   * }
   * ```
   */
  public get settingDefinitions(): readonly SettingDefinition[];

  /**
   * Deactivates the active runtime parts in reverse order, ending the
   * programs each started and withdrawing what each registered even when its
   * deactivation fails.
   *
   * @returns A promise that resolves once every part is deactivated.
   * @throws {AggregateError} Rejected after all parts are deactivated when one
   * or more failed; it holds their errors.
   * @example
   * ```ts
   * import type { ModuleHost } from "@noldova/teamrun-shell-runtime";
   *
   * export function stopAsync(host: ModuleHost): Promise<void> {
   *   return host.deactivateAsync();
   * }
   * ```
   */
  public deactivateAsync(): Promise<void>;
}

/**
 * Loads a module's runtime part by importing its installed package.
 */
export declare class PackageRuntimePartLoader implements IRuntimePartLoader {
  /**
   * Imports the package and constructs its `RuntimePart` without arguments.
   *
   * @param packageName The module's runtime package.
   * @returns A promise of the part.
   * @throws {ModuleLoadException} Rejected when the package exports no
   * `RuntimePart` class whose instances have `activateAsync` and
   * `deactivateAsync`; an import failure rejects as it is.
   * @example
   * ```ts
   * import { PackageRuntimePartLoader, type IRuntimePart } from "@noldova/teamrun-shell-runtime";
   *
   * export function loadNotesAsync(): Promise<IRuntimePart> {
   *   return new PackageRuntimePartLoader().loadAsync("@noldova/teamrun-modules-notes-runtime");
   * }
   * ```
   */
  public loadAsync(packageName: string): Promise<IRuntimePart>;
}

/**
 * The services modules publish, by name.
 */
export declare class ServiceRegistry {
  /**
   * Publishes a service.
   *
   * @param name The service's qualified name.
   * @param service The service.
   * @returns The registration; disposing it withdraws the service.
   * @throws {RegistrationException} When the name is published.
   * @example
   * ```ts
   * import { QualifiedName } from "@noldova/teamrun-shell-protocol";
   * import type { Registration, ServiceRegistry } from "@noldova/teamrun-shell-runtime";
   *
   * export function publish(services: ServiceRegistry): Registration {
   *   return services.publish(new QualifiedName("notes", "store"), new Map<string, string>());
   * }
   * ```
   */
  public publish(name: QualifiedName, service: object): Registration;

  /**
   * Finds a service.
   *
   * @param name The service's qualified name.
   * @returns The service, or `undefined` when none is published.
   * @example
   * ```ts
   * import { QualifiedName } from "@noldova/teamrun-shell-protocol";
   * import type { ServiceRegistry } from "@noldova/teamrun-shell-runtime";
   *
   * export function isPublished(services: ServiceRegistry): boolean {
   *   return services.find(new QualifiedName("notes", "store")) !== undefined;
   * }
   * ```
   */
  public find(name: QualifiedName): object | undefined;
}

/**
 * Routes requests to the handlers registered for their methods.
 */
export declare class MethodRegistry {
  /**
   * Registers a handler.
   *
   * @param name The method's qualified name.
   * @param handler Its handler.
   * @returns The registration; disposing it removes the handler.
   * @throws {RegistrationException} When the name is registered.
   * @example
   * ```ts
   * import { QualifiedName } from "@noldova/teamrun-shell-protocol";
   * import type { MethodRegistry, Registration } from "@noldova/teamrun-shell-runtime";
   *
   * export function serveEcho(methods: MethodRegistry): Registration {
   *   return methods.register(new QualifiedName("notes", "echo"), { handleAsync: context => Promise.resolve(context.payload) });
   * }
   * ```
   */
  public register(name: QualifiedName, handler: IMethodHandler): Registration;

  /**
   * Finds a method's handler.
   *
   * @param name The method's qualified name.
   * @returns The handler, or `undefined` when none is registered.
   * @example
   * ```ts
   * import { QualifiedName } from "@noldova/teamrun-shell-protocol";
   * import type { MethodRegistry } from "@noldova/teamrun-shell-runtime";
   *
   * export function isServed(methods: MethodRegistry): boolean {
   *   return methods.find(new QualifiedName("notes", "open")) !== undefined;
   * }
   * ```
   */
  public find(name: QualifiedName): IMethodHandler | undefined;
}

/**
 * A command a runtime part registers: its title, icon and default key, which
 * windows show and bind, and the handler that runs it. The handler receives
 * the command's arguments as the request context's payload.
 */
export declare class RuntimeCommand {
  /**
   * Runs the command.
   */
  public readonly handler: IMethodHandler;

  /**
   * Creates the command, enabled.
   *
   * @param name The command's name, `<module id>.<name>`.
   * @param title What menus and search show; not whitespace only.
   * @param icon A Material Symbols name, not whitespace only, or `null`.
   * @param defaultKey The key the command asks for, such as `Mod+Alt+T`, or
   * `null`; see `KeyChord.parseDefault` for the keys a default may use.
   * @param handler Runs the command.
   * @param isChecked Whether the command starts checked, which makes it a
   * checkbox or radio row in menus, or `null`, the default, for a command
   * that is never checked.
   * @throws {ArgumentException} When the name, title, icon or default key is
   * invalid; the parameter names which.
   * @example
   * ```ts
   * import { RuntimeCommand } from "@noldova/teamrun-shell-runtime";
   *
   * export const tick: RuntimeCommand = new RuntimeCommand("clock.tick", "Tick", "timer", "Mod+Alt+T", { handleAsync: async context => context.payload });
   * export const pause: RuntimeCommand = new RuntimeCommand("clock.pause", "Pause", null, null, { handleAsync: async () => null }, false);
   * ```
   */
  public constructor(name: string, title: string, icon: string | null, defaultKey: string | null, handler: IMethodHandler, isChecked?: boolean | null);

  /**
   * The command's name, title, icon, default key and state, as
   * `shell.commands` reports them. The state is one for all arguments.
   */
  public get info(): CommandInfo;

  /**
   * Enables or disables the command. A disabled command's menu rows are
   * disabled, command search leaves it out, its key is left alone and
   * `shell.runCommand` refuses it. Windows follow the change through
   * `shell.commandsChanged`; setting the state it has changes nothing.
   *
   * @param isEnabled Whether the command can run.
   * @example
   * ```ts
   * import type { RuntimeCommand } from "@noldova/teamrun-shell-runtime";
   *
   * export function pauseTicks(tick: RuntimeCommand): void {
   *   tick.setEnabled(false);
   * }
   * ```
   */
  public setEnabled(isEnabled: boolean): void;

  /**
   * Checks or unchecks a command created with a checked state. Windows
   * follow the change through `shell.commandsChanged`; setting the state it
   * has changes nothing.
   *
   * @param isChecked Whether the command is checked.
   * @throws {ArgumentException} When the command was created without a
   * checked state.
   * @example
   * ```ts
   * import type { RuntimeCommand } from "@noldova/teamrun-shell-runtime";
   *
   * export function showPaused(pause: RuntimeCommand, isPaused: boolean): void {
   *   pause.setChecked(isPaused);
   * }
   * ```
   */
  public setChecked(isChecked: boolean): void;

  /**
   * Follows the command's state: the listener is called after each change.
   *
   * @param listener Called after the command is enabled, disabled, checked
   * or unchecked.
   * @returns The registration; disposing it stops the listener.
   * @example
   * ```ts
   * import type { Registration, RuntimeCommand } from "@noldova/teamrun-shell-runtime";
   *
   * export function watch(command: RuntimeCommand, report: (isEnabled: boolean) => void): Registration {
   *   return command.onChanged(() => report(command.info.isEnabled));
   * }
   * ```
   */
  public onChanged(listener: () => void): Registration;
}

/**
 * A posted notification as its runtime part holds it.
 */
export declare class NotificationHandle {
  /**
   * The notification's id, which no other notification has, in this run of the runtime or any other.
   */
  public readonly id: string;

  /**
   * Creates the handle.
   *
   * @param id The notification's id.
   * @param change Replaces the notification's post and returns whether the notification was still there.
   * @param remove Dismisses the notification.
   * @example
   * ```ts
   * import { NotificationHandle } from "@noldova/teamrun-shell-runtime";
   *
   * export const handle: NotificationHandle = new NotificationHandle(crypto.randomUUID(), () => true, () => undefined);
   * ```
   */
  public constructor(id: string, change: (post: NotificationPost) => boolean, remove: () => void);

  /**
   * Replaces the notification's post, keeping its place, time and whether it was read; the kind stays the same.
   *
   * @param post The new post.
   * @returns Whether the notification was still there. False means it is gone: the person dismissed it, it was cleared, or
   * it was dropped from a full list; the part posts it again when it still matters.
   * @throws {RegistrationException} When the post's kind or commands are not allowed, or its kind differs.
   * @example
   * ```ts
   * import type { NotificationHandle } from "@noldova/teamrun-shell-runtime";
   * import { NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/teamrun-shell-protocol";
   *
   * export function finish(handle: NotificationHandle): boolean {
   *   return handle.update(new NotificationPost(QualifiedName.parse("clock.sync"), null, "Synced", null, NotificationSeverity.Success, null, [], 1));
   * }
   * ```
   */
  public update(post: NotificationPost): boolean;

  /**
   * Dismisses the notification; dismissing it again does nothing.
   *
   * @example
   * ```ts
   * import type { NotificationHandle } from "@noldova/teamrun-shell-runtime";
   *
   * export function withdraw(handle: NotificationHandle): void {
   *   handle.dismiss();
   * }
   * ```
   */
  public dismiss(): void;
}

/**
 * The runtime's notifications, newest first, for the runtime's life. It keeps at most 100, dropping the oldest that report
 * no work in progress, and reports every change.
 */
export declare class NotificationCenter {
  /**
   * Creates the center.
   *
   * @param publish Receives the whole list after every change.
   * @param now The clock that times new posts.
   * @param createId Creates the id of each new notification, one that no notification had before, such as `randomUUID`.
   * @example
   * ```ts
   * import { randomUUID } from "node:crypto";
   *
   * import { NotificationCenter } from "@noldova/teamrun-shell-runtime";
   *
   * export const notifications: NotificationCenter = new NotificationCenter(t => console.log(t.notifications.length), () => new Date(), randomUUID);
   * ```
   */
  public constructor(publish: (list: NotificationList) => void, now: () => Date, createId: () => string);

  /**
   * The notifications, newest first.
   */
  public get list(): NotificationList;

  /**
   * The sequence of the latest post, or 0 before any. Each post and re-post takes the next number; an update keeps it.
   */
  public get sequence(): number;

  /**
   * Finds a notification by its id.
   *
   * @param id The notification's id.
   * @returns The notification, or `undefined` when it is gone.
   * @example
   * ```ts
   * import type { NotificationCenter } from "@noldova/teamrun-shell-runtime";
   *
   * export function isPosted(notifications: NotificationCenter, id: string): boolean {
   *   return notifications.find(id) !== undefined;
   * }
   * ```
   */
  public find(id: string): Notification | undefined;

  /**
   * Adds a notification at the top, unread, with a new id and the next sequence. One with the same kind and key is replaced
   * and keeps its id.
   *
   * @param post What was posted, already allowed.
   * @returns The notification's id.
   * @example
   * ```ts
   * import type { NotificationCenter } from "@noldova/teamrun-shell-runtime";
   * import { NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/teamrun-shell-protocol";
   *
   * export function announce(notifications: NotificationCenter): string {
   *   return notifications.post(new NotificationPost(QualifiedName.parse("clock.alarm"), "morning", "Alarm", null, NotificationSeverity.Info, null, [], null));
   * }
   * ```
   */
  public post(post: NotificationPost): string;

  /**
   * Replaces a notification's post, keeping its place, sequence, time and whether it was read.
   *
   * @param id The notification's id.
   * @param post The new post, already allowed.
   * @returns Whether the notification was there.
   * @throws {RegistrationException} When the post's kind differs from the notification's.
   * @example
   * ```ts
   * import type { NotificationCenter } from "@noldova/teamrun-shell-runtime";
   * import type { NotificationPost } from "@noldova/teamrun-shell-protocol";
   *
   * export function change(notifications: NotificationCenter, id: string, post: NotificationPost): boolean {
   *   return notifications.update(id, post);
   * }
   * ```
   */
  public update(id: string, post: NotificationPost): boolean;

  /**
   * Reports the list again unchanged, for a change the list does not hold, such as a device's Do not disturb.
   *
   * @example
   * ```ts
   * import type { NotificationCenter } from "@noldova/teamrun-shell-runtime";
   *
   * export function announceQuiet(notifications: NotificationCenter): void {
   *   notifications.republish();
   * }
   * ```
   */
  public republish(): void;

  /**
   * Marks every notification read; nothing is reported when all already were.
   *
   * @example
   * ```ts
   * import type { NotificationCenter } from "@noldova/teamrun-shell-runtime";
   *
   * export function open(notifications: NotificationCenter): void {
   *   notifications.markAllRead();
   * }
   * ```
   */
  public markAllRead(): void;

  /**
   * Removes every notification that reports no work in progress; those still in progress stay, because their modules update
   * them.
   *
   * @example
   * ```ts
   * import type { NotificationCenter } from "@noldova/teamrun-shell-runtime";
   *
   * export function clearAll(notifications: NotificationCenter): void {
   *   notifications.clearFinished();
   * }
   * ```
   */
  public clearFinished(): void;

  /**
   * Removes a notification; one that is gone is ignored.
   *
   * @param id The notification's id.
   * @example
   * ```ts
   * import type { NotificationCenter } from "@noldova/teamrun-shell-runtime";
   *
   * export function remove(notifications: NotificationCenter, id: string): void {
   *   notifications.dismiss(id);
   * }
   * ```
   */
  public dismiss(id: string): void;

  /**
   * Removes every notification of a module's kinds.
   *
   * @param moduleId The module's id.
   * @example
   * ```ts
   * import type { NotificationCenter } from "@noldova/teamrun-shell-runtime";
   *
   * export function clear(notifications: NotificationCenter): void {
   *   notifications.dismissOwnedBy("clock");
   * }
   * ```
   */
  public dismissOwnedBy(moduleId: string): void;
}

/**
 * The notification settings in effect: which devices have Do not disturb on and which modules are muted. Before the
 * shell's database is open there are no settings, and it reports none.
 */
export declare class NotificationSettings {
  /**
   * Creates it over the settings.
   *
   * @param settings The shell's settings, or `null` while the shell's database is not open.
   * @example
   * ```ts
   * import { NotificationSettings } from "@noldova/teamrun-shell-runtime";
   *
   * export const none: NotificationSettings = new NotificationSettings(null);
   * ```
   */
  public constructor(settings: SettingsService | null);

  /**
   * The devices with `shell.doNotDisturb` stored as on, sorted.
   */
  public get quietDevices(): readonly string[];

  /**
   * The modules `shell.mutedModules` names, which still post into the list but show no toast or operating system
   * notification.
   */
  public get mutedModules(): readonly string[];

  /**
   * Tells whether Do not disturb is on for a device.
   *
   * @param device The device's id.
   * @returns `true` when the device's `shell.doNotDisturb` is on.
   * @example
   * ```ts
   * import type { NotificationSettings } from "@noldova/teamrun-shell-runtime";
   *
   * export function shouldShow(settings: NotificationSettings, device: string): boolean {
   *   return !settings.isQuiet(device);
   * }
   * ```
   */
  public isQuiet(device: string): boolean;

  /**
   * Tells whether a setting changes the notification state, so the runtime republishes it.
   *
   * @param name The setting's name.
   * @returns `true` for `shell.doNotDisturb` and `shell.mutedModules`.
   * @example
   * ```ts
   * import type { NotificationSettings } from "@noldova/teamrun-shell-runtime";
   *
   * export function affectsNotifications(settings: NotificationSettings): boolean {
   *   return settings.isNotificationSetting("shell.mutedModules");
   * }
   * ```
   */
  public isNotificationSetting(name: string): boolean;
}

/**
 * The rules a notification follows before the runtime holds it.
 */
export declare class NotificationPolicy {
  /**
   * Creates the policy.
   *
   * @param declarations The build's module declarations.
   * @param isActive Whether a module is active.
   * @example
   * ```ts
   * import { NotificationPolicy } from "@noldova/teamrun-shell-runtime";
   *
   * export const policy: NotificationPolicy = new NotificationPolicy([], () => true);
   * ```
   */
  public constructor(declarations: readonly ModuleDeclaration[], isActive: (moduleId: string) => boolean);

  /**
   * Checks a window's post: its kind's module is active and declares the kind, and its commands are that module's own
   * or a dependency's. A kind of the shell's own, from `ShellNotifications`, runs only the shell's commands, and
   * `shell.saveFailed` and `shell.saveUnfinished` run none.
   *
   * @param post The post.
   * @returns Why the post is refused, safe to show, or `null` when it is allowed.
   * @example
   * ```ts
   * import type { NotificationPolicy } from "@noldova/teamrun-shell-runtime";
   * import type { NotificationPost } from "@noldova/teamrun-shell-protocol";
   *
   * export function isAllowed(policy: NotificationPolicy, post: NotificationPost): boolean {
   *   return policy.findRefusal(post) === null;
   * }
   * ```
   */
  public findRefusal(post: NotificationPost): string | null;

  /**
   * Checks a runtime part's post: the declaration contributes its kind, and its commands are the module's own or a
   * dependency's.
   *
   * @param declaration The posting module's declaration.
   * @param post The post.
   * @throws {RegistrationException} When either does not hold.
   * @example
   * ```ts
   * import type { ModuleDeclaration, NotificationPolicy } from "@noldova/teamrun-shell-runtime";
   * import type { NotificationPost } from "@noldova/teamrun-shell-protocol";
   *
   * export function check(policy: NotificationPolicy, clock: ModuleDeclaration, post: NotificationPost): void {
   *   policy.requireDeclared(clock, post);
   * }
   * ```
   */
  public requireDeclared(declaration: ModuleDeclaration, post: NotificationPost): void;
}

/**
 * The commands the runtime parts registered, in registration order.
 */
export declare class CommandRegistry {
  /**
   * Creates the registry.
   *
   * @param changed Receives the whole list after each registration, removal
   * and state change, each with the next sequence; nothing by default.
   * @example
   * ```ts
   * import { CommandRegistry, type EventChannel } from "@noldova/teamrun-shell-runtime";
   *
   * export function createCommands(changed: EventChannel): CommandRegistry {
   *   return new CommandRegistry(t => changed.publish(t.toJson()));
   * }
   * ```
   */
  public constructor(changed?: (list: CommandList) => void);

  /**
   * The registered commands and their state, in registration order, as
   * `shell.commands` answers; its sequence counts the changes so far.
   */
  public get list(): CommandList;

  /**
   * Registers a command.
   *
   * @param command The command.
   * @returns The registration; disposing it removes the command.
   * @throws {RegistrationException} When a command with its name is
   * registered.
   * @example
   * ```ts
   * import { type CommandRegistry, type Registration, RuntimeCommand } from "@noldova/teamrun-shell-runtime";
   *
   * export function serveTick(commands: CommandRegistry): Registration {
   *   return commands.register(new RuntimeCommand("clock.tick", "Tick", null, null, { handleAsync: async () => null }));
   * }
   * ```
   */
  public register(command: RuntimeCommand): Registration;

  /**
   * Finds a command.
   *
   * @param name The command's name.
   * @returns The command, or `undefined` when none is registered.
   * @example
   * ```ts
   * import { QualifiedName } from "@noldova/teamrun-shell-protocol";
   * import type { CommandRegistry } from "@noldova/teamrun-shell-runtime";
   *
   * export function isRegistered(commands: CommandRegistry): boolean {
   *   return commands.find(QualifiedName.parse("clock.tick")) !== undefined;
   * }
   * ```
   */
  public find(name: QualifiedName): RuntimeCommand | undefined;
}

/**
 * Declares the events a runtime publishes.
 */
export declare class EventRegistry {
  /**
   * Creates the registry.
   *
   * @param sink Delivers published events.
   * @example
   * ```ts
   * import { EventRegistry, type RuntimeServer } from "@noldova/teamrun-shell-runtime";
   *
   * export function createEvents(server: RuntimeServer): EventRegistry {
   *   return new EventRegistry(server);
   * }
   * ```
   */
  public constructor(sink: IEventSink);

  /**
   * Declares an event.
   *
   * @param name The event's qualified name.
   * @returns The channel that publishes it; disposing it withdraws the event.
   * @throws {RegistrationException} When the name is declared.
   * @example
   * ```ts
   * import { QualifiedName } from "@noldova/teamrun-shell-protocol";
   * import type { EventRegistry } from "@noldova/teamrun-shell-runtime";
   *
   * export function announce(events: EventRegistry, path: string): void {
   *   const channel = events.declare(new QualifiedName("notes", "changed"));
   *   channel.publish({ path });
   *   channel[Symbol.dispose]();
   * }
   * ```
   */
  public declare(name: QualifiedName): EventChannel;
}

/**
 * The runtime process's entry.
 */
export declare class RuntimeEntry {
  /**
   * The entry script's path, to start the runtime with.
   */
  public static get entryPath(): string;

  /**
   * Runs the runtime until it stops.
   *
   * @param entryArguments The entry arguments, as {@link RuntimeOptions.parse} reads them.
   * @param platform The platform, as in `process.platform`.
   * @param environment The environment.
   * @param signals Emits `SIGINT` and `SIGTERM`, which stop the runtime.
   * @param error Receives usage and failure messages.
   * @returns A promise of the exit code: 0 after a stop, 1 when the runtime failed to start, 2 for invalid arguments and 3 when another runtime owns the directory.
   * @example
   * ```ts
   * import { RuntimeEntry } from "@noldova/teamrun-shell-runtime";
   *
   * export async function mainAsync(): Promise<void> {
   *   process.exitCode = await RuntimeEntry.runAsync(process.argv.slice(2), process.platform, process.env, process, process.stderr);
   * }
   * ```
   */
  public static runAsync(entryArguments: readonly string[], platform: string, environment: NodeJS.ProcessEnv, signals: EventEmitter, error: Writable): Promise<number>;

  /**
   * Sets the exit code a run ends with; a run that rejects is written to `error` and exits with 1. The entry
   * script settles its run this way instead of awaiting it at the top level, because a module's runtime part that
   * imports this package's values is loaded while the run is still going.
   *
   * @param run The run, as {@link RuntimeEntry.runAsync} returns it.
   * @param error Receives the rejection.
   * @param exit Receives the exit code, as `process` does.
   * @returns A promise that resolves once the exit code is set; it never rejects.
   * @example
   * ```ts
   * import { RuntimeEntry } from "@noldova/teamrun-shell-runtime";
   *
   * export function main(): void {
   *   void RuntimeEntry.settleAsync(RuntimeEntry.runAsync(process.argv.slice(2), process.platform, process.env, process, process.stderr), process.stderr, process);
   * }
   * ```
   */
  public static settleAsync(run: Promise<number>, error: Writable, exit: Pick<NodeJS.Process, "exitCode">): Promise<void>;
}

/**
 * Tracks the work in progress.
 */
export declare class WorkTracker {
  /**
   * Creates the tracker.
   *
   * @param changed Called whenever work begins or ends.
   * @example
   * ```ts
   * import { type IdleMonitor, WorkTracker } from "@noldova/teamrun-shell-runtime";
   *
   * export function createTracker(idle: IdleMonitor): WorkTracker {
   *   return new WorkTracker(() => idle.check());
   * }
   * ```
   */
  public constructor(changed: () => void);

  /**
   * Whether no work is in progress.
   */
  public get isEmpty(): boolean;

  /**
   * The descriptions of the work in progress, in the order it began.
   */
  public get descriptions(): readonly string[];

  /**
   * The work in progress as `shell.work` reports it, with its sequence: how
   * many times work has begun or ended.
   */
  public get report(): WorkReport;

  /**
   * Begins work.
   *
   * @param description What the work is, as shown to the person.
   * @param owner The module whose work it is, or empty for the shell's own.
   * @returns The work item; disposing it ends the work.
   * @throws {ArgumentException} When the description is empty or whitespace.
   * @example
   * ```ts
   * import type { WorkTracker } from "@noldova/teamrun-shell-runtime";
   *
   * export async function indexAsync(work: WorkTracker, index: (signal: AbortSignal) => Promise<void>): Promise<void> {
   *   const item = work.begin("Indexing the project", "notes");
   *   try {
   *     await index(item.signal);
   *   }
   *   finally {
   *     item[Symbol.dispose]();
   *   }
   * }
   * ```
   */
  public begin(description: string, owner?: string): WorkItem;

  /**
   * Asks all work in progress to stop by aborting each item's signal.
   * @example
   * ```ts
   * import type { WorkTracker } from "@noldova/teamrun-shell-runtime";
   *
   * export function cancelEverything(work: WorkTracker): void {
   *   work.cancelAll();
   * }
   * ```
   */
  public cancelAll(): void;

  /**
   * Aborts and ends every item a module owns, as its runtime part
   * deactivates.
   *
   * @param owner The module's id.
   * @example
   * ```ts
   * import type { WorkTracker } from "@noldova/teamrun-shell-runtime";
   *
   * export function endNotesWork(work: WorkTracker): void {
   *   work.endOwnedBy("notes");
   * }
   * ```
   */
  public endOwnedBy(owner: string): void;
}

/**
 * The clock the runtime times its programs' starts with, and the boot it
 * runs in. On Linux the clock counts from boot, as the process table does
 * there, and the boot is the kernel's boot id; elsewhere the clock is the
 * wall clock, as the process table's start times are, and the boot is when
 * the system started, in seconds. On Linux a change of the wall clock does
 * not affect the clock; elsewhere a record notes the clock's offset, which
 * shows a later change.
 */
export declare class ProcessClock {
  /**
   * The boot the clock runs in.
   */
  public readonly boot: string;

  /**
   * Creates the clock.
   *
   * @param boot The boot the clock runs in.
   * @param isBootRelative Whether the clock counts from boot, which makes
   * the boot an exact id; otherwise it is a time in seconds compared within
   * a minute.
   * @example
   * ```ts
   * import { ProcessClock } from "@noldova/teamrun-shell-runtime";
   *
   * export function createLinuxClock(bootId: string): ProcessClock {
   *   return new ProcessClock(bootId, true);
   * }
   * ```
   */
  public constructor(boot: string, isBootRelative: boolean);

  /**
   * Creates the clock for a platform.
   *
   * @param platform The platform, as in `process.platform`.
   * @param bootIdFile The file that holds the kernel's boot id on Linux;
   * `/proc/sys/kernel/random/boot_id` by default.
   * @returns The clock.
   * @throws {Error} On Linux, when the boot id file cannot be read.
   * @example
   * ```ts
   * import { ProcessClock } from "@noldova/teamrun-shell-runtime";
   *
   * export function createClock(): ProcessClock {
   *   return ProcessClock.create(process.platform);
   * }
   * ```
   */
  public static create(platform: string, bootIdFile?: string): ProcessClock;

  /**
   * Reads the clock.
   *
   * @returns The time in milliseconds.
   * @example
   * ```ts
   * import type { ProcessClock } from "@noldova/teamrun-shell-runtime";
   *
   * export function elapsed(clock: ProcessClock, since: number): number {
   *   return clock.now() - since;
   * }
   * ```
   */
  public now(): number;

  /**
   * Reads how far the wall clock is from the time since boot.
   *
   * @returns The offset in milliseconds; always 0 for a clock that counts
   * from boot.
   * @example
   * ```ts
   * import type { ProcessClock } from "@noldova/teamrun-shell-runtime";
   *
   * export function noteOffset(clock: ProcessClock): number {
   *   return clock.offset();
   * }
   * ```
   */
  public offset(): number;

  /**
   * Whether the wall clock was changed since a recorded offset, by more than
   * 1.5 seconds against the time since boot.
   *
   * @param offset The recorded offset.
   * @returns Whether the times recorded with the offset can no longer be
   * compared with this clock's.
   * @example
   * ```ts
   * import type { ProcessClock } from "@noldova/teamrun-shell-runtime";
   *
   * export function isComparable(clock: ProcessClock, offset: number): boolean {
   *   return !clock.hasStepped(offset);
   * }
   * ```
   */
  public hasStepped(offset: number): boolean;

  /**
   * Whether a recorded boot is this clock's.
   *
   * @param boot The recorded boot.
   * @returns Whether it is the same boot.
   * @example
   * ```ts
   * import type { ProcessClock } from "@noldova/teamrun-shell-runtime";
   *
   * export function isCurrent(clock: ProcessClock, boot: string): boolean {
   *   return clock.isSameBoot(boot);
   * }
   * ```
   */
  public isSameBoot(boot: string): boolean;
}

/**
 * Starts, records and ends the programs the runtime runs for its modules. On
 * Windows a program's tree is found in the process table; elsewhere each
 * program leads its own process group. Each program's record in the shell's
 * database lets the next runtime end what a crashed one left running; while
 * the program runs, the record's time it was last seen running is renewed at
 * the settings' interval.
 */
export declare class ProcessSupervisor {
  /**
   * Creates the supervisor.
   *
   * @param database The shell's database, which holds the records.
   * @param platform The platform, as in `process.platform`.
   * @param environment The runtime's environment, which programs inherit from.
   * @param command Reads the process table.
   * @param diagnostics The runtime's log, which receives the programs that
   * had to be killed or could not be ended.
   * @param settings How long programs may take to end.
   * @param clock The clock that times programs' starts and names the boot;
   * {@link ProcessClock.create} for the platform this process runs on by
   * default.
   * @example
   * ```ts
   * import { ProcessSettings, ProcessSupervisor, type ShellDatabase, SystemCommand } from "@noldova/teamrun-shell-runtime";
   *
   * export function createSupervisor(database: ShellDatabase): ProcessSupervisor {
   *   return new ProcessSupervisor(database, process.platform, process.env, new SystemCommand(), process.stderr, new ProcessSettings());
   * }
   * ```
   */
  public constructor(
    database: ShellDatabase,
    platform: string,
    environment: NodeJS.ProcessEnv,
    command: SystemCommand,
    diagnostics: Writable,
    settings?: ProcessSettings,
    clock?: ProcessClock);

  /**
   * The programs running, in the order they started, then the programs that
   * exited cleanly while their process group still runs, in the order they
   * exited.
   */
  public get programs(): readonly RunningProgram[];

  /**
   * Starts a program for a module; see
   * {@link IRuntimePartContext.startProcessAsync}. When a program that is
   * not on Windows exits with an error, the rest of its process group is
   * ended; after a clean exit the group is left until the module's programs
   * are stopped.
   *
   * @param moduleId The module the program runs for.
   * @param request The program to start.
   * @returns A promise of the running program, once it has started and is
   * recorded.
   * @throws {ProcessStartException} Rejected when the program cannot start,
   * or once the module's programs or all programs are being stopped.
   * @example
   * ```ts
   * import { type OwnedProcess, ProcessRequest, type ProcessSupervisor } from "@noldova/teamrun-shell-runtime";
   *
   * export function startStatusAsync(processes: ProcessSupervisor, project: string): Promise<OwnedProcess> {
   *   return processes.startAsync("notes", new ProcessRequest("git", ["status"], project));
   * }
   * ```
   */
  public startAsync(moduleId: string, request: ProcessRequest): Promise<OwnedProcess>;

  /**
   * Refuses the module's further starts, then ends every program it runs and
   * what they left running, giving them the settings' grace period to exit
   * before killing them. A process group whose program has exited is ended
   * only while a process listed in it when the program exited still runs in
   * it; otherwise the runtime's log names the group's processes and they are
   * left running.
   *
   * @param moduleId The module's id.
   * @returns A promise that resolves once they have ended or the runtime's
   * log says which could not be.
   * @example
   * ```ts
   * import type { ProcessSupervisor } from "@noldova/teamrun-shell-runtime";
   *
   * export function stopNotesAsync(processes: ProcessSupervisor): Promise<void> {
   *   return processes.stopOwnedByAsync("notes");
   * }
   * ```
   */
  public stopOwnedByAsync(moduleId: string): Promise<void>;

  /**
   * Refuses every further start, then ends every program still running, as
   * {@link stopOwnedByAsync} does for one module.
   *
   * @returns A promise that resolves once they have ended or the runtime's
   * log says which could not be.
   * @example
   * ```ts
   * import type { ProcessSupervisor } from "@noldova/teamrun-shell-runtime";
   *
   * export function stopEverythingAsync(processes: ProcessSupervisor): Promise<void> {
   *   return processes.stopAllAsync();
   * }
   * ```
   */
  public stopAllAsync(): Promise<void>;

  /**
   * Kills what the recorded programs of an earlier runtime left running and
   * removes their records. Only a recorded program still running is ended,
   * with its tree on Windows or its process group elsewhere; a process whose
   * id was reused since, as its start time or, on Windows, its executable
   * shows, is left alone. A record from another boot is removed without
   * ending anything, and so is a record whose clock offset shows that the
   * wall clock changed since, which the runtime's log notes. When a recorded
   * program is no longer running, its process group is ended while a process
   * in it certainly started between the request for the program and the time
   * it was last seen running, given the process table's precision; on Windows
   * its children that started in that time are ended with their trees, and
   * only those that started before a process that now holds its id count.
   * Otherwise nothing is ended, and the runtime's log names the processes in
   * its group, or on Windows its children that started after that time.
   *
   * @returns A promise that resolves once the leftovers have ended or the
   * runtime's log says which could not be.
   * @example
   * ```ts
   * import type { ProcessSupervisor } from "@noldova/teamrun-shell-runtime";
   *
   * export function recoverAsync(processes: ProcessSupervisor): Promise<void> {
   *   return processes.cleanUpAsync();
   * }
   * ```
   */
  public cleanUpAsync(): Promise<void>;
}

/**
 * Chooses the data directory a desktop or CLI uses.
 */
export declare class DataDirectoryLocator {
  /**
   * Chooses the data directory: the explicit one when given; otherwise `~/.noldova/teamrun` for a packaged build; otherwise `TEAMRUN_DATA_DIR` or, without it, `_build/data` in the checkout, so development and test runs never use the person's directory.
   *
   * @param isPackaged Whether this is a packaged build.
   * @param environment The environment that may set `TEAMRUN_DATA_DIR`.
   * @param homeFolder The person's home folder.
   * @param checkoutRoot The repository checkout a development build runs from.
   * @param explicit A data directory the person or a test gave, if any; empty or whitespace counts as none.
   * @returns The data directory.
   * @throws {ArgumentException} When the chosen path is not absolute.
   * @example
   * ```ts
   * import { homedir } from "node:os";
   *
   * import { type DataDirectory, DataDirectoryLocator } from "@noldova/teamrun-shell-runtime";
   *
   * export function locate(isPackaged: boolean, checkoutRoot: string): DataDirectory {
   *   return DataDirectoryLocator.locate(isPackaged, process.env, homedir(), checkoutRoot);
   * }
   * ```
   */
  public static locate(isPackaged: boolean, environment: NodeJS.ProcessEnv, homeFolder: string, checkoutRoot: string, explicit?: string): DataDirectory;
}

/**
 * This build of the runtime and its clients.
 */
export declare class RuntimeBuild {
  /**
   * The build's identity: the product version and the build fingerprint from {@link ProductInfo.current}, and the supported protocol version.
   */
  public static readonly identity: BuildIdentity;
}
