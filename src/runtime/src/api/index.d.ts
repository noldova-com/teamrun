/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Socket } from "node:net";

import type { IEventListener, ProviderRegistry, RequestDispatcher } from "@noldova/teamrun-core";
import type { Exception } from "@noldova/teamrun-foundation-exceptions";
import type { JsonObject, JsonValue } from "@noldova/teamrun-foundation-json";
import type { ServiceResponseInfo } from "@noldova/teamrun-foundation-services";
import type { Event, IRequestDispatcher, ProtocolVersion, Response, WireMessage } from "@noldova/teamrun-protocol";
import type { ExecutableLocator, IProcessTracker } from "@noldova/teamrun-providers";

/**
 * Process roles participating in one installation's update.
 */
export declare enum InstallationRole {
  /**
   * A desktop owning renderer state.
   */
  Desktop = "Desktop",
  /**
   * A background runtime owning provider and database handles.
   */
  Runtime = "Runtime",
}

/**
 * Persistent admission barrier phase.
 */
export declare enum InstallationUpdatePhase {
  /**
   * Renewable preparation lease; abandoned leases expire.
   */
  Preparing = "Preparing",
  /**
   * Installer handoff; only the target-version desktop can reopen admission automatically.
   */
  Installing = "Installing",
}

/**
 * Registered process identity and its private local control endpoint. Never send tokens to a renderer or log them.
 */
export declare class InstallationMember {
  /**
   * Unique process registration id.
   */
  public readonly id: string;
  /**
   * Process responsibility.
   */
  public readonly role: InstallationRole;
  /**
   * Native process id.
   */
  public readonly processId: number;
  /**
   * Data directory owned or viewed by this process.
   */
  public readonly dataDirectory: string;
  /**
   * Process product version.
   */
  public readonly productVersion: string;
  /**
   * Ready control endpoint, or null while starting.
   */
  public readonly endpoint: Endpoint | null;
  /**
   * Local capability token, or null while starting.
   */
  public readonly token: string | null;

  /**
   * Creates a registration; null endpoint/token must be paired.
   * @param id Nonblank instance id.
   * @param role Desktop or runtime.
   * @param processId Positive native process id.
   * @param dataDirectory Nonblank data path.
   * @param productVersion Nonblank version.
   * @param endpoint Control endpoint, or null before listening.
   * @param token Nonblank capability token, or null before listening.
   * @throws ArgumentException for blank fields or inconsistent readiness.
   * @throws ArgumentOutOfRangeException for an invalid process id.
   */
  public constructor(id: string, role: InstallationRole, processId: number, dataDirectory: string, productVersion: string, endpoint: Endpoint | null, token: string | null);

  /**
   * Marks a starting registration ready without changing its identity.
   * @param endpoint Bound endpoint.
   * @param token Nonblank capability token.
   * @returns Ready registration.
   */
  public withEndpoint(endpoint: Endpoint, token: string): InstallationMember;

  /**
   * Validates a persisted registration.
   * @param value Untrusted JSON value.
   * @returns Validated identity.
   * @throws JsonException or ArgumentException for malformed fields.
   */
  public static fromJson(value: unknown): InstallationMember;

  /**
   * Serializes into private local storage only.
   * @returns JSON including the local capability; never log it.
   */
  public toJson(): JsonObject;
}

/**
 * One installation update owner, target version and lease.
 */
export declare class InstallationUpdate {
  /**
   * Unique operation id.
   */
  public readonly id: string;
  /**
   * Registered desktop owning the operation.
   */
  public readonly ownerId: string;
  /**
   * Version allowed to reopen admission after installation.
   */
  public readonly targetVersion: string;
  /**
   * Preparing or installing.
   */
  public readonly phase: InstallationUpdatePhase;
  /**
   * Preparation lease deadline in Unix milliseconds; installing barriers do not expire.
   */
  public readonly expiresAt: number;

  /**
   * Creates the update ownership record.
   * @param id Nonblank operation id.
   * @param ownerId Nonblank member id.
   * @param targetVersion Nonblank target product version.
   * @param phase Barrier phase.
   * @param expiresAt Positive Unix millisecond deadline.
   * @throws ArgumentException or ArgumentOutOfRangeException for invalid values.
   */
  public constructor(id: string, ownerId: string, targetVersion: string, phase: InstallationUpdatePhase, expiresAt: number);

  /**
   * Validates persisted ownership.
   * @param value Untrusted JSON.
   * @returns Validated record.
   * @throws JsonException or ArgumentException for invalid input.
   */
  public static fromJson(value: unknown): InstallationUpdate;

  /**
   * Serializes ownership.
   * @returns Plain JSON.
   */
  public toJson(): JsonObject;
}

/**
 * Uses short SQLite transactions to serialize process registration and installer admission across processes.
 * This control registry is separate from conversation data. Connections are closed after every operation.
 */
export declare class InstallationRegistry {
  /**
   * Absolute control database path.
   */
  public readonly path: string;

  /**
   * Creates the control-store owner without opening the database.
   * @param path Nonblank registry path.
   * @param probe Optional process-liveness observer; defaults to native probing.
   * @throws ArgumentException for a blank path.
   */
  public constructor(path: string, probe?: ProcessProbe);

  /**
   * Resolves a packaged entry's installation by canonical executable path; source entries have no installation.
   * @param entryPath Entry within an app.asar, or a development path.
   * @param executable Executable whose path identifies the installation.
   * @param homeDirectory Current user's home directory.
   * @returns Registry, or null for a source entry.
   * @throws Error if a packaged executable cannot be resolved.
   */
  public static forEntry(entryPath: string, executable: string, homeDirectory: string): InstallationRegistry | null;

  /**
   * Reads a data directory's installation id without accepting arbitrary registry paths.
   * @param dataDirectory Data directory to inspect.
   * @param homeDirectory Current user's home directory.
   * @returns Linked registry, or null if no link exists.
   * @throws InvalidOperationException for an invalid id; filesystem errors are propagated.
   */
  public static forDataDirectory(dataDirectory: string, homeDirectory: string): InstallationRegistry | null;

