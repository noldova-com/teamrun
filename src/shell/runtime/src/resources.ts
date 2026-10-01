/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

export class Resources {
  public static readonly rootParameterName: string = "root";
  public static readonly idParameterName: string = "id";
  public static readonly statementsParameterName: string = "statements";
  public static readonly endpointParameterName: string = "endpoint";
  public static readonly tokenParameterName: string = "token";
  public static readonly processIdParameterName: string = "processId";
  public static readonly executablePathParameterName: string = "executablePath";
  public static readonly productVersionParameterName: string = "productVersion";
  public static readonly protocolVersionParameterName: string = "protocolVersion";
  public static readonly buildParameterName: string = "build";
  public static readonly rootNotAbsolute: string = "The data directory must be an absolute path.";
  public static readonly migrationIdInvalid: string = "A migration id is lowercase letters and digits separated by single hyphens.";
  public static readonly moduleIdInvalid: string = "A module id is lowercase kebab-case and is not \"shell\".";
  public static readonly ownershipDatabaseFileName: string = "ownership.sqlite";
  public static readonly shellDatabaseFileName: string = "shell.sqlite";
  public static readonly discoveryFolderName: string = "discovery";
  public static readonly discoveryFileName: string = "runtime.json";
  public static readonly backupsFolderName: string = "backups";
  public static readonly runtimeEntries: readonly string[] = [
    Resources.ownershipDatabaseFileName,
    `${Resources.ownershipDatabaseFileName}-journal`,
    Resources.discoveryFolderName
  ];
  public static readonly modulesFolderName: string = "modules";
  public static readonly moduleIdPattern: RegExp = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
  public static readonly migrationIdPattern: RegExp = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  public static readonly reservedModuleId: string = "shell";
  public static readonly movedFolderInfix: string = "-before-shell-";
  public static readonly timestampSeparatorPattern: RegExp = /[-:]|\.\d+/g;
  public static readonly acquireOwnershipStatement: string = "BEGIN EXCLUSIVE";
  public static readonly rollbackStatement: string = "ROLLBACK";
  public static readonly beginMigrationStatement: string = "BEGIN IMMEDIATE";
  public static readonly commitStatement: string = "COMMIT";
  public static readonly writeAheadLogStatement: string = "PRAGMA journal_mode = WAL";
  public static readonly rollbackJournalStatement: string = "PRAGMA journal_mode = DELETE";
  public static readonly databaseFileSuffixes: readonly string[] = ["", "-wal", "-shm", "-journal"];
  public static readonly historyTableName: string = "migration_history";
  public static readonly createHistoryStatement: string = "CREATE TABLE migration_history (position INTEGER PRIMARY KEY, id TEXT NOT NULL UNIQUE) STRICT";
  public static readonly readHistoryStatement: string = "SELECT position, id FROM migration_history ORDER BY position";
  public static readonly insertHistoryStatement: string = "INSERT INTO migration_history (position, id) VALUES (?, ?)";
  public static readonly readTablesStatement: string = "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name";
  public static readonly integrityCheckStatement: string = "PRAGMA integrity_check";
  public static readonly integrityCheckColumn: string = "integrity_check";
  public static readonly integrityOk: string = "ok";
  public static readonly nameColumn: string = "name";
  public static readonly positionColumn: string = "position";
  public static readonly idColumn: string = "id";
  public static readonly errorCodeField: "errcode" = "errcode";
  public static readonly busyErrorCode: number = 5;
  public static readonly ownershipWaitMilliseconds: number = 250;
  public static readonly backupWakeMilliseconds: number = 25;
  public static readonly privateFileMode: number = 0o600;
  public static readonly privateFolderMode: number = 0o700;
  public static readonly exclusiveWriteFlag: string = "wx";
  public static readonly temporarySuffix: string = ".tmp";
  public static readonly backupPrefix: string = "shell-before-migration-";
  public static readonly backupExtension: string = ".sqlite";
  public static readonly discoveryFormatVersion: number = 1;
  public static readonly utf8Encoding: BufferEncoding = "utf8";
  public static readonly lineSeparator: string = "\n";
  public static readonly windowsPlatform: string = "win32";
  public static readonly systemRootVariable: string = "SystemRoot";
  public static readonly systemFolderName: string = "System32";
  public static readonly identityCommandName: string = "whoami.exe";
  public static readonly identityArguments: readonly string[] = ["/user", "/fo", "csv", "/nh"];
  public static readonly accessCommandName: string = "icacls.exe";
  public static readonly removeInheritanceArgument: string = "/inheritance:r";
  public static readonly replaceGrantArgument: string = "/grant:r";
  public static readonly securityIdentifierPattern: RegExp = /"(S-1-[0-9-]+)"\s*$/;
  public static readonly commandTimeoutMilliseconds: number = 30_000;
  public static readonly commandOutputLimit: number = 1024 * 1024;
  public static readonly ownershipReleased: string = "The data directory's ownership has been released.";
  public static readonly systemRootMissing: string = "SystemRoot is not set, so the Windows system tools cannot be found.";
  public static readonly backupUnverified: string = "The database backup did not pass its integrity check.";
  public static readonly historyNotRecognized: string = "The shell database's migration history is not one this build recognizes.";
  public static readonly historyNewer: string = "The shell database was written by a newer build.";
  public static readonly tablesWithoutHistory: string = "The shell database has tables but no migration history.";
  public static readonly discoveryNotObject: string = "The discovery metadata is not a JSON object.";

  public static formatDiscoveryVersion(version: unknown): string {
    return `The discovery metadata has the unsupported format version ${String(version)}.`;
  }

  public static formatDiscoveryField(name: string): string {
    return `The discovery metadata's ${name} is missing or invalid.`;
  }

  public static formatDiscoveryUnreadable(file: string, reason: string): string {
    return `The discovery file ${file} is not valid: ${reason}`;
  }

  public static formatOwned(root: string): string {
    return `Another TeamRun runtime owns the data directory ${root}.`;
  }

  public static formatPreShellData(root: string, entries: readonly string[]): string {
    return `The data directory ${root} holds data from a release before the shell: ${entries.join(", ")}.`;
  }

  public static formatMigrationFailed(id: string): string {
    return `The migration ${id} of the shell database failed and was rolled back.`;
  }

  public static formatAccessGrant(securityIdentifier: string): string {
    return `*${securityIdentifier}:(OI)(CI)F`;
  }

  public static formatCommandFailed(command: string, output: string): string {
    return `${command} failed: ${output}`;
  }

  public static formatIdentityUnreadable(output: string): string {
    return `The current user's security identifier could not be read from: ${output}`;
  }

  public static formatBackupName(position: number, timestamp: string): string {
    return `${Resources.backupPrefix}${position}-${timestamp}${Resources.backupExtension}`;
  }

  public static formatMovedFolderName(root: string, timestamp: string): string {
    return `${root}${Resources.movedFolderInfix}${timestamp}`;
  }

  public static formatTimestamp(moment: Date): string {
    return moment.toISOString().replace(Resources.timestampSeparatorPattern, String.empty);
  }

  public static formatTemporaryName(fileName: string, unique: string): string {
    return `${fileName}.${unique}${Resources.temporarySuffix}`;
  }
}
