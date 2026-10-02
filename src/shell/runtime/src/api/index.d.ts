/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DatabaseSync } from "node:sqlite";

import { Exception, type ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

/**
 * What a data directory holds, judged from its top-level entries other than the
 * runtime's own ownership database and discovery folder.
 */
export declare enum DataDirectoryState {
  /**
   * The directory is missing or holds nothing but the runtime's own entries.
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
 * The exception thrown when a shell database migration fails. Its changes and
 * its history row were rolled back together.
 */
export declare class MigrationException extends Exception {
  /**
   * The id of the migration that failed.
   */
  public readonly migrationId: string;

  /**
   * Creates the exception.
   *
   * @param migrationId The id of the failed migration.
   * @param options The SQLite failure, if any.
   * @example
   * ```ts
   * import { MigrationException } from "@noldova/teamrun-shell-runtime";
   *
   * export function fail(): never {
   *   throw new MigrationException("create-settings");
   * }
   * ```
   */
  public constructor(migrationId: string, options?: ExceptionOptions);
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
   * @returns A promise of the program's standard output.
   * @throws {SystemCommandException} The promise rejects when the program
   * cannot start, exits with a nonzero code, times out or writes too much.
   * @example
   * ```ts
   * import { SystemCommand } from "@noldova/teamrun-shell-runtime";
   *
   * export function readUserAsync(): Promise<string> {
   *   return new SystemCommand().runAsync("C:\\Windows\\System32\\whoami.exe", ["/user", "/fo", "csv", "/nh"]);
   * }
   * ```
   */
  public runAsync(file: string, commandArguments: readonly string[]): Promise<string>;
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
   * The path of the database backups folder, `backups`.
   */
  public get backupsFolder(): string;

  /**
   * The path of the folder that holds every module's folder, `modules`.
   */
  public get modulesFolder(): string;

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
}

/**
 * Inspects a data directory and moves data written before the shell aside.
 */
export declare class DataDirectoryInspector {
  /**
   * Inspects the directory's top-level entries, ignoring the runtime's
   * ownership database and discovery folder.
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
 * The shell's own database, `shell.sqlite`, opened in write-ahead-log mode with
 * its migrations applied.
 */
export declare class ShellDatabase implements Disposable {
  /**
   * The ids of the migrations the database holds after opening, in order.
   */
  public readonly appliedMigrations: readonly string[];

  private constructor();

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
   * @example
   * ```ts
   * import { DiscoveryPublisher, PosixFolderProtector, type OwnershipLock } from "@noldova/teamrun-shell-runtime";
   *
   * export function createPublisher(lock: OwnershipLock): DiscoveryPublisher {
   *   return new DiscoveryPublisher(lock, new PosixFolderProtector());
   * }
   * ```
   */
  public constructor(lock: OwnershipLock, protector: IFolderProtector);

  /**
   * Writes the metadata to a new owner-only file in the discovery folder and
   * renames it over the discovery file, so readers see the old or the new
   * metadata, never a partial file. The folder is created and protected when
   * missing.
   *
   * @param discovery The metadata to publish.
   * @returns A promise of the discovery file's path.
   * @throws {OwnershipReleasedException} When the ownership was released.
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
   * discovery file.
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
