/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

export class Resources {
  public static readonly productName: string = "__PRODUCT_NAME__";
  public static readonly productSlug: string = "__PRODUCT_SLUG__";
  public static readonly folderSeparator: string = "/";
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
  public static readonly displayNameParameterName: string = "displayName";
  public static readonly dependenciesParameterName: string = "dependencies";
  public static readonly runtimePackageParameterName: string = "runtimePackage";
  public static readonly contributesParameterName: string = "contributes";
  public static readonly rootNotAbsolute: string = "The data directory must be an absolute path.";
  public static readonly migrationIdInvalid: string = "A migration id is lowercase letters and digits separated by single hyphens.";
  public static readonly moduleIdInvalid: string = "A module id is lowercase kebab-case and is not \"shell\".";
  public static readonly ownershipDatabaseFileName: string = "ownership.sqlite";
  public static readonly shellDatabaseFileName: string = "shell.sqlite";
  public static readonly discoveryFolderName: string = "discovery";
  public static readonly runtimeLogFileName: string = "runtime.log";
  public static readonly previousRuntimeLogFileName: string = "runtime.previous.log";
  public static readonly desktopLogFileName: string = "desktop.log";
  public static readonly previousDesktopLogFileName: string = "desktop.previous.log";
  public static readonly startLogPrefix: string = "start-";
  public static readonly startLogExtension: string = ".log";
  public static readonly discoveryFileName: string = "runtime.json";
  public static readonly backupsFolderName: string = "backups";
  public static readonly profileFolderName: string = "desktop";
  public static readonly modulesFolderName: string = "modules";
  public static readonly workFolderName: string = "work";
  public static readonly logsFolderName: string = "logs";
  public static readonly runtimeEntries: readonly string[] = [
    Resources.ownershipDatabaseFileName,
    `${Resources.ownershipDatabaseFileName}-journal`,
    Resources.discoveryFolderName,
    Resources.backupsFolderName,
    Resources.profileFolderName,
    Resources.modulesFolderName,
    Resources.workFolderName,
    Resources.logsFolderName
  ];
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
  public static readonly valueColumn: string = "value";
  public static readonly windowStatesMigration: string = "window-states";
  public static readonly quietDevicesMigration: string = "quiet-devices";
  public static readonly createQuietDevicesStatement: string = "CREATE TABLE quiet_devices (device TEXT PRIMARY KEY) STRICT";
  public static readonly quietDevicesMovedMigration: string = "quiet-devices-moved";
  public static readonly forgetDoNotDisturbStatement: string =
    "DELETE FROM setting_values WHERE name = 'shell.doNotDisturb' AND scope_name = '' AND scope_id = '' AND device <> ''";
  public static readonly dropQuietDevicesStatement: string = "DROP TABLE quiet_devices";
  public static readonly settingsMigration: string = "settings";
  public static readonly createSettingValuesStatement: string =
    "CREATE TABLE setting_values (name TEXT NOT NULL, scope_name TEXT NOT NULL, scope_id TEXT NOT NULL, device TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (name, scope_name, scope_id, device)) STRICT";
  public static readonly copyQuietDevicesStatement: string =
    "INSERT INTO setting_values (name, scope_name, scope_id, device, value) SELECT 'shell.doNotDisturb', '', '', device, 'true' FROM quiet_devices";
  public static readonly createSettingScopesStatement: string =
    "CREATE TABLE setting_scopes (scope_name TEXT NOT NULL, scope_id TEXT NOT NULL, parent_name TEXT NOT NULL, parent_id TEXT NOT NULL, PRIMARY KEY (scope_name, scope_id)) STRICT";
  public static readonly readSettingStatement: string = "SELECT value FROM setting_values WHERE name = ? AND scope_name = ? AND scope_id = ? AND device = ?";
  public static readonly readSettingDevicesStatement: string = "SELECT device, value FROM setting_values WHERE name = ? AND scope_name = '' AND scope_id = '' AND device <> ''";
  public static readonly writeSettingStatement: string =
    "INSERT INTO setting_values (name, scope_name, scope_id, device, value) VALUES (?, ?, ?, ?, ?) ON CONFLICT (name, scope_name, scope_id, device) DO UPDATE SET value = excluded.value";
  public static readonly resetSettingStatement: string = "DELETE FROM setting_values WHERE name = ? AND scope_name = ? AND scope_id = ? AND device = ?";
  public static readonly readScopeParentStatement: string = "SELECT parent_name, parent_id FROM setting_scopes WHERE scope_name = ? AND scope_id = ?";
  public static readonly writeScopeParentStatement: string =
    "INSERT INTO setting_scopes (scope_name, scope_id, parent_name, parent_id) VALUES (?, ?, ?, ?) ON CONFLICT (scope_name, scope_id) DO UPDATE SET parent_name = excluded.parent_name, parent_id = excluded.parent_id";
  public static readonly removeScopeParentStatement: string = "DELETE FROM setting_scopes WHERE scope_name = ? AND scope_id = ?";
  public static readonly removeScopeValuesStatement: string = "DELETE FROM setting_values WHERE scope_name = ? AND scope_id = ?";
  public static readonly deviceColumn: string = "device";
  public static readonly parentNameColumn: string = "parent_name";
  public static readonly parentIdColumn: string = "parent_id";
  public static readonly applicationScope: string = "";
  public static readonly sharedDevice: string = "";
  public static readonly createWindowStatesStatement: string =
    "CREATE TABLE window_states (device TEXT NOT NULL, window TEXT NOT NULL, bounds TEXT, layout TEXT, PRIMARY KEY (device, window)) STRICT";
  public static readonly errorCodeField: "errcode" = "errcode";
  public static readonly busyErrorCode: number = 5;
  public static readonly fileErrorCodeField: "code" = "code";
  public static readonly busyFileErrorCodes: readonly string[] = ["EPERM", "EACCES", "EBUSY"];
  public static readonly replaceAttempts: number = 40;
  public static readonly replaceRetryDelay: number = 50;
  public static readonly ownershipWaitMilliseconds: number = 250;
  public static readonly backupWakeMilliseconds: number = 25;
  public static readonly privateFileMode: number = 0o600;
  public static readonly logSizeLimit: number = 1048576;
  public static readonly logRecordShare: number = 4;
  public static readonly missingFileErrorCode: string = "ENOENT";
  public static readonly utf8ContinuationMask: number = 0xC0;
  public static readonly utf8ContinuationBits: number = 0x80;
  public static readonly privateFolderMode: number = 0o700;
  public static readonly exclusiveWriteFlag: string = "wx";
  public static readonly temporarySuffix: string = ".tmp";
  public static readonly backupInfix: string = "-before-migration-";
  public static readonly backupExtension: string = ".sqlite";
  public static readonly discoveryFormatVersion: number = 1;
  public static readonly declarationsFormatVersion: number = 1;
  public static readonly declarationsFileSegments: readonly string[] = ["_build", "modules", "declarations.json"];
  public static readonly installRootSegments: readonly string[] = ["..", "..", "..", ".."];
  public static readonly utf8Encoding: BufferEncoding = "utf8";
  public static readonly missingFileCode: string = "ENOENT";
  public static readonly lineSeparator: string = "\n";
  public static readonly lineBreakPattern: RegExp = /\r?\n/;
  public static readonly windowsPlatform: string = "win32";
  public static readonly systemRootVariable: string = "SystemRoot";
  public static readonly systemFolderName: string = "System32";
  public static readonly identityCommandName: string = "whoami.exe";
  public static readonly identityArguments: readonly string[] = ["/user", "/fo", "csv", "/nh"];
  public static readonly accessCommandName: string = "icacls.exe";
  public static readonly removeInheritanceArgument: string = "/inheritance:r";
  public static readonly replaceGrantArgument: string = "/grant:r";
  public static readonly resetAccessArgument: string = "/reset";
  public static readonly saveAccessArgument: string = "/save";
  public static readonly accessFileName: string = "access.sddl";
  public static readonly accessFileEncoding: BufferEncoding = "utf16le";
  public static readonly accessEntryPattern: RegExp = /\((?:[^;()]*;){5}([^;()]+)[^()]*\)/g;
  public static readonly protectedAccessPattern: RegExp = /\bD:[A-Z]*P/;
  public static readonly administratorSuffix: string = "-500";
  public static readonly administratorAlias: string = "LA";
  public static readonly securityIdentifierPattern: RegExp = /"(S-1-[0-9-]+)"\s*$/;
  public static readonly commandTimeoutMilliseconds: number = 30_000;
  public static readonly commandOutputLimit: number = 1024 * 1024;
  public static readonly ownershipReleased: string = "The data directory's ownership has been released.";
  public static readonly systemRootMissing: string = "SystemRoot is not set, so the Windows system tools cannot be found.";
  public static readonly backupUnverified: string = "The database backup did not pass its integrity check.";
  public static readonly shellDatabaseName: string = "shell database";
  public static readonly moduleDatabaseExtension: string = ".sqlite";
  public static readonly thenProperty: string = "then";
  public static readonly actionParameterName: string = "action";
  public static readonly transactionNotSynchronous: string =
    "A transaction's action must finish before it returns; it committed nothing, because an awaited step would run after the commit.";
  public static readonly moduleDatabaseUnknown: string = "Its database was written by a newer build or is not one this build recognizes.";
  public static readonly moduleDatabaseFailed: string = "Its database could not be opened or migrated.";
  public static readonly discoveryNotObject: string = "The discovery metadata is not a JSON object.";
  public static readonly declarationsNotObject: string = "The module declarations are not a JSON object with a list of modules.";
  public static readonly declarationNotObject: string = "A module declaration is not a JSON object.";
  public static readonly moduleLoadFailed: string = "Its runtime part could not be loaded.";
  public static readonly moduleActivationFailed: string = "Its runtime part failed to activate.";
  public static readonly moduleDeactivationFailed: string = "One or more runtime parts failed to deactivate.";
  public static readonly moduleDeactivationPartFailed: string = "Its runtime part failed to deactivate.";
  public static readonly runtimePartMissing: string = "The package does not export a RuntimePart class whose instances can activate and deactivate.";
  public static readonly runtimePartExport: "RuntimePart" = "RuntimePart";
  public static readonly activateMember: "activateAsync" = "activateAsync";
  public static readonly deactivateMember: "deactivateAsync" = "deactivateAsync";
  public static readonly methodsKind: string = "methods";
  public static readonly eventsKind: string = "events";
  public static readonly commandsKind: string = "commands";
  public static readonly notificationsKind: string = "notifications";
  public static readonly notificationLimit: number = 100;
  public static readonly settingsKind: string = "settings";
  public static readonly themeSetting: string = "theme";
  public static readonly modeSetting: string = "mode";
  public static readonly interfaceFontSetting: string = "interfaceFont";
  public static readonly codeFontSetting: string = "codeFont";
  public static readonly panelSizeSetting: string = "panelSize";
  public static readonly messageSizeSetting: string = "messageSize";
  public static readonly codeSizeSetting: string = "codeSize";
  public static readonly leftDockStyleSetting: string = "leftDockStyle";
  public static readonly rightDockStyleSetting: string = "rightDockStyle";
  public static readonly previewTabsSetting: string = "previewTabs";
  public static readonly menuBarSetting: string = "menuBar";
  public static readonly doNotDisturbSetting: string = "doNotDisturb";
  public static readonly mutedModulesSetting: string = "mutedModules";
  public static readonly appearancePage: string = "Appearance";
  public static readonly notificationsPage: string = "Notifications";
  public static readonly themeGroup: string = "Theme";
  public static readonly textGroup: string = "Text";
  public static readonly layoutGroup: string = "Layout";
  public static readonly notificationsGroup: string = "Notifications";
  public static readonly defaultThemeId: string = "shell.default";
  public static readonly defaultThemeTitle: string = "Default";
  public static readonly themeTitle: string = "Theme";
  public static readonly themeDescription: string = `The colors and look of ${Resources.productName}.`;
  public static readonly modeTitle: string = "Mode";
  public static readonly modeDescription: string = "Light, dark, or following the operating system.";
  public static readonly modeOptions: readonly (readonly [string, string])[] = [["Light", "Light"], ["Dark", "Dark"], ["System", "System"]];
  public static readonly defaultMode: string = "System";
  public static readonly leftDockStyleTitle: string = "Left dock";
  public static readonly leftDockStyleDescription: string = "Show the left dock's views as tabs, or as icons along the window's left edge.";
  public static readonly rightDockStyleTitle: string = "Right dock";
  public static readonly rightDockStyleDescription: string = "Show the right dock's views as tabs, or as icons along the window's right edge.";
  public static readonly previewTabsTitle: string = "Preview tabs";
  public static readonly previewTabsDescription: string = "Open a document as a preview tab that the next preview replaces until it is kept. Off opens every document as an ordinary tab.";
  public static readonly dockStyleOptions: readonly (readonly [string, string])[] = [["Tabs", "Tabs"], ["Icons", "Icons"]];
  public static readonly defaultDockStyle: string = "Tabs";
  public static readonly menuBarTitle: string = "Menus";
  public static readonly menuBarDescription: string = "On Windows and Linux, show the menus as a bar in the window row, as a menu button, or not at all. A menu bar that does not fit the window row folds into the menu button. macOS keeps its menu bar.";
  public static readonly menuBarOptions: readonly (readonly [string, string])[] = [["Inline", "Menu bar"], ["Button", "Menu button"], ["Hidden", "Hidden"]];
  public static readonly defaultMenuBar: string = "Inline";
  public static readonly interfaceFontTitle: string = "Interface font";
  public static readonly interfaceFontDescription: string = "The font of menus, panels and prose.";
  public static readonly codeFontTitle: string = "Code font";
  public static readonly codeFontDescription: string = "The font of code and terminals.";
  public static readonly fontOptions: readonly (readonly [string, string])[] = [["Noldova", "Noldova"], ["System", "System"]];
  public static readonly defaultFont: string = "Noldova";
  public static readonly panelSizeTitle: string = "Interface text size";
  public static readonly panelSizeDescription: string = "The size of interface text, in pixels; spacing and controls scale with it.";
  public static readonly messageSizeTitle: string = "Message text size";
  public static readonly messageSizeDescription: string = "The size of prose you read and write, in pixels.";
  public static readonly codeSizeTitle: string = "Code text size";
  public static readonly codeSizeDescription: string = "The size of code, in pixels.";
  public static readonly minimumTextSize: number = 12;
  public static readonly maximumTextSize: number = 18;
  public static readonly textSizeStep: number = 1;
  public static readonly defaultPanelSize: number = 13;
  public static readonly defaultMessageSize: number = 14;
  public static readonly defaultCodeSize: number = 14;
  public static readonly doNotDisturbTitle: string = "Do not disturb";
  public static readonly doNotDisturbDescription: string = "Holds back notifications on this device; they still collect in the list.";
  public static readonly mutedModulesTitle: string = "Notifications from modules";
  public static readonly mutedModulesDescription: string = "A module turned off still adds its notifications to the list, without toasts or operating system notifications.";
  public static readonly settingScopesKind: string = "settingScopes";
  public static readonly settingsField: string = "settings";
  public static readonly nameParameterName: string = "name";
  public static readonly defaultKeyParameterName: string = "defaultKey";
  public static readonly isCheckedParameterName: string = "isChecked";
  public static readonly dataDirectoryVariable: string = "__DATA_DIRECTORY_VARIABLE__";
  public static readonly defaultDataFolder: readonly string[] = "__DATA_FOLDER__".split(Resources.folderSeparator);
  public static readonly developmentDataFolder: readonly string[] = ["_build", "data"];
  public static readonly preShellData: string = `This data directory holds data from a ${Resources.productName} release that predates the shell; move it aside to continue.`;
  public static readonly productVersion: string = "__VERSION__";
  public static readonly build: string = "__BUILD__";
  public static readonly linuxPlatform: string = "linux";
  public static readonly loopbackHost: string = "127.0.0.1";
  public static readonly tcpEndpointPrefix: string = "tcp://127.0.0.1:";
  public static readonly portPattern: RegExp = /^[1-9]\d{0,4}$/;
  public static readonly maximumPort: number = 65_535;
  public static readonly socketFileName: string = "runtime.sock";
  public static readonly maximumSocketPathLength: number = 103;
  public static readonly tokenByteLength: number = 32;
  public static readonly tokenDigestAlgorithm: string = "sha256";
  public static readonly hexEncoding: BufferEncoding = "hex";
  public static readonly dataEvent: string = "data";
  public static readonly errorEvent: string = "error";
  public static readonly closeEvent: string = "close";
  public static readonly connectEvent: string = "connect";
  public static readonly listeningEvent: string = "listening";
  public static readonly spawnEvent: string = "spawn";
  public static readonly abortEvent: string = "abort";
  public static readonly ignoredOutput: "ignore" = "ignore";
  public static readonly requestIdSeparator: string = ":";
  public static readonly maximumFrameLength: number = 16 * 1024 * 1024;
  public static readonly handshakeTimeout: number = 5_000;
  public static readonly defaultRequestTimeout: number = 600_000;
  public static readonly maximumRequestTimeout: number = 3_600_000;
  public static readonly answerGrace: number = 5_000;
  public static readonly closeGrace: number = 2_000;
  public static readonly idleGrace: number = 30_000;
  public static readonly takeover: number = 5_000;
  public static readonly takeoverInterval: number = 50;
  public static readonly launchTimeout: number = 20_000;
  public static readonly launchLimit: number = 60_000;
  public static readonly launchPollInterval: number = 100;
  public static readonly productVersionPattern: RegExp = /^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$/;
  public static readonly positiveIntegerPattern: RegExp = /^[1-9]\d{0,9}$/;
  public static readonly versionSeparator: string = ".";
  public static readonly versionPartWidth: number = 9;
  public static readonly versionPadding: string = "0";
  public static readonly dataDirectoryArgument: string = "--data-dir";
  public static readonly idleGraceArgument: string = "--idle-grace";
  public static readonly stopSignals: readonly NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  public static readonly usageExitCode: number = 2;
  public static readonly ownedExitCode: number = 3;
  public static readonly failureExitCode: number = 1;
  public static readonly launchShell: string = "/bin/bash";
  public static readonly launchDescriptors: string = "/proc/self/fd";
  public static readonly launchShellArguments: readonly string[] = [
    "--noprofile",
    "--norc",
    "-p",
    "-c",
    "set -e; shopt -s failglob; for descriptor in /proc/self/fd/*; do descriptor=${descriptor##*/}; if (( descriptor > 2 )); then exec {descriptor}>&-; fi; done; exec -- \"$@\"",
    `${Resources.productSlug}-launch`
  ];
  public static readonly stoppedByIdle: string = "idle";
  public static readonly stoppedByRequest: string = "request";
  public static readonly stoppedBySignal: string = "signal";
  public static readonly portParameterName: string = "port";
  public static readonly pathParameterName: string = "path";
  public static readonly textParameterName: string = "text";
  public static readonly descriptionParameterName: string = "description";
  public static readonly idleGraceParameterName: string = "idleGraceMilliseconds";
  public static readonly maximumFrameLengthParameterName: string = "maximumFrameLength";
  public static readonly handshakeTimeoutParameterName: string = "handshakeTimeout";
  public static readonly defaultRequestTimeoutParameterName: string = "defaultRequestTimeout";
  public static readonly maximumRequestTimeoutParameterName: string = "maximumRequestTimeout";
  public static readonly callTimeoutParameterName: string = "callTimeout";
  public static readonly answerGraceParameterName: string = "answerGrace";
  public static readonly clientNameParameterName: string = "clientName";
  public static readonly clientParameterName: string = "client";
  public static readonly entryPathParameterName: string = "entryPath";
  public static readonly launchTimeoutParameterName: string = "launchTimeout";
  public static readonly launchLimitParameterName: string = "launchLimit";
  public static readonly pollIntervalParameterName: string = "pollInterval";
  public static readonly argumentsParameterName: string = "arguments";
  public static readonly portOutOfRange: string = "A port must be from 1 to 65535.";
  public static readonly socketPathNotAbsolute: string = "A local socket's path must be absolute.";
  public static readonly defaultRequestTimeoutTooLong: string = "The default time limit of a request cannot exceed its maximum.";
  public static readonly launchLimitTooShort: string = "The limit while the data directory is owned cannot be shorter than the launch timeout.";
  public static readonly endpointUnavailable: string = "The runtime's local endpoint has no address.";
  public static readonly handshakeRequired: string = "A connection must begin with a handshake.";
  public static readonly unauthorized: string = "The capability token is not valid for this runtime.";
  public static readonly buildMismatch: string = `Another build of ${Resources.productName} owns this data directory.`;
  public static readonly otherBuildMayOnlyStop: string = "A connection from another build may only ask the runtime to stop.";
  public static readonly unexpectedMessage: string = "Only requests and cancellations may follow the handshake.";
  public static readonly invalidFrame: string = "The frame is not a valid message.";
  public static readonly internalFailure: string = "The runtime failed to handle the request.";
  public static readonly deadlineExceeded: string = "The request did not finish within its time limit.";
  public static readonly cancelled: string = "The request was cancelled.";
  public static readonly workInProgress: string = "Work is in progress; stopping now would interrupt it.";
  public static readonly clientClosed: string = "The connection to the runtime is closed.";
  public static readonly handshakeTimedOut: string = "The runtime did not answer the handshake in time.";
  public static readonly handshakeRefused: string = "The runtime closed the connection during the handshake.";
  public static readonly handshakeIdentityMismatch: string = "The runtime answered the handshake with another build's identity.";
  public static readonly launchTimedOut: string = "The runtime did not start in time.";
  public static readonly runtimeExitedWithoutReason: string = "The runtime exited while starting and left no reason.";
  public static readonly startLogArgument: string = "--start-log";
  public static readonly startLogNamePattern: RegExp = /^start-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.log$/;
  public static readonly startLogTailLength: number = 4096;
  public static readonly homeAbbreviation: string = "~";
  public static readonly redactedValue: string = "[redacted]";
  public static readonly opaqueValuePattern: RegExp = /[A-Za-z0-9+_=-]{32,}/g;
  public static readonly pathSeparatorPattern: RegExp = /[\\/]/;
  public static readonly pathSeparatorSource: string = "[\\\\/]";
  public static readonly regularExpressionSyntaxPattern: RegExp = /[.*+?^${}()|[\]\\]/g;
  public static readonly escapedMatch: string = "\\$&";
  public static readonly caseInsensitiveGlobalFlags: string = "gi";
  public static readonly writeFlag: string = "w";
  public static readonly appendFlag: string = "a";
  public static readonly uncaughtExceptionEvent: string = "uncaughtExceptionMonitor";
  public static readonly startLogNameParameterName: string = "startLog";
  public static readonly stopTimedOut: string = "The other build's runtime did not stop in time.";
  public static readonly launchShellUnavailable: string = "Starting a program on Linux requires executable Bash at /bin/bash. Install Bash or restore its execute permissions.";
  public static readonly launchDescriptorsUnavailable: string = "Starting a program on Linux requires access to /proc/self/fd. Ensure procfs is mounted at /proc and this process can read and traverse its descriptor directory.";
  public static readonly dataDirectoryRequired: string = "The --data-dir argument is required.";
  public static readonly usage: string = "Usage: runtime-entry --data-dir <absolute path> [--idle-grace <milliseconds>] [--start-log <start log name>]";