  /**
   * Links a data directory after its runtime has acquired ownership.
   * @param dataDirectory Owned data directory.
   * @throws InvalidOperationException if the registry's parent is not a valid hashed installation id.
   */
  public linkDataDirectory(dataDirectory: string): void;

  /**
   * Atomically registers a process unless update admission is closed. A target-version desktop completes an installing barrier.
   * @param member New process identity.
   * @throws InvalidOperationException while an update blocks this version/role.
   */
  public register(member: InstallationMember): void;

  /**
   * Publishes the endpoint of an already registered starting process.
   * @param member Ready identity with the original id.
   * @throws InvalidOperationException if that registration disappeared.
   */
  public activate(member: InstallationMember): void;

  /**
   * Removes a departing process registration.
   * @param id Registration id.
   */
  public unregister(id: string): void;

  /**
   * Refuses startup while a live preparation or installing barrier exists.
   * @throws InvalidOperationException while admission is closed.
   */
  public assertLaunchAllowed(): void;

  /**
   * Acquires preparation ownership and snapshots all live, ready participants atomically with respect to registration.
   * @param update New preparation lease owned by a registered desktop.
   * @returns Live participants; dead registrations are removed.
   * @throws InvalidOperationException for an existing update, missing owner or starting participant.
   */
  public begin(update: InstallationUpdate): readonly InstallationMember[];

  /**
   * Renews preparation before its deadline.
   * @param update Replacement record with the same operation id.
   * @throws InvalidOperationException if ownership expired or installation began.
   */
  public renew(update: InstallationUpdate): void;

  /**
   * Makes the gate persistent across updater process exit.
   * @param id Current operation id.
   * @throws InvalidOperationException if the preparation lease was lost.
   */
  public markInstalling(id: string): void;

  /**
   * Releases only the named operation after a failed attempt.
   * @param id Owned operation id.
   */
  public release(id: string): void;

  /**
   * Checks that preparation still owns the live lease.
   * @param id Operation id.
   * @returns Whether the matching preparation remains active.
   */
  public isPreparing(id: string): boolean;

  /**
   * Checks a live preparing or installing owner.
   * @param id Operation id.
   * @returns Whether the same operation owns admission.
   */
  public ownsUpdate(id: string): boolean;

  /**
   * Checks persistent installer handoff ownership.
   * @param id Operation id.
   * @returns Whether installation is committed for this operation.
   */
  public isInstalling(id: string): boolean;

  /**
   * Lists live process registrations, pruning dead processes.
   * @returns Current registrations, including any still starting.
   */
  public members(): readonly InstallationMember[];
}

/**
 * Separates closing runtime-owned resources from closing the endpoint that carries the acknowledgement.
 */
export interface IUpdateShutdown {
  /**
   * Closes provider and database resources; called only while idle admission is held.
   * @throws Error if clean resource shutdown cannot be confirmed.
   */
  prepareUpdateShutdown(): Promise<void>;

  /**
   * Releases endpoint and process ownership after acknowledgement or failed preparation.
   */
  finishUpdateShutdown(): Promise<void>;
}

/**
 * How the runtime listens: a loopback TCP port or a local socket (a Unix socket path, a named
 * pipe on Windows).
 */
export declare enum EndpointKind {
  /**
   * A TCP port on `127.0.0.1`.
   */
  Tcp = "Tcp",
  /**
   * A local socket path.
   */
  Socket = "Socket",
}

/**
 * The client could not connect to the runtime, was refused, or lost the connection.
 */
export declare class ConnectionException extends Exception {
  /**
   * The runtime's refusal, or `null` when the failure is local (socket error, timeout, closed).
   */
  public readonly info: ServiceResponseInfo | null;

  /**
   * Initializes the exception.
   * @param message What happened.
   * @param info The runtime's refusal, or `null`.
   */
  public constructor(message: string, info: ServiceResponseInfo | null);
}

/**
 * An operation was requested in a state that does not allow it.
 */
export declare class InvalidOperationException extends Exception {
  /**
   * Initializes the exception.
   * @param message Why the operation is not allowed.
   */
  public constructor(message: string);
}

/**
 * The runtime process could not be started or did not publish its endpoint in time.
 */
export declare class LaunchException extends Exception {
  /**
   * Initializes the exception with the message `The runtime could not be started: <reason>`.
   * @param reason Why.
   */
  public constructor(reason: string);
}

/**
 * Another runtime already serves the data directory.
 */
export declare class RuntimeAlreadyRunningException extends Exception {
  /**
   * The running runtime's lock.
   */
  public readonly lock: RuntimeLock;

  /**
   * Initializes the exception.
   * @param lock The running runtime's lock.
   */
  public constructor(lock: RuntimeLock);
}

/**
 * Something the idle monitor watches and stops.
 */
export interface IIdleParticipant {
  /**
   * Whether nothing is going on: no clients and no running turns.
   */
  readonly isIdle: boolean;

  /**
   * Called once the participant stayed idle for the grace period.
   */
  handleIdle(): void;
}

/**
 * Receives what a runtime client hears from the runtime.
 */
export interface IRuntimeClientListener {
  /**
   * Handles an event the runtime published.
   * @param event The event.
   */
  onEvent(event: Event): void;

  /**
   * Handles the loss of the connection; called once.
   */
  onDisconnected(): void;
}

/**
 * Receives session-count changes of a runtime server.
 */
export interface IServerListener {
  /**
   * Observes a successfully flushed ordinary response; endpoint owners may then exit without dropping its acknowledgement.
   * @param request Request whose response was written.
   */
  onResponseSent?(request: import("@noldova/teamrun-protocol").Request): void;

  /**
   * Handles a change in the number of connected sessions.
   * @param count The number of sessions, authenticated or not.
   */
  onSessionCountChanged(count: number): void;
}

/**
 * Receives the lines and the end of a client session.
 */