  public static formatDiscoveryVersion(version: unknown): string {
    return `The discovery metadata has the unsupported format version ${String(version)}.`;
  }

  public static formatDiscoveryField(name: string): string {
    return `The discovery metadata's ${name} is missing or invalid.`;
  }

  public static formatDeclarationsVersion(version: unknown): string {
    return `The module declarations have the unsupported format version ${String(version)}.`;
  }

  public static formatDeclarationField(name: string): string {
    return `A module declaration's ${name} is missing or invalid.`;
  }

  public static formatDeclarationsUnreadable(file: string, reason: string): string {
    return `The module declarations ${file} are not valid: ${reason}`;
  }

  public static formatDiscoveryUnreadable(file: string, reason: string): string {
    return `The discovery file ${file} is not valid: ${reason}`;
  }

  public static formatOwned(root: string): string {
    return `Another ${Resources.productName} runtime owns the data directory ${root}.`;
  }

  public static formatPreShellData(root: string, entries: readonly string[]): string {
    return `The data directory ${root} holds data from a release before the shell: ${entries.join(", ")}.`;
  }

  public static formatMigrationFailed(database: string, id: string): string {
    return `The migration ${id} of the ${database} failed and was rolled back.`;
  }

  public static formatHistoryNotRecognized(database: string): string {
    return `The ${database}'s migration history is not one this build recognizes.`;
  }

  public static formatHistoryNewer(database: string): string {
    return `The ${database} was written by a newer build.`;
  }

  public static formatTablesWithoutHistory(database: string): string {
    return `The ${database} has tables but no migration history.`;
  }

  public static formatModuleDatabaseName(moduleId: string): string {
    return `database of the module ${moduleId}`;
  }

  public static formatNoModuleDatabase(moduleId: string): string {
    return `The module ${moduleId} has no database, because its runtime part declares no migrations.`;
  }

  public static formatAccessGrant(securityIdentifier: string): string {
    return `*${securityIdentifier}:(OI)(CI)F`;
  }

  public static formatFolderNotPrivate(folder: string, access: string): string {
    return `The folder ${folder} is still open to others: ${access}`;
  }

  public static formatCommandFailed(command: string, output: string): string {
    return `${command} failed: ${output}`;
  }

  public static formatIdentityUnreadable(output: string): string {
    return `The current user's security identifier could not be read from: ${output}`;
  }

  public static formatBackupName(owner: string, position: number, timestamp: string): string {
    return `${owner}${Resources.backupInfix}${position}-${timestamp}${Resources.backupExtension}`;
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

  public static formatEndpointInvalid(text: string): string {
    return `"${text}" is not a ${Resources.productName} endpoint.`;
  }

  public static formatSocketPathTooLong(socketPath: string): string {
    return `The local socket path "${socketPath}" exceeds ${Resources.maximumSocketPathLength} bytes; use a data directory with a shorter path.`;
  }

  public static formatCommandRegistered(name: string): string {
    return `The command ${name} is already registered.`;
  }

  public static formatNotificationKindChanged(id: number, kind: string): string {
    return `Notification ${id} is of the kind ${kind}, which an update keeps.`;
  }

  public static formatNotificationModuleInactive(moduleId: string, kind: string): string {
    return `The notification kind ${kind} belongs to ${moduleId}, which is not an active module.`;
  }

  public static formatNotificationCommandNotAllowed(moduleId: string, command: string): string {
    return `The module ${moduleId} may not offer the command ${command} in a notification; it must be its own or a dependency's.`;
  }

  public static formatNotificationNotFound(id: number): string {
    return `Notification ${id} is gone; it was dismissed or its module stopped.`;
  }

  public static formatCommandNotCheckable(name: string): string {
    return `The command ${name} is not checkable; give it a checked state when it is created.`;
  }

  public static formatCommandNotEnabled(name: string): string {
    return `The command ${name} is not enabled now.`;
  }

  public static formatCommandNotFound(name: string): string {
    return `The command ${name} is not registered; its module may not be active.`;
  }

  public static formatMethodRegistered(name: string): string {
    return `The method ${name} is already registered.`;
  }

  public static formatEventDeclared(name: string): string {
    return `The event ${name} is already declared.`;
  }

  public static formatServicePublished(name: string): string {
    return `The service ${name} is already published.`;
  }

  public static formatSettingUnknown(name: string): string {
    return `No setting named ${name} is declared.`;
  }

  public static formatSettingValueInvalid(name: string): string {
    return `The value is not one the setting ${name} accepts.`;
  }

  public static formatSettingNeedsDevice(name: string): string {
    return `The setting ${name} is kept per device and needs a device, without a scope.`;
  }

  public static formatSettingScopeNotAllowed(name: string, scope: string): string {
    return `The setting ${name} cannot be set for the scope ${scope}.`;
  }

  public static formatSettingNotReadable(moduleId: string, name: string): string {
    return `The module ${moduleId} may only read its own settings, its dependencies' and the shell's, not ${name}.`;
  }

  public static formatSettingNotWritable(moduleId: string, name: string): string {
    return `The module ${moduleId} may only change its own settings, not ${name}.`;
  }

  public static formatSettingScopeNotOwned(moduleId: string, scope: string): string {
    return `The module ${moduleId} may only describe the scopes it declares, its dependencies' as parents, not ${scope}.`;
  }

  public static formatSettingValueIgnored(name: string, scope: string, device: string): string {
    return `The stored value of the setting ${name} for the scope "${scope}" and device "${device}" no longer fits its definition; it is kept and ignored.\n`;
  }

  public static formatSettingOwnerInvalid(moduleId: string, name: string): string {
    return `The module ${moduleId} declares the setting ${name}, which it does not own.`;
  }

  public static formatNotContributed(moduleId: string, kind: string, name: string): string {
    return `The module ${moduleId} does not declare ${name} among its ${kind}.`;
  }

  public static formatServiceNotOwned(moduleId: string, name: string): string {
    return `The module ${moduleId} may publish services only under its own id, not ${name}.`;
  }

  public static formatServiceNotAllowed(moduleId: string, name: string): string {
    return `The module ${moduleId} may use only the shell's services and those of the modules it depends on, not ${name}.`;
  }

  public static formatServiceMissing(name: string): string {
    return `No service ${name} is published.`;
  }

  public static formatServiceType(name: string, type: string): string {
    return `The service ${name} is not a ${type}.`;
  }

  public static formatModuleDiagnostic(moduleId: string, cause: string, detail: string): string {
    return `The module ${moduleId}: ${cause}\n${detail}\n`;
  }

  public static formatModuleLogLine(moduleId: string, line: string): string {
    return `${moduleId}: ${line}\n`;
  }

  public static formatModuleBlocked(dependency: string): string {
    return `It depends on ${dependency}, which is not active.`;
  }

  public static formatEventWithdrawn(name: string): string {
    return `The event ${name} is no longer declared.`;
  }

  public static formatUnknownMethod(name: string): string {
    return `The method ${name} is not registered.`;
  }

  public static formatDuplicateRequest(id: string): string {
    return `A request with the id ${id} is already running on this connection.`;
  }

  public static formatNoAnswer(method: string): string {
    return `The runtime did not answer ${method} in time.`;
  }

  public static formatUnreachable(endpoint: string): string {
    return `The runtime at ${endpoint} cannot be reached.`;
  }

  public static formatHandover(productVersion: string, executablePath: string): string {
    return `${Resources.productName} ${productVersion} at ${executablePath} owns this data directory and is newer; open that ${Resources.productName} instead.`;
  }

  public static formatNoRuntime(root: string): string {
    return `No runtime is running for ${root}.`;
  }

  public static formatBuildMismatch(productVersion: string, executablePath: string): string {
    return `${Resources.productName} ${productVersion} at ${executablePath} owns this data directory; it is another build, and taking it over was not asked for.`;
  }

  public static formatWorkInProgress(descriptions: readonly string[]): string {
    return `Work is in progress: ${descriptions.join("; ")}.`;
  }

  public static formatProductVersionInvalid(version: string): string {
    return `"${version}" is not a product version of the form major.minor.patch.`;
  }

  public static formatStopRefused(message: string): string {
    return `The other build's runtime refused to stop: ${message}`;
  }

  public static formatRuntimeExited(reason: string): string {
    return `The runtime exited while starting: ${reason}`;
  }

  public static formatLaunchLimitReached(milliseconds: number): string {
    return `A runtime held the data directory but was not reachable within ${milliseconds / 1000} s.`;
  }

  public static formatStartLogNameInvalid(name: string): string {
    return `"${name}" is not the name of a start log.`;
  }

  public static formatRuntimeLogUnavailable(reason: string): string {
    return `The runtime's log could not be written, so it is no longer written to: ${reason}`;
  }

  public static formatStartLogName(unique: string): string {
    return `${Resources.startLogPrefix}${unique}${Resources.startLogExtension}`;
  }

  public static formatStartFailed(executablePath: string): string {
    return `The runtime could not be started with ${executablePath}.`;
  }

  public static formatArgumentWithoutValue(name: string): string {
    return `The argument ${name} needs a value.`;
  }

  public static formatPreShellFound(location: string): string {
    return `The data directory ${location} holds data from a ${Resources.productName} release that predates the shell.`;
  }

  public static formatMoveAsideFailed(message: string): string {
    return `The runtime could not move the old data aside: ${message}`;
  }

  public static formatArgumentInvalid(name: string, value: string): string {
    return `The argument ${name} ${value} is not valid.`;
  }

  public static formatReadWindowState(column: string): string {
    return `SELECT ${column} AS value FROM window_states WHERE device = ? AND window = ?`;
  }

  public static formatWriteWindowState(column: string): string {
    return `INSERT INTO window_states (device, window, ${column}) VALUES (?, ?, ?) ON CONFLICT (device, window) DO UPDATE SET ${column} = excluded.${column}`;
  }
}