export interface ISessionListener {
  /**
   * Handles one line the client sent.
   * @param session The session.
   * @param line The line, trimmed and non-blank.
   */
  onLine(session: ClientSession, line: string): void;

  /**
   * Handles the session's end; called once.
   * @param session The session.
   */
  onClosed(session: ClientSession): void;
}

/**
 * Where a runtime listens.
 */
export declare class Endpoint {
  /**
   * The endpoint's kind.
   */
  public readonly kind: EndpointKind;
  /**
   * The TCP port, or `null` for a socket endpoint.
   */
  public readonly port: number | null;
  /**
   * The socket path, or `null` for a TCP endpoint.
   */
  public readonly path: string | null;

  /**
   * Initializes the endpoint.
   * @param kind The kind.
   * @param port The port, or `null`.
   * @param path The path, or `null`.
   * @throws ArgumentException when the kind and the values disagree or the path is blank.
   * @throws ArgumentOutOfRangeException when the port is not a positive integer.
   */
  public constructor(kind: EndpointKind, port: number | null, path: string | null);

  /**
   * Creates a loopback TCP endpoint.
   * @param port The port.
   * @returns The endpoint.
   */
  public static tcp(port: number): Endpoint;

  /**
   * Creates a socket endpoint.
   * @param path The socket path.
   * @returns The endpoint.
   */
  public static socket(path: string): Endpoint;

  /**
   * Reads an endpoint from JSON.
   * @param value The JSON value.
   * @param path The value's path for error messages.
   * @returns The endpoint.
   * @throws JsonException when the kind is missing or unknown.
   */
  public static fromJson(value: unknown, path?: string): Endpoint;

  /**
   * Describes the endpoint: `127.0.0.1:<port>` or the socket path.
   * @returns The text.
   */
  public describe(): string;

  /**
   * Serializes the endpoint.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * Splits a stream of text into trimmed, non-blank lines.
 */
export declare class LineBuffer {
  /**
   * Appends a chunk and returns the complete lines it finished.
   * @param chunk The chunk.
   * @returns The lines.
   */
  public append(chunk: string): readonly string[];
}

/**
 * A request a runtime client awaits.
 */
export declare class PendingCall {
  /**
   * The request's method.
   */
  public readonly method: string;

  /**
   * Initializes the call.
   * @param method The request's method.
   * @param resolvers The promise resolvers the caller awaits.
   * @param timer The timeout timer, cleared when the call settles.
   */
  public constructor(method: string, resolvers: PromiseWithResolvers<Response>, timer: NodeJS.Timeout);

  /**
   * Resolves the call.
   * @param response The response.
   */
  public complete(response: Response): void;

  /**
   * Rejects the call.
   * @param error The failure.
   */
  public fail(error: Error): void;
}

/**
 * What a running runtime publishes beside its data: its process, endpoint, and capability token.
 */
export declare class RuntimeLock {
  /**
   * The runtime's process id.
   */
  public readonly processId: number;
  /**
   * Where the runtime listens.
   */
  public readonly endpoint: Endpoint;
  /**
   * The capability token a client presents in its hello.
   */
  public readonly token: string;
  /**
   * The protocol version the runtime speaks.
   */
  public readonly protocolVersion: ProtocolVersion;
  /**
   * The runtime's product version.
   */
  public readonly productVersion: string;
  /**
   * When the runtime started, ISO 8601.
   */
  public readonly startedAt: string;

  /**
   * Initializes the lock.
   * @param processId The process id.
   * @param endpoint The endpoint.
   * @param token The capability token.
   * @param protocolVersion The protocol version.
   * @param productVersion The product version.
   * @param startedAt When the runtime started.
   * @throws ArgumentOutOfRangeException when the process id is not a positive integer.
   * @throws ArgumentException when the token, product version, or start time is blank.
   */
  public constructor(processId: number, endpoint: Endpoint, token: string, protocolVersion: ProtocolVersion, productVersion: string, startedAt: string);

  /**
   * Reads a lock from JSON.
   * @param value The JSON value.
   * @param path The value's path for error messages.
   * @returns The lock.
   * @throws JsonException when a field is missing or invalid.
   */
  public static fromJson(value: unknown, path?: string): RuntimeLock;

  /**
   * Serializes the lock.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * How a runtime serves one data directory.
 */
export declare class RuntimeSettings {
  /**
   * The absolute data directory: database, lock, and socket.
   */
  public readonly dataDirectory: string;
  /**
   * The product version the runtime reports.
   */
  public readonly productVersion: string;
  /**
   * How the runtime listens.
   */
  public readonly endpointKind: EndpointKind;
  /**
   * The socket path used for a socket endpoint: a file in the data directory, a named pipe on
   * Windows.
   */
  public readonly socketPath: string;
  /**
   * How long the runtime stays without clients and turns before it stops, or `null` to run
   * until stopped.
   */
  public readonly idleGraceMilliseconds: number | null;

  /**
   * Initializes the settings.
   * @param dataDirectory The absolute data directory.
   * @param productVersion The product version.
   * @param endpointKind How the runtime listens.
   * @param socketPath The socket path.
   * @param idleGraceMilliseconds The idle grace, or `null`.
   * @throws ArgumentException when the directory is blank or relative or a text is blank.
   * @throws ArgumentOutOfRangeException when the grace is not a positive integer.
   */
  public constructor(dataDirectory: string, productVersion: string, endpointKind: EndpointKind, socketPath: string, idleGraceMilliseconds: number | null);

  /**
   * Creates the settings a platform uses: a TCP endpoint and a named pipe path on Windows, a
   * Unix socket in the data directory elsewhere.
   * @param platform The platform, as `process.platform`.
   * @param dataDirectory The absolute data directory.
   * @param productVersion The product version.
   * @param idleGraceMilliseconds The idle grace, or `null`.
   * @returns The settings.
   */
  public static forPlatform(platform: string, dataDirectory: string, productVersion: string, idleGraceMilliseconds: number | null): RuntimeSettings;

  /**
   * Computes the socket path for a data directory.
   * @param windows Whether the platform is Windows.
   * @param dataDirectory The data directory.
   * @returns A named pipe derived from the directory on Windows, `runtime.sock` inside it elsewhere.
   */
  public static createSocketPath(windows: boolean, dataDirectory: string): string;

  /**
   * The lock file path inside the data directory.
   */
  public get lockPath(): string;

  /**
   * The path of the file that records the provider processes started by runtimes.
   */
  public get processesPath(): string;
}

/**
 * The timeouts of runtime clients and launchers, in milliseconds.
 */
/**
 * A provider process a runtime started: its id, its executable, and the runtime's process id.
 */
export declare class TrackedProcess {
  /**
   * The process id.
   */
  public readonly processId: number;
  /**
   * The executable the process runs.
   */
  public readonly executable: string;
  /**
   * The process id of the runtime that started it.
   */
  public readonly runtimeProcessId: number;

  /**
   * Initializes the entry.
   * @param processId The process id.
   * @param executable The executable the process runs.
   * @param runtimeProcessId The process id of the runtime that started it.
   */
  public constructor(processId: number, executable: string, runtimeProcessId: number);

  /**
   * Reads an entry.
   * @param value The JSON value.
   * @returns The entry, or `null` when the value is malformed.
   */
  public static fromJson(value: JsonValue): TrackedProcess | null;

  /**
   * Writes the entry.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * Names a process image through `tasklist` on Windows, `/proc/<pid>/exe` on Linux, and `ps` on other platforms.
 */
export declare class ProcessInspector {
  /**
   * Initializes the inspector.
   * @param platform The platform (`process.platform`).
   * @param run Runs a command and returns its output.
   */
  public constructor(platform: string, run: (executable: string, args: readonly string[]) => string);

  /**
   * Creates the inspector that runs the platform's command.
   * @param platform The platform.
   * @returns The inspector.
   */
  public static fromPlatform(platform: string): ProcessInspector;

  /**
   * Names the executable of a process.
   * @param processId The process id.
   * @returns The executable basename, or `null` when the process is unknown or inaccessible.
   */
  public imageOf(processId: number): string | null;
}

/**
 * The provider processes started by runtimes, in a file beside the lock; the next runtime ends the ones a dead runtime
 * left behind when they still run the recorded executable.
 */
export declare class ProcessRegistry implements IProcessTracker {
  /**
   * Initializes the registry.
   * @param path The file's path.
   * @param runtimeProcessId This runtime's process id, recorded with every process it tracks.
   * @param probe Tells whether a process is alive.
   * @param inspector Names a process's executable.
   */
  public constructor(path: string, runtimeProcessId: number, probe: ProcessProbe, inspector: ProcessInspector);

  /**
   * Records a started process; the unknown process id (0) is ignored.
   * @param processId The process id.
   * @param executable The executable.
   */
  public track(processId: number, executable: string): void;

  /**
   * Forgets a process that ended.
   * @param processId The process id.
   */
  public untrack(processId: number): void;

  /**
   * Ends the leftovers of dead runtimes: recorded processes whose runtime is gone, still alive, and still running the
   * recorded executable. Entries of live runtimes stay; every other entry is dropped.
   * @returns The process ids ended.
   */
  public reapLeftovers(): readonly number[];
}

export declare class RuntimeTimings {
  /**
   * How long the runtime may take to answer a hello.
   */
  public readonly helloTimeout: number;
  /**
   * How long the runtime may take to answer a request.
   */
  public readonly callTimeout: number;
  /**
   * How long a started runtime may take to publish a live lock.
   */
  public readonly launchTimeout: number;
  /**
   * How often the launcher reads the lock while waiting.
   */
  public readonly launchPollInterval: number;

  /**
   * Initializes the timings.
   * @param helloTimeout The hello timeout.
   * @param callTimeout The call timeout.
   * @param launchTimeout The launch timeout.
   * @param launchPollInterval The launch poll interval.
   * @throws ArgumentOutOfRangeException when a value is not a positive integer.
   */
  public constructor(helloTimeout: number, callTimeout: number, launchTimeout: number, launchPollInterval: number);

  /**
   * Returns the production timings.
   * @returns The timings.
   */
  public static createDefault(): RuntimeTimings;
}

/**
 * The package's literals: names, arguments, fields, timings, and messages.
 */
export declare class Resources {
  /**
   * installation link file used by update preparation and recovery.
   */
  public static readonly installationLinkFile: string;
  /**
   * installation id pattern used by update preparation and recovery.
   */
  public static readonly installationIdPattern: RegExp;
  /**
   * installation link invalid used by update preparation and recovery.
   */
  public static readonly installationLinkInvalid: string;
  /**
   * runtime stop requires pause used by update preparation and recovery.
   */
  public static readonly runtimeStopRequiresPause: string;
  /**
   * runtime shutdown failed used by update preparation and recovery.
   */
  public static readonly runtimeShutdownFailed: string;
  /**
   * update shutdown milliseconds used by update preparation and recovery.
   */
  public static readonly updateShutdownMilliseconds: number;
  /**
   * update rejected promise used by update preparation and recovery.
   */
  public static readonly updateRejectedPromise: string;
  /**
   * stopped for update used by update preparation and recovery.
   */
  public static readonly stoppedForUpdate: string;
  /**
   * installation id field used by update preparation and recovery.
   */
  public static readonly installationIdField: string;
  /**
   * installation role field used by update preparation and recovery.
   */
  public static readonly installationRoleField: string;
  /**
   * installation data directory field used by update preparation and recovery.
   */
  public static readonly installationDataDirectoryField: string;
  /**
   * installation owner field used by update preparation and recovery.
   */
  public static readonly installationOwnerField: string;
  /**
   * installation target field used by update preparation and recovery.
   */
  public static readonly installationTargetField: string;
  /**
   * installation phase field used by update preparation and recovery.
   */
  public static readonly installationPhaseField: string;
  /**
   * installation expiry field used by update preparation and recovery.
   */
  public static readonly installationExpiryField: string;
  /**
   * installation endpoint invalid used by update preparation and recovery.
   */
  public static readonly installationEndpointInvalid: string;
  /**
   * installation archive name used by update preparation and recovery.
   */
  public static readonly installationArchiveName: string;
  /**
   * app image variable used by update preparation and recovery.
   */
  public static readonly appImageVariable: string;
  /**
   * installation hash algorithm used by update preparation and recovery.
   */
  public static readonly installationHashAlgorithm: string;
  /**
   * installation hash encoding used by update preparation and recovery.
   */
  public static readonly installationHashEncoding: "hex";
  /**
   * installation registry segments used by update preparation and recovery.
   */
  public static readonly installationRegistrySegments: readonly string[];
  /**
   * installation registry file used by update preparation and recovery.
   */
  public static readonly installationRegistryFile: string;
  /**
   * installation directory mode used by update preparation and recovery.
   */
  public static readonly installationDirectoryMode: number;
  /**
   * installation json column used by update preparation and recovery.
   */
  public static readonly installationJsonColumn: string;
  /**
   * installation schema used by update preparation and recovery.
   */
  public static readonly installationSchema: string;
  /**
   * installation begin used by update preparation and recovery.
   */
  public static readonly installationBegin: string;
  /**
   * installation commit used by update preparation and recovery.
   */
  public static readonly installationCommit: string;
  /**
   * installation rollback used by update preparation and recovery.
   */
  public static readonly installationRollback: string;
  /**
   * installation put member used by update preparation and recovery.
   */
  public static readonly installationPutMember: string;
  /**
   * installation find member used by update preparation and recovery.
   */
  public static readonly installationFindMember: string;
  /**
   * installation delete member used by update preparation and recovery.
   */
  public static readonly installationDeleteMember: string;
  /**
   * installation select members used by update preparation and recovery.
   */
  public static readonly installationSelectMembers: string;
  /**
   * installation select update used by update preparation and recovery.
   */
  public static readonly installationSelectUpdate: string;
  /**
   * installation put update used by update preparation and recovery.
   */
  public static readonly installationPutUpdate: string;
  /**
   * installation delete update used by update preparation and recovery.
   */
  public static readonly installationDeleteUpdate: string;
  /**
   * installation updating used by update preparation and recovery.
   */
  public static readonly installationUpdating: string;
  /**
   * installation member missing used by update preparation and recovery.
   */
  public static readonly installationMemberMissing: string;
  /**
   * installation update lost used by update preparation and recovery.
   */
  public static readonly installationUpdateLost: string;
  /**
   * Runtime request-admission pause lease in milliseconds; 30 seconds.
   */
  public static readonly runtimePauseLeaseMilliseconds: number;
  /**
   * Busy runtime cannot pause.
   */
  public static readonly runtimePauseBusy: string;
  /**
   * New work is refused while paused.
   */
  public static readonly runtimePaused: string;
  /**
   * Another connection owns the pause.
   */
  public static readonly runtimePauseOwned: string;
  /**
   * Invalid runtime control payload.
   */
  public static readonly runtimePausePayloadInvalid: string;
  public static readonly grokProfileSegments: readonly string[];
  public static readonly linuxPlatform: string;
  public static readonly readLinkExecutable: string;
  /**
   * Suffix of the separate runtime ownership database.
   */
  public static readonly ownershipFileSuffix: string;
  /**
   * Acquires the exclusive transaction held throughout a runtime's lifetime.
   */
  public static readonly acquireOwnershipStatement: string;
  public static readonly lockFileName: string;
  /**
   * The file in the data directory that records the provider processes started by runtimes.
   */
  public static readonly processesFileName: string;
  public static readonly win32Platform: string;
  public static readonly taskListExecutable: string;
  public static readonly psExecutable: string;
  public static readonly quote: string;
  /**
   * The process id an adapter records when its spawn failed; never tracked.
   */
  public static readonly unknownProcessId: number;
  public static readonly lockTemporarySuffix: string;
  public static readonly socketFileName: string;
  public static readonly windowsPipePrefix: string;
  public static readonly windowsPlatform: string;
  public static readonly loopbackHost: string;
  public static readonly ephemeralPort: number;
  public static readonly tokenByteLength: number;
  public static readonly hexEncoding: BufferEncoding;
  public static readonly utf8Encoding: BufferEncoding;
  public static readonly lockFileMode: number;
  public static readonly lineSeparator: string;
  public static readonly requestIdSeparator: string;
  public static readonly clientName: string;
  public static readonly clientTitle: string;
  public static readonly pipeHashAlgorithm: string;
  public static readonly pipeHashLength: number;
  public static readonly dataEvent: string;
  public static readonly closeEvent: string;
  public static readonly errorEvent: string;
  public static readonly endEvent: string;
  public static readonly connectEvent: string;
  public static readonly listeningEvent: string;
  public static readonly interruptSignal: NodeJS.Signals;
  public static readonly terminateSignal: NodeJS.Signals;
  public static readonly processIdField: string;
  public static readonly endpointField: string;
  public static readonly kindField: string;
  public static readonly portField: string;
  public static readonly pathField: string;
  public static readonly tokenField: string;
  public static readonly protocolVersionField: string;
  public static readonly productVersionField: string;
  public static readonly startedAtField: string;
  public static readonly dataDirectoryArgument: string;
  public static readonly productVersionArgument: string;
  public static readonly idleGraceArgument: string;
  public static readonly providersArgument: string;
  public static readonly noProvidersValue: string;
  public static readonly stopOnInputEndArgument: string;
  public static readonly defaultProductVersion: string;
  public static readonly helloTimeout: number;
  public static readonly callTimeout: number;
  public static readonly launchTimeout: number;
  public static readonly launchPollInterval: number;
  public static readonly idleGrace: number;
  public static readonly dataDirectoryParameterName: string;
  public static readonly productVersionParameterName: string;
  public static readonly idleGraceParameterName: string;
  public static readonly portParameterName: string;
  public static readonly pathParameterName: string;
  public static readonly socketPathParameterName: string;
  public static readonly tokenParameterName: string;
  public static readonly processIdParameterName: string;
  public static readonly clientNameParameterName: string;
  public static readonly helloTimeoutParameterName: string;
  public static readonly callTimeoutParameterName: string;
  public static readonly launchTimeoutParameterName: string;
  public static readonly launchPollIntervalParameterName: string;
  public static readonly entryPathParameterName: string;
  public static readonly executablePathParameterName: string;
  public static readonly tcpEndpointNeedsPort: string;
  public static readonly socketEndpointNeedsPath: string;
  public static readonly dataDirectoryNotAbsolute: string;
  public static readonly serviceAlreadyStarted: string;
  public static readonly serverAlreadyStarted: string;
  public static readonly helloRequired: string;
  public static readonly tokenRejected: string;
  public static readonly requestRequired: string;
  public static readonly messageUnreadable: string;
  public static readonly clientClosed: string;
  public static readonly helloTimedOut: string;
  public static readonly helloRefused: string;
  /**
   * The runtime's successful hello response does not contain a valid protocol version.
   */
  public static readonly invalidWelcomeVersion: string;
  public static readonly launchTimedOut: string;
  public static readonly dataDirectoryRequired: string;
  public static readonly stoppedByIdle: string;
  public static readonly stoppedBySignal: string;
  public static readonly stoppedByInputEnd: string;

  /**
   * Formats a product-version attachment refusal.
   * @param expected Client product version.
   * @param actual Running runtime product version.
   * @returns A safe explanation with recovery guidance.
   */
  public static formatRuntimeProductMismatch(expected: string, actual: string): string;

  /**
   * Formats the version-mismatch refusal.
   * @param client The client's protocol version.
   * @param runtime The runtime's protocol version.
   * @returns The text.
   */
  public static formatVersionMismatch(client: string, runtime: string): string;

  /**
   * Formats the already-running message.
   * @param processId The running runtime's process id.
   * @param endpoint The running runtime's endpoint description.
   * @returns The text.
   */
  public static formatAlreadyRunning(processId: number, endpoint: string): string;

  /**
   * Formats the message for a request the runtime did not answer in time.
   * @param method The method.
   * @returns The text.
   */
  public static formatCallTimedOut(method: string): string;

  /**
   * Formats the launch-failure message.
   * @param reason Why.
   * @returns The text.
   */
  public static formatLaunchFailed(reason: string): string;

  /**
   * Formats `<host>:<port>`.
   * @param host The host.
   * @param port The port.
   * @returns The text.
   */
  public static formatTcpEndpoint(host: string, port: number): string;

  /**
   * Formats the message for an argument value the entry does not accept.
   * @param argument The argument.
   * @param value The value.
   * @returns The text.
   */
  public static formatUnknownArgumentValue(argument: string, value: string): string;

  /**
   * Composes the `tasklist` arguments that name one process's image.
   */
  public static formatTaskListArguments(processId: number): readonly string[];

  /**
   * Composes the `ps` arguments that name one process's command.
   */
  public static formatPsArguments(processId: number): readonly string[];
}

/**
 * One client connection on the server side: lines in, wire messages out.
 */
export declare class ClientSession {
  /**
   * Initializes the session over an accepted socket.
   * @param socket The socket.
   * @param listener Receives the lines and the end.
   */
  public constructor(socket: Socket, listener: ISessionListener);

  /**
   * Writes an acknowledgement and waits for the socket write callback before releasing endpoint ownership.
   * @param message Response to flush.
   * @returns Completion of the transport write.
   * @throws Error if the socket is closed or writing fails.
   */
  public writeAndFlush(message: WireMessage): Promise<void>;

  /**
   * Whether the hello was accepted.
   */
  public get isAuthenticated(): boolean;

  /**
   * The client's name from its hello, or `null` before authentication.
   */
  public get name(): string | null;

  /**
   * Whether the socket closed.
   */
  public get isClosed(): boolean;

  /**
   * Marks the hello as accepted.
   * @param clientName The client's name.
   */
  public authenticate(clientName: string): void;

  /**
   * Writes a message as one line; ignored once closed.
   * @param message The message.
   */
  public write(message: WireMessage): void;

  /**
   * Closes the socket.
   */
  public close(): void;
}

/**
 * A client of a running runtime: connects, says hello, sends requests, and receives events.
 */
export declare class RuntimeClient {
  /**
   * Connects to a runtime and completes the hello only when the runtime reports the current protocol version.
   * @param endpoint Where the runtime listens.
   * @param token The runtime's capability token.
   * @param clientName The client's name, used in request ids and diagnostics.
   * @param listener Receives events after version validation and receives the disconnection.
   * @param timings The timeouts.
   * @returns The connected client.
   * @throws ArgumentException when the client name is blank.
   * @throws ConnectionException when the socket cannot connect, the runtime refuses the hello
   * (`info` carries the refusal), or does not answer it in time.
   */
  public static connect(endpoint: Endpoint, token: string, clientName: string, listener: IRuntimeClientListener, timings: RuntimeTimings): Promise<RuntimeClient>;

  /**
   * Whether the connection is open.
   */
  public get isConnected(): boolean;

  /**
   * The protocol version the runtime reported in its welcome, or `null` before it.
   */
  public get version(): ProtocolVersion | null;

  /**
   * Sends a request and waits for its response.
   * @param method The method.
   * @param payload The parameters.
   * @returns The response, successful or failed.
   * @throws ConnectionException when the connection is closed or the response does not arrive in
   * time.
   */
  public call(method: string, payload: JsonValue): Promise<Response>;

  /**
   * Closes the connection.
   */
  public close(): void;
}

/**
 * The runtime's endpoint: accepts connections, requires a hello with the capability token and a
 * servable protocol version, dispatches requests, and fans events out to authenticated sessions.
 */
export declare class RuntimeServer implements ISessionListener, IEventListener {
  /**
   * Initializes the server without listening.
   * @param endpointKind How to listen.
   * @param socketPath The socket path for a socket endpoint.
   * @param token The capability token clients must present.
   * @param dispatcher Answers requests.
   * @param listener Receives session-count changes.
   * @param isBusy Reports background provider work that prevents admission pausing; defaults to false.
   * @param pauseLeaseMilliseconds Pause lifetime; defaults to 30 seconds. Repeated owner calls renew it.
   * @throws ArgumentException when the path or the token is blank.
   */
  public constructor(endpointKind: EndpointKind, socketPath: string, token: string, dispatcher: IRequestDispatcher, listener: IServerListener, isBusy?: () => boolean, pauseLeaseMilliseconds?: number, shutdown?: IUpdateShutdown | null);

  /**
   * Where the server listens, or `null` when it does not.
   */
  public get endpoint(): Endpoint | null;

  /**
   * The number of connected sessions.
   */
  public get sessionCount(): number;

  /**
   * The number of sessions whose hello was accepted.
   */
  public get authenticatedCount(): number;

  /**
   * Starts listening on an ephemeral loopback port or the supplied socket path without removing existing paths.
   * @returns The endpoint.
   * @throws InvalidOperationException when already started.
   * @throws Error when the endpoint cannot be bound, including an occupied socket path.
   */
  public start(): Promise<Endpoint>;

  /**
   * Closes every session and stops listening.
   */
  public stop(): Promise<void>;

  /**
   * Sends an event to every authenticated session.
   * @param event The event.
   */
  public onEvent(event: Event): void;

  /**
   * Handles a line: the hello on a new session (refused and closed on a bad token, an unservable
   * version, or anything but a hello), a request afterwards; unreadable lines and non-requests are
   * answered with a failed response.
   * @param session The session.
   * @param line The line.
   */
  public onLine(session: ClientSession, line: string): void;

  /**
   * Forgets a closed session.
   * @param session The session.
   */
  public onClosed(session: ClientSession): void;
}

/**
 * Stops a participant that stays idle for a grace period.
 */
export declare class IdleMonitor implements Disposable {
  /**
   * Initializes the monitor.
   * @param graceMilliseconds The grace, or `null` to never stop.
   * @param participant What to watch and stop.
   * @throws ArgumentOutOfRangeException when the grace is not a positive integer.
   */
  public constructor(graceMilliseconds: number | null, participant: IIdleParticipant);

  /**
   * Whether the grace timer runs.
   */
  public get isArmed(): boolean;

  /**
   * Re-evaluates the participant: arms the timer when idle, disarms it otherwise.
   */
  public check(): void;

  /**
   * Disarms the timer.
   */
  public [Symbol.dispose](): void;
}

/**
 * The lock file beside the database: who serves the data directory and how to reach it.
 */
export declare class LockFile implements Disposable {
  /**
   * The file's path.
   */
  public readonly path: string;

  /**
   * Initializes the lock file.
   * @param path The file's path.
   * @param probe Tells whether a process is alive.
   * @throws ArgumentException when the path is blank.
   */
  public constructor(path: string, probe: ProcessProbe);

  /**
   * Reads the lock.
   * @returns The lock, or `null` when the file is missing or unreadable.
   */
  public read(): RuntimeLock | null;

  /**
   * Reads the lock of a live runtime.
   * @returns The lock when its process is alive, else `null`.
   */
  public readLive(): RuntimeLock | null;

  /**
   * Writes the lock, replacing a stale one; the write is atomic and the file is private to the
   * user.
   * @param lock The lock.
   * @throws RuntimeAlreadyRunningException when a live runtime with another process id or token
   * holds the lock.
   */
  public acquire(lock: RuntimeLock): void;

  /**
   * Claims exclusive ownership before accessing runtime state. Ownership is an exclusive SQLite
   * transaction in a separate file and is released by the operating system if this process exits.
   * Repeated calls on this instance keep the same ownership.
   * @throws RuntimeAlreadyRunningException when a live runtime has published its descriptor.
   * @throws Error when an unpublished owner holds the transaction or filesystem access fails.
   */
  public claim(): void;

  /**
   * Releases ownership without removing the published descriptor. Safe to call repeatedly.
   */
  public [Symbol.dispose](): void;

  /**
   * Removes the lock when it belongs to the process.
   * @param processId The releasing process.
   */
  public release(processId: number): void;

  /**
   * Removes the lock file when it still holds the given lock: the lock named a process that is alive by id but not
   * answering, which happens when the id was reused after a runtime died without releasing its lock.
   * @param lock The lock that could not be reached.
   */
  public discard(lock: RuntimeLock): void;
}

/**
 * Tells whether a process is alive.
 */
export declare class ProcessProbe {
  /**
   * Checks a process.
   * @param processId The process id.
   * @returns `true` when the process exists.
   */
  public isAlive(processId: number): boolean;
}

/**
 * Builds the production provider registry: the Codex and Claude Code adapters over the located
 * executables.
 */
export declare class ProviderRegistryFactory {
  /**
   * Initializes the factory.
   * @param platform The platform, as `process.platform`.
   * @param baseEnvironment The environment the adapters clean for provider processes.
   * @param locator Finds the executables.
   */
  public constructor(platform: string, baseEnvironment: NodeJS.ProcessEnv, locator: ExecutableLocator);

  /**
   * Creates the registry.
   * @param productVersion The product version reported to the providers.
   * @returns The registry with both adapters, each with a `null` command when its executable was
   * not found.
   */
  public create(productVersion: string, tracker: IProcessTracker, dataDirectory: string): ProviderRegistry;
}

/**
 * The runtime process entry: reads the arguments, builds the service, and runs it until it stops
 * by idleness, a signal, or the end of its input.
 */
export declare class RuntimeEntry {
  /**
   * Initializes the entry.
   * @param args The command-line arguments after the script.
   * @param platform The platform, as `process.platform`.
   * @param environment The process environment.
   */
  public constructor(args: readonly string[], platform: string, environment: NodeJS.ProcessEnv);

  /**
   * The path of this module, which a launcher runs with the same Node executable.
   */
  public static get entryPath(): string;

  /**
   * Whether `--stop-on-input-end` was given.
   */
  public get stopsOnInputEnd(): boolean;

  /**
   * Reads the settings from `--data-dir`, `--product-version`, and `--idle-grace`.
   * @returns The settings.
   * @throws ArgumentException when `--data-dir` is missing.
   */
  public createSettings(): RuntimeSettings;

  /**
   * Creates the provider registry: the production adapters, or none with `--providers none`.
   * @param productVersion The product version.
   * @returns The registry.
   * @throws ArgumentException for any other `--providers` value.
   */
  public createRegistry(productVersion: string, tracker: IProcessTracker): ProviderRegistry;

  /**
   * Runs the runtime until it stops.
   * @param input The process input, watched for its end when `--stop-on-input-end` was given.
   * @param signals The emitter of `SIGINT` and `SIGTERM`.
   * @returns Why the runtime stopped.
   */
  public run(input: NodeJS.ReadableStream, signals: NodeJS.EventEmitter): Promise<string>;
}

/**
 * Attaches to the runtime of a data directory, starting one when none is live.
 */
export declare class RuntimeLauncher {
  /**
   * Initializes the launcher.
   * @param settings The data directory and product version the runtime serves.
   * @param executablePath The Node executable that runs the entry.
   * @param entryPath The runtime entry module.
   * @param entryArguments Extra arguments for the entry.
   * @param environment The environment of the runtime process; an Electron host adds `ELECTRON_RUN_AS_NODE`.
   * @param timings The timeouts.
   * @throws ArgumentException when a path is blank.
   */
  public constructor(settings: RuntimeSettings, executablePath: string, entryPath: string, entryArguments: readonly string[], environment: NodeJS.ProcessEnv, timings: RuntimeTimings);

  /**
   * Reads the lock of a live runtime.
   * @returns The lock, or `null`.
   */
  public readLiveLock(): RuntimeLock | null;

  /**
   * Connects to the live runtime, or starts a detached runtime process and connects once it
   * publishes its lock. Incompatible discovery metadata is refused before opening a connection.
   * @param clientName The client's name.
   * @param listener Receives events and the disconnection.
   * @returns The connected client.
   * @throws ConnectionException when the runtime refuses the hello.
   * @throws LaunchException when no runtime becomes reachable within the launch timeout, or a live runtime's product or protocol version differs.
   * @remarks A live different version is left running; it is never killed or replaced while its work may be active.
   */
  public attach(clientName: string, listener: IRuntimeClientListener): Promise<RuntimeClient>;
}

/**
 * The runtime for one data directory: opens the database, wires the services and the engine,
 * listens on the endpoint, publishes the lock, and stops when told or when idle for the grace
 * period.
 */
export declare class RuntimeService implements IServerListener, IIdleParticipant, IEventListener, IUpdateShutdown {
  /**
   * The settings.
   */
  public readonly settings: RuntimeSettings;

  /**
   * Initializes the service without starting it.
   * @param settings The settings.
   * @param registry The provider adapters.
   * @param processes The provider processes started by runtimes; leftovers of dead runtimes are ended at start.
   */
  public constructor(settings: RuntimeSettings, registry: ProviderRegistry, processes: ProcessRegistry, installation?: InstallationRegistry | null);

  /**
   * Creates an immutable verified recovery copy after update shutdown.
   * @param dataDirectory Runtime data directory.
   * @param operationId Update UUID.
   * @returns Backup path, or null if no database exists.
   * @throws Error or ServiceException when a recovery copy cannot be verified.
   */
  public static createRecoveryCopy(dataDirectory: string, operationId: string): Promise<string | null>;

  /**
   * Closes idle provider and database resources within a bounded deadline, leaving the endpoint for acknowledgement.
   * @throws Error if clean shutdown cannot be confirmed.
   */
  public prepareUpdateShutdown(): Promise<void>;

  /**
   * Releases the endpoint and ownership after the update acknowledgement has been attempted.
   */
  public finishUpdateShutdown(): Promise<void>;

  /**
   * The published lock, or `null` before start and after stop.
   */
  public get lock(): RuntimeLock | null;

  /**
   * Whether the service runs and is not stopping.
   */
  public get isRunning(): boolean;

  /**
   * Whether no client is connected and no turn runs.
   */
  public get isIdle(): boolean;

  /**
   * The number of connected sessions.
   */
  public get clientCount(): number;

  /**
   * Starts the service and publishes its lock. After acquiring ownership, clears a leftover
   * derived Unix socket path in this data directory before binding; custom socket paths are not removed.
   * @returns The lock.
   * @throws InvalidOperationException when already started.
   * @throws RuntimeAlreadyRunningException when another runtime serves the directory. Ownership
   * is acquired before opening the database, reconciling replies, or touching provider processes.
   * @throws Error when ownership or startup fails; resources acquired by this attempt are released.
   */
  public start(): Promise<RuntimeLock>;

  /**
   * Stops the service: closes the endpoint, shuts the engine and the adapters down, closes the
   * database, and removes the lock. Ignored before start or when already stopping.
   * @param reason Why, reported to `waitForStop`.
   */
  public stop(reason: string): Promise<void>;

  /**
   * Waits until the service stopped.
   * @returns Why it stopped.
   */
  public waitForStop(): Promise<string>;

  /**
   * Records the session count and re-evaluates idleness.
   * @param count The number of sessions.
   */
  public onSessionCountChanged(count: number): void;

  /**
   * Re-evaluates idleness after any event.
   * @param event The event.
   */
  public onEvent(event: Event): void;

  /**
   * Stops the service because it stayed idle.
   */
  public handleIdle(): void;
}

/**
 * Generates capability tokens.
 */
export declare class TokenGenerator {
  /**
   * Generates a random token of 64 hexadecimal characters.
   * @returns The token.
   */
  public generate(): string;
}
