/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Exception, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import type { JsonObject, JsonReader, JsonValue } from "@noldova/teamrun-foundation-json";

/**
 * The kinds of message the local protocol carries. A message's `kind` field
 * on the wire holds one of these values.
 */
export declare enum WireMessageKind {
  /**
   * The first message of a connection: the client's build identity and its
   * capability token.
   */
  Handshake = "Handshake",

  /**
   * A call of a method, answered by one response with the same id.
   */
  Request = "Request",

  /**
   * The answer to a handshake or a request.
   */
  Response = "Response",

  /**
   * A notification to connected clients; it is not answered.
   */
  Event = "Event",

  /**
   * Asks the runtime to stop an unanswered request.
   */
  Cancel = "Cancel"
}

/**
 * Why a request, a handshake or a connection failed.
 */
export declare enum FailureCode {
  /**
   * A frame is not a valid message.
   */
  InvalidMessage = "InvalidMessage",

  /**
   * A frame exceeds the connection's maximum length. A frame received over the limit closes the connection; a request or
   * answer over the limit is never sent, and only its call fails.
   */
  FrameTooLarge = "FrameTooLarge",

  /**
   * The client speaks another protocol version than the runtime.
   */
  UnsupportedVersion = "UnsupportedVersion",

  /**
   * The client comes from another build than the runtime. The failure's
   * details are a `RuntimeHandover`.
   */
  BuildMismatch = "BuildMismatch",

  /**
   * The data directory holds data written by a release that predates the
   * shell, which the runtime refuses to open. The failure's details are a
   * `PreShellData`; `shell.moveAside` moves that data aside at the person's
   * request.
   */
  PreShellData = "PreShellData",

  /**
   * The handshake's capability token is wrong, or the connection has not
   * completed its handshake.
   */
  Unauthorized = "Unauthorized",

  /**
   * No active part registered the requested method.
   */
  UnknownMethod = "UnknownMethod",

  /**
   * The request's payload breaks the method's contract.
   */
  InvalidParams = "InvalidParams",

  /**
   * The request names something that does not exist.
   */
  NotFound = "NotFound",

  /**
   * The request conflicts with the current state.
   */
  Conflict = "Conflict",

  /**
   * The request was cancelled before it completed.
   */
  Cancelled = "Cancelled",

  /**
   * The request did not complete within its time limit.
   */
  DeadlineExceeded = "DeadlineExceeded",

  /**
   * The runtime cannot serve the request now, such as while it shuts down.
   */
  Unavailable = "Unavailable",

  /**
   * The runtime failed unexpectedly.
   */
  Internal = "Internal"
}

/**
 * How serious a notification is; each severity has its own icon.
 */
export declare enum NotificationSeverity {
  /**
   * Something the person may want to know.
   */
  Info = "Info",

  /**
   * Something that finished well.
   */
  Success = "Success",

  /**
   * Something the person should look at.
   */
  Warning = "Warning",

  /**
   * Something that failed.
   */
  Error = "Error"
}

/**
 * Where a module stands in the runtime, as `shell.modules` reports it.
 */
export declare enum ModuleState {
  /**
   * The module's runtime part, if any, and all its dependencies activated.
   */
  Active = "Active",

  /**
   * The module's runtime part could not be loaded or failed to activate.
   */
  Failed = "Failed",

  /**
   * A module the module depends on is not active, so it was not activated.
   */
  Blocked = "Blocked"
}

/**
 * How a runtime asked to stop by `shell.stop` treats work in progress.
 */
export declare enum StopPolicy {
  /**
   * Stop only when no work is in progress; otherwise answer with a
   * `Conflict` failure whose details are the running work.
   */
  IfIdle = "IfIdle",

  /**
   * Stop the work in progress, then stop.
   */
  StopWork = "StopWork"
}

/**
 * The kind of value a setting holds.
 */
export declare enum SettingKind {
  /**
   * `true` or `false`.
   */
  Boolean = "Boolean",

  /**
   * One of a list of named options, held as the option's value.
   */
  Choice = "Choice",

  /**
   * A number from a minimum to a maximum, in whole steps from the minimum.
   */
  Number = "Number",

  /**
   * A string up to a maximum length.
   */
  Text = "Text",

  /**
   * A list of distinct module ids.
   */
  Modules = "Modules",

  /**
   * The person's key bindings: an object from a command's name to the key
   * bound to it, or to `null` when the person removed the command's key.
   * Each key is one `KeyChord.canBind` accepts for its command. Only the
   * shell's `shell.keyBindings` has this kind.
   */
  KeyBindings = "KeyBindings"
}

/**
 * Where a setting's value is kept.
 */
export declare enum SettingLocality {
  /**
   * One value for each device, never carried to another device.
   */
  Device = "Device",

  /**
   * One value for the data directory, which a later synchronization may
   * carry to other devices.
   */
  Shared = "Shared"
}

/**
 * The exception thrown when a connection's frames break the protocol, such
 * as a frame over the maximum length.
 */
export declare class ProtocolException extends Exception {
  /**
   * Why the protocol was broken.
   */
  public readonly code: FailureCode;

  /**
   * Creates the exception.
   *
   * @param code Why the protocol was broken.
   * @param message A sentence describing the failure.
   * @param options The preceding failure, if any.
   *
   * @example
   * ```ts
   * import { FailureCode, ProtocolException } from "@noldova/teamrun-shell-protocol";
   *
   * export const failure: ProtocolException = new ProtocolException(FailureCode.FrameTooLarge, "A frame exceeds the maximum length.");
   * ```
   */
  public constructor(code: FailureCode, message: string, options?: ExceptionOptions);
}

/**
 * A method or event name: an owner, a dot and a member, such as
 * `shell.handshake` or `checkpoints.capture`. The owner is `shell` for the
 * shell's own names and a module's id for a module's.
 */
export declare class QualifiedName {
  /**
   * The owner: `shell` or a module id in lowercase kebab-case.
   */
  public readonly owner: string;

  /**
   * The member: a lowercase letter followed by letters and digits.
   */
  public readonly member: string;

  /**
   * The full name, `owner.member`.
   */
  public readonly text: string;

  /**
   * True when the shell owns the name.
   */
  public get isShell(): boolean;

  /**
   * Creates the name.
   *
   * @param owner `shell` or a module id: lowercase letters and digits in
   * hyphen-separated words, starting with a letter.
   * @param member A lowercase letter followed by letters and digits.
   * @param parameterName The parameter name a rejection reports; `name` by
   * default.
   * @throws ArgumentException synchronously when the owner or member is not
   * valid.
   *
   * @example
   * ```ts
   * import { QualifiedName } from "@noldova/teamrun-shell-protocol";
   *
   * export const capture: QualifiedName = new QualifiedName("checkpoints", "capture");
   * ```
   */
  public constructor(owner: string, member: string, parameterName?: string);

  /**
   * Parses `owner.member` text.
   *
   * @param text The name's text.
   * @param parameterName The parameter name a rejection reports; `text` by
   * default.
   * @returns The name.
   * @throws ArgumentException synchronously when the text has no dot or its
   * owner or member is not valid, including a member with another dot.
   *
   * @example
   * ```ts
   * import { QualifiedName } from "@noldova/teamrun-shell-protocol";
   *
   * export function readMethod(text: string): QualifiedName {
   *   return QualifiedName.parse(text, "method");
   * }
   * ```
   */
  public static parse(text: string, parameterName?: string): QualifiedName;

  /**
   * Reads `owner.member` text without throwing, for checks that only need to
   * know whether the text is a name.
   *
   * @param text The name's text.
   * @returns The name, or `null` when `parse` would refuse the text.
   *
   * @example
   * ```ts
   * import { QualifiedName } from "@noldova/teamrun-shell-protocol";
   *
   * export const isName: boolean = QualifiedName.find("notes.create") !== null;
   * ```
   */
  public static find(text: string): QualifiedName | null;

  /**
   * Compares two names.
   *
   * @param other The other name.
   * @returns True when both have the same text.
   *
   * @example
   * ```ts
   * import { QualifiedName } from "@noldova/teamrun-shell-protocol";
   *
   * export const isStop: boolean = QualifiedName.parse("shell.stop").equals(new QualifiedName("shell", "stop"));
   * ```
   */
  public equals(other: QualifiedName): boolean;

  /**
   * Returns the full name.
   *
   * @returns `owner.member`.
   *
   * @example
   * ```ts
   * import { QualifiedName } from "@noldova/teamrun-shell-protocol";
   *
   * export const text: string = QualifiedName.parse("checkpoints.capture").toString();
   * ```
   */
  public toString(): string;
}

/**
 * What identifies a build to the local protocol: its product version, its
 * protocol version and its fingerprint. A runtime serves only clients of its
 * own build.
 */
export declare class BuildIdentity {
  /**
   * The protocol version this package was built with, stamped by the build
   * from the root manifest.
   */
  public static readonly supportedProtocolVersion: number;

  /**
   * The product version, such as `0.0.1`.
   */
  public readonly productVersion: string;

  /**
   * The protocol version; a positive integer.
   */
  public readonly protocolVersion: number;

  /**
   * The fingerprint of the inputs the build was compiled from.
   */
  public readonly fingerprint: string;

  /**
   * Creates the identity.
   *
   * @param productVersion The product version; not whitespace only.
   * @param protocolVersion The protocol version; a positive integer.
   * @param fingerprint The build fingerprint; not whitespace only.
   * @throws ArgumentException synchronously when the product version or
   * fingerprint is empty or whitespace only.
   * @throws ArgumentOutOfRangeException synchronously when the protocol
   * version is not a positive integer.
   *
   * @example
   * ```ts
   * import { BuildIdentity } from "@noldova/teamrun-shell-protocol";
   *
   * export const identity: BuildIdentity = new BuildIdentity("0.0.1", BuildIdentity.supportedProtocolVersion, "9f2c41");
   * ```
   */
  public constructor(productVersion: string, protocolVersion: number, fingerprint: string);

  /**
   * Parses a protocol version stamped as text.
   *
   * @param text The digits of a positive integer, without a sign or leading
   * zeros.
   * @returns The protocol version.
   * @throws ArgumentException synchronously when the text is not a positive
   * integer, such as an unstamped placeholder.
   *
   * @example
   * ```ts
   * import { BuildIdentity } from "@noldova/teamrun-shell-protocol";
   *
   * export const version: number = BuildIdentity.parseProtocolVersion("1");
   * ```
   */
  public static parseProtocolVersion(text: string): number;

  /**
   * Reads an identity from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The identity.
   * @throws JsonException synchronously when a field is unknown, missing, has
   * the wrong type or breaks the constructor's rules; its path names the
   * field.
   *
   * @example
   * ```ts
   * import { BuildIdentity } from "@noldova/teamrun-shell-protocol";
   *
   * export const identity: BuildIdentity = BuildIdentity.fromJson({ productVersion: "0.0.1", protocolVersion: 1, fingerprint: "9f2c41" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): BuildIdentity;

  /**
   * Checks whether this identity's runtime can serve a client.
   *
   * @param other The client's identity.
   * @returns `UnsupportedVersion` when the protocol versions differ,
   * `BuildMismatch` when the fingerprints or product versions differ, and
   * `null` when the client is served.
   *
   * @example
   * ```ts
   * import { type BuildIdentity, FailureCode } from "@noldova/teamrun-shell-protocol";
   *
   * export function canServe(runtime: BuildIdentity, client: BuildIdentity): boolean {
   *   const mismatch: FailureCode | null = runtime.findMismatch(client);
   *   return mismatch === null;
   * }
   * ```
   */
  public findMismatch(other: BuildIdentity): FailureCode | null;

  /**
   * Returns the wire form.
   *
   * @returns The `productVersion`, `protocolVersion` and `fingerprint`
   * fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { BuildIdentity } from "@noldova/teamrun-shell-protocol";
   *
   * export const json: JsonObject = new BuildIdentity("0.0.1", 1, "9f2c41").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Why something failed, as a response carries it.
 */
export declare class Failure {
  /**
   * The kind of failure.
   */
  public readonly code: FailureCode;

  /**
   * A sentence a person can read, without secrets.
   */
  public readonly message: string;

  /**
   * Structured data a failure defines, such as the runtime handover of a
   * `BuildMismatch` or the running work of a `Conflict` answer to
   * `shell.stop`; absent when the failure defines none.
   */
  public readonly details?: JsonObject;

  /**
   * Creates the failure.
   *
   * @param code The kind of failure.
   * @param message A sentence describing it; not whitespace only.
   * @param details The failure's structured data; omit it when the failure
   * defines none.
   * @throws ArgumentException synchronously when the message is empty or
   * whitespace only.
   *
   * @example
   * ```ts
   * import { Failure, FailureCode } from "@noldova/teamrun-shell-protocol";
   *
   * export const failure: Failure = new Failure(FailureCode.NotFound, "The conversation does not exist.");
   * ```
   */
  public constructor(code: FailureCode, message: string, details?: JsonObject);

  /**
   * Reads a failure from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure to read reports; `$` by default.
   * @returns The failure.
   * @throws JsonException synchronously when the code is unknown, the
   * message is missing or blank, or `details` is present but not an object;
   * its path names the field.
   *
   * @example
   * ```ts
   * import { Failure } from "@noldova/teamrun-shell-protocol";
   *
   * export const failure: Failure = Failure.fromJson({ code: "Conflict", message: "Work is running.", details: { descriptions: ["A reply"] } });
   * ```
   */
  public static fromJson(value: unknown, path?: string): Failure;

  /**
   * Returns the wire form.
   *
   * @returns The `code` and `message` fields, and `details` when the
   * failure has them.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { Failure, FailureCode } from "@noldova/teamrun-shell-protocol";
   *
   * export const json: JsonObject = new Failure(FailureCode.Unavailable, "The runtime is shutting down.").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Where to find the runtime that owns a data directory: its build and the
 * program it runs from. A `BuildMismatch` failure carries it as its
 * details, so a client of another build can hand the person over to the
 * owner. Its wire form never changes after protocol version 1.
 */
export declare class RuntimeHandover {
  /**
   * The owning runtime's build.
   */
  public readonly identity: BuildIdentity;

  /**
   * The full path of the program the owning runtime runs from.
   */
  public readonly executablePath: string;

  /**
   * Creates the handover.
   *
   * @param identity The owning runtime's build.
   * @param executablePath The program's full path; not whitespace only.
   * @throws ArgumentException synchronously when the path is empty or
   * whitespace only.
   *
   * @example
   * ```ts
   * import { BuildIdentity, RuntimeHandover } from "@noldova/teamrun-shell-protocol";
   *
   * export const handover: RuntimeHandover = new RuntimeHandover(new BuildIdentity("0.0.2", 1, "7a10be"), "/Applications/TeamRun.app/Contents/MacOS/TeamRun");
   * ```
   */
  public constructor(identity: BuildIdentity, executablePath: string);

  /**
   * Reads a handover from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The handover.
   * @throws JsonException synchronously when a field is unknown, missing, has
   * the wrong type or breaks the rules, in the handover or its identity; its
   * path names the field.
   *
   * @example
   * ```ts
   * import { type Failure, RuntimeHandover } from "@noldova/teamrun-shell-protocol";
   *
   * export function readHandover(failure: Failure): RuntimeHandover | undefined {
   *   return failure.details === undefined ? undefined : RuntimeHandover.fromJson(failure.details, "$.failure.details");
   * }
   * ```
   */
  public static fromJson(value: unknown, path?: string): RuntimeHandover;

  /**
   * Returns the wire form.
   *
   * @returns The `identity` and `executablePath` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { BuildIdentity, RuntimeHandover } from "@noldova/teamrun-shell-protocol";
   *
   * export const details: JsonObject = new RuntimeHandover(new BuildIdentity("0.0.2", 1, "7a10be"), "C:\\Program Files\\TeamRun\\TeamRun.exe").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The payload of `shell.stop`, which asks a runtime to stop. Its wire form
 * never changes after protocol version 1.
 */
export declare class StopRequest {
  /**
   * How the runtime treats work in progress.
   */
  public readonly policy: StopPolicy;

  /**
   * Creates the request.
   *
   * @param policy How the runtime treats work in progress.
   *
   * @example
   * ```ts
   * import { StopPolicy, StopRequest } from "@noldova/teamrun-shell-protocol";
   *
   * export const request: StopRequest = new StopRequest(StopPolicy.IfIdle);
   * ```
   */
  public constructor(policy: StopPolicy);

  /**
   * Reads a request from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The request.
   * @throws JsonException synchronously when the policy is missing or
   * unknown, or another field is present; its path names the field.
   *
   * @example
   * ```ts
   * import { StopRequest } from "@noldova/teamrun-shell-protocol";
   *
   * export const request: StopRequest = StopRequest.fromJson({ policy: "StopWork" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): StopRequest;

  /**
   * Returns the wire form.
   *
   * @returns The `policy` field.
   *
   * @example
   * ```ts
   * import { Request, ShellMethods, StopPolicy, StopRequest } from "@noldova/teamrun-shell-protocol";
   *
   * export const stop: Request = new Request("r1", ShellMethods.stop, new StopRequest(StopPolicy.IfIdle).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Which window's state a request reads or writes: the device that recorded
 * it and the window on that device. State tied to a display or a window is
 * kept for the device and window that recorded it.
 */
export declare class WindowStateKey {
  /**
   * The device's identity.
   */
  public readonly device: string;

  /**
   * The window's identity on the device.
   */
  public readonly window: string;

  /**
   * Creates the key.
   *
   * @param device The device's identity; not whitespace only.
   * @param window The window's identity; not whitespace only.
   * @throws ArgumentException synchronously when either is empty or
   * whitespace only.
   *
   * @example
   * ```ts
   * import { WindowStateKey } from "@noldova/teamrun-shell-protocol";
   *
   * export const key: WindowStateKey = new WindowStateKey("1b4e28ba-2fa1-41d2-883f-0016d3cca427", "main");
   * ```
   */
  public constructor(device: string, window: string);

  /**
   * Reads a key from its wire form, the payload of `shell.readWindowBounds`
   * and `shell.readWindowLayout`.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The key.
   * @throws JsonException synchronously when a field is missing, blank or
   * not a string, or another field is present; its path names the field.
   *
   * @example
   * ```ts
   * import { WindowStateKey } from "@noldova/teamrun-shell-protocol";
   *
   * export const key: WindowStateKey = WindowStateKey.fromJson({ device: "1b4e28ba-2fa1-41d2-883f-0016d3cca427", window: "main" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): WindowStateKey;

  /**
   * Returns the wire form.
   *
   * @returns The `device` and `window` fields.
   *
   * @example
   * ```ts
   * import { Request, ShellMethods, WindowStateKey } from "@noldova/teamrun-shell-protocol";
   *
   * export const read: Request = new Request("r1", ShellMethods.readWindowBounds, new WindowStateKey("1b4e28ba-2fa1-41d2-883f-0016d3cca427", "main").toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The payload of `shell.writeWindowBounds` and `shell.writeWindowLayout`:
 * the window's key and the state to keep for it. The shell stores the state
 * as given; its owner, the desktop for bounds and the window for layout,
 * defines its form.
 */
export declare class WindowStateWrite {
  /**
   * The window whose state is written.
   */
  public readonly key: WindowStateKey;

  /**
   * The state to keep.
   */
  public readonly value: JsonObject;

  /**
   * Creates the write.
   *
   * @param key The window.
   * @param value The state to keep.
   *
   * @example
   * ```ts
   * import { WindowStateKey, WindowStateWrite } from "@noldova/teamrun-shell-protocol";
   *
   * export const write: WindowStateWrite = new WindowStateWrite(new WindowStateKey("1b4e28ba-2fa1-41d2-883f-0016d3cca427", "main"), { width: 1280, height: 800 });
   * ```
   */
  public constructor(key: WindowStateKey, value: JsonObject);

  /**
   * Reads a write from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The write.
   * @throws JsonException synchronously when the key's fields are invalid,
   * the value is missing or not an object, or another field is present;
   * its path names the field.
   *
   * @example
   * ```ts
   * import { WindowStateWrite } from "@noldova/teamrun-shell-protocol";
   *
   * export const write: WindowStateWrite = WindowStateWrite.fromJson({ device: "1b4e28ba-2fa1-41d2-883f-0016d3cca427", window: "main", value: { width: 1280 } });
   * ```
   */
  public static fromJson(value: unknown, path?: string): WindowStateWrite;

  /**
   * Returns the wire form.
   *
   * @returns The key's `device` and `window` fields and the `value` field.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { WindowStateKey, WindowStateWrite } from "@noldova/teamrun-shell-protocol";
   *
   * export const json: JsonObject = new WindowStateWrite(new WindowStateKey("1b4e28ba-2fa1-41d2-883f-0016d3cca427", "main"), { width: 1280 }).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The answer to `shell.readWindowBounds` and `shell.readWindowLayout`: the
 * state kept for the window, or `null` when none is kept.
 */
export declare class WindowStateValue {
  /**
   * The kept state, or `null`.
   */
  public readonly value: JsonObject | null;

  /**
   * Creates the answer.
   *
   * @param value The kept state, or `null` when none is kept.
   *
   * @example
   * ```ts
   * import { WindowStateValue } from "@noldova/teamrun-shell-protocol";
   *
   * export const answer: WindowStateValue = new WindowStateValue(null);
   * ```
   */
  public constructor(value: JsonObject | null);

  /**
   * Reads an answer from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The answer.
   * @throws JsonException synchronously when the value is missing or neither
   * an object nor `null`, or another field is present; its path names the
   * field.
   *
   * @example
   * ```ts
   * import { WindowStateValue } from "@noldova/teamrun-shell-protocol";
   *
   * export const answer: WindowStateValue = WindowStateValue.fromJson({ value: { width: 1280 } });
   * ```
   */
  public static fromJson(value: unknown, path?: string): WindowStateValue;

  /**
   * Returns the wire form.
   *
   * @returns The `value` field.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { WindowStateValue } from "@noldova/teamrun-shell-protocol";
   *
   * export const json: JsonObject = new WindowStateValue({ width: 1280 }).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The work in progress that keeps a runtime from stopping, as a `Conflict`
 * answer to `shell.stop` carries it in its details. Its wire form never
 * changes after protocol version 1.
 */
export declare class RunningWork {
  /**
   * Sentences describing each piece of work, in the order the runtime lists
   * them.
   */
  public readonly descriptions: readonly string[];

  /**
   * Creates the list.
   *
   * @param descriptions At least one description, none whitespace only. The
   * list keeps its own copy.
   * @throws ArgumentException synchronously when the list is empty or a
   * description is empty or whitespace only.
   *
   * @example
   * ```ts
   * import { RunningWork } from "@noldova/teamrun-shell-protocol";
   *
   * export const work: RunningWork = new RunningWork(["A reply in Planning", "A command in a terminal"]);
   * ```
   */
  public constructor(descriptions: readonly string[]);

  /**
   * Reads the list from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The list.
   * @throws JsonException synchronously when `descriptions` is missing, not
   * an array of strings, empty or holds a blank description, or another
   * field is present; its path names the field or item.
   *
   * @example
   * ```ts
   * import { RunningWork } from "@noldova/teamrun-shell-protocol";
   *
   * export const work: RunningWork = RunningWork.fromJson({ descriptions: ["A reply in Planning"] });
   * ```
   */
  public static fromJson(value: unknown, path?: string): RunningWork;

  /**
   * Returns the wire form.
   *
   * @returns The `descriptions` field.
   *
   * @example
   * ```ts
   * import { Failure, FailureCode, RunningWork } from "@noldova/teamrun-shell-protocol";
   *
   * export const conflict: Failure = new Failure(FailureCode.Conflict, "Work is in progress.", new RunningWork(["A reply in Planning"]).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The work a runtime has in progress, as `shell.work` answers it. Unlike
 * `RunningWork`, the list may be empty.
 */
export declare class WorkReport {
  /**
   * Sentences describing each piece of work, in the order the runtime lists
   * them.
   */
  public readonly descriptions: readonly string[];

  /**
   * How many times the runtime's work has begun or ended before this report.
   * A client that hears reports both as answers and as `shell.work` events
   * keeps the one with the higher sequence, since an event may be handled
   * before an answer that preceded it.
   */
  public readonly sequence: number;

  /**
   * Creates the report.
   *
   * @param descriptions The descriptions, possibly none, none whitespace
   * only. The report keeps its own copy.
   * @param sequence The report's sequence, a whole number from 0; 0 by default.
   * @throws ArgumentException synchronously when a description is null,
   * empty or whitespace only, or the sequence is not a whole number from 0.
   *
   * @example
   * ```ts
   * import { WorkReport } from "@noldova/teamrun-shell-protocol";
   *
   * export const report: WorkReport = new WorkReport(["Indexing the project"], 3);
   * ```
   */
  public constructor(descriptions: readonly string[], sequence?: number);

  /**
   * Reads the report from its wire form. Unknown fields are ignored.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The report.
   * @throws JsonException synchronously when `descriptions` or `sequence` is
   * missing or invalid.
   *
   * @example
   * ```ts
   * import { WorkReport } from "@noldova/teamrun-shell-protocol";
   *
   * export const report: WorkReport = WorkReport.fromJson({ descriptions: [], sequence: 0 });
   * ```
   */
  public static fromJson(value: unknown, path?: string): WorkReport;

  /**
   * Whether this report is newer than another.
   *
   * @param other The other report, or `null` when there is none.
   * @returns Whether there is no other report or this one's sequence is higher.
   *
   * @example
   * ```ts
   * import { WorkReport } from "@noldova/teamrun-shell-protocol";
   *
   * export function newest(current: WorkReport | null, heard: WorkReport): WorkReport | null {
   *   return heard.isNewerThan(current) ? heard : current;
   * }
   * ```
   */
  public isNewerThan(other: WorkReport | null): boolean;

  /**
   * Returns the wire form.
   *
   * @returns The `descriptions` and `sequence` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { WorkReport } from "@noldova/teamrun-shell-protocol";
   *
   * export const json: JsonObject = new WorkReport([]).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * One module of the runtime's build: what its declaration says about it and
 * where it stands. An active module has no cause; a failed or blocked one has
 * a cause that is safe to show, without a stack or a path outside the data
 * directory, and a blocked one also names the dependency that blocks it.
 */
export declare class ModuleStatus {
  /**
   * The module's id.
   */
  public readonly id: string;

  /**
   * The module's own version, `<major>.<minor>.<patch>`, as it declares it.
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
   * The ids of the modules it depends on, as it declares them.
   */
  public readonly dependencies: readonly string[];

  /**
   * The names it declares, by kind, such as `commands` or `views`.
   */
  public readonly contributions: ReadonlyMap<string, readonly string[]>;

  /**
   * Where the module stands.
   */
  public readonly state: ModuleState;

  /**
   * Why the module is not active; `null` for an active module.
   */
  public readonly cause: string | null;

  /**
   * The dependency that is not active, for a blocked module; otherwise
   * `null`.
   */
  public readonly blockedBy: string | null;

  /**
   * Creates the status.
   *
   * @param id The module's id; not whitespace only.
   * @param version The module's version, `<major>.<minor>.<patch>`: three
   * whole numbers of up to nine digits without leading zeros, such as `0.0.1`.
   * @param displayName The name people see; not whitespace only.
   * @param description What the module does; not whitespace only.
   * @param dependencies The ids of the modules it depends on.
   * @param contributions The names it declares, by kind.
   * @param state Where the module stands.
   * @param cause `null` for an active module; otherwise text that is not
   * whitespace only.
   * @param blockedBy For a blocked module, the dependency that blocks it;
   * otherwise `null`, the default.
   * @throws ArgumentException synchronously when the id, the display name or
   * the description is blank, the version does not have that form, an active module has a cause, a failed or
   * blocked module has none or a blank one, or `blockedBy` is not one of the
   * dependencies of a blocked module.
   *
   * @example
   * ```ts
   * import { ModuleState, ModuleStatus } from "@noldova/teamrun-shell-protocol";
   *
   * export const status: ModuleStatus = new ModuleStatus(
   *   "notes", "0.0.1", "Notes", "Keeps notes.", ["tasks"], new Map([["commands", ["notes.newNote"]]]), ModuleState.Blocked,
   *   "It depends on tasks, which is not active.", "tasks");
   * ```
   */
  public constructor(
    id: string,
    version: string,
    displayName: string,
    description: string,
    dependencies: readonly string[],
    contributions: ReadonlyMap<string, readonly string[]>,
    state: ModuleState,
    cause: string | null,
    blockedBy?: string | null);

  /**
   * Reads the status from its wire form. Unknown fields are ignored.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The status.
   * @throws JsonException synchronously when a field is missing or invalid,
   * or `cause` or `blockedBy` does not match the state; its path names the
   * field.
   *
   * @example
   * ```ts
   * import { ModuleStatus } from "@noldova/teamrun-shell-protocol";
   *
   * export const status: ModuleStatus = ModuleStatus.fromJson({
   *   id: "notes", version: "0.0.1", displayName: "Notes", description: "Keeps notes.", dependencies: [], contributes: {}, state: "Active"
   * });
   * ```
   */
  public static fromJson(value: unknown, path?: string): ModuleStatus;

  /**
   * Lists the names the module declares of one kind.
   *
   * @param kind The kind, such as `commands`.
   * @returns The names, in declared order; none when it declares none.
   *
   * @example
   * ```ts
   * import type { ModuleStatus } from "@noldova/teamrun-shell-protocol";
   *
   * export function listCommands(status: ModuleStatus): readonly string[] {
   *   return status.listContributions("commands");
   * }
   * ```
   */
  public listContributions(kind: string): readonly string[];

  /**
   * Returns the same module in another state.
   *
   * @param state Where the module stands.
   * @param cause `null` for an active module; otherwise text that is not
   * whitespace only.
   * @param blockedBy For a blocked module, the dependency that blocks it;
   * otherwise `null`, the default.
   * @returns The new status.
   * @throws ArgumentException synchronously as the constructor does.
   *
   * @example
   * ```ts
   * import { ModuleState, type ModuleStatus } from "@noldova/teamrun-shell-protocol";
   *
   * export function fail(status: ModuleStatus): ModuleStatus {
   *   return status.withState(ModuleState.Failed, "Its window part could not be loaded.");
   * }
   * ```
   */
  public withState(state: ModuleState, cause: string | null, blockedBy?: string | null): ModuleStatus;

  /**
   * Returns the wire form.
   *
   * @returns The `id`, `version`, `displayName`, `description`, `dependencies`,
   * `contributes` and `state` fields, `cause` when there is one and
   * `blockedBy` when there is one.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { ModuleState, ModuleStatus } from "@noldova/teamrun-shell-protocol";
   *
   * export const json: JsonObject = new ModuleStatus("notes", "0.0.1", "Notes", "Keeps notes.", [], new Map(), ModuleState.Active, null).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The answer to `shell.modules`: every module of the build in activation
 * order, with where it stands.
 */
export declare class ModuleStatusList {
  /**
   * The modules' statuses, in activation order.
   */
  public readonly modules: readonly ModuleStatus[];

  /**
   * Creates the list.
   *
   * @param modules The modules' statuses.
   *
   * @example
   * ```ts
   * import { ModuleState, ModuleStatus, ModuleStatusList } from "@noldova/teamrun-shell-protocol";
   *
   * export const list: ModuleStatusList = new ModuleStatusList([new ModuleStatus("notes", "0.0.1", "Notes", "Keeps notes.", [], new Map(), ModuleState.Active, null)]);
   * ```
   */
  public constructor(modules: readonly ModuleStatus[]);

  /**
   * Reads the list from its wire form. Unknown fields are ignored.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The list.
   * @throws JsonException synchronously when `modules` is missing or not a
   * list of objects, or a status in it is invalid; its path names the field.
   *
   * @example
   * ```ts
   * import { ModuleStatusList } from "@noldova/teamrun-shell-protocol";
   *
   * export const list: ModuleStatusList = ModuleStatusList.fromJson({
   *   modules: [{ id: "notes", version: "0.0.1", displayName: "Notes", description: "Keeps notes.", dependencies: [], contributes: {}, state: "Active" }]
   * });
   * ```
   */
  public static fromJson(value: unknown, path?: string): ModuleStatusList;

  /**
   * Returns the wire form.
   *
   * @returns The `modules` field.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { ModuleStatusList } from "@noldova/teamrun-shell-protocol";
   *
   * export const json: JsonObject = new ModuleStatusList([]).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Where data written by a release that predates the shell was found, as a
 * `PreShellData` failure carries it in its details. Its wire form never
 * changes after protocol version 1.
 */
export declare class PreShellData {
  /**
   * The full path of the data directory that holds the data.
   */
  public readonly location: string;

  /**
   * Creates the details.
   *
   * @param location The data directory's full path; not whitespace only.
   * @throws ArgumentException synchronously when the location is empty or
   * whitespace only.
   *
   * @example
   * ```ts
   * import { PreShellData } from "@noldova/teamrun-shell-protocol";
   *
   * export const data: PreShellData = new PreShellData("/home/person/.noldova/teamrun");
   * ```
   */
  public constructor(location: string);

  /**
   * Reads the details from their wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The details.
   * @throws JsonException synchronously when `location` is missing, not a
   * string or blank, or another field is present; its path names the field.
   *
   * @example
   * ```ts
   * import { PreShellData } from "@noldova/teamrun-shell-protocol";
   *
   * export const data: PreShellData = PreShellData.fromJson({ location: "/home/person/.noldova/teamrun" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): PreShellData;

  /**
   * Returns the wire form.
   *
   * @returns The `location` field.
   *
   * @example
   * ```ts
   * import { Failure, FailureCode, PreShellData } from "@noldova/teamrun-shell-protocol";
   *
   * export const failure: Failure = new Failure(FailureCode.PreShellData, "This data folder holds data of an older TeamRun.", new PreShellData("/home/person/.noldova/teamrun").toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The names of the events the shell publishes.
 */
export declare class ShellEvents {
  /**
   * `shell.notifications`: the runtime's notifications or a device's Do not disturb changed; its payload is a
   * `NotificationBroadcast`.
   */
  public static readonly notifications: QualifiedName;

  /**
   * `shell.settingsChanged`: a setting's value was set or reset; its payload
   * is a `SettingChange` with the value now in effect for its key.
   */
  public static readonly settingsChanged: QualifiedName;

  /**
   * `shell.work`: work began or ended in the runtime; its payload is a
   * `WorkReport` of all the work now in progress.
   */
  public static readonly work: QualifiedName;

  /**
   * `shell.commandsChanged`: a runtime command was registered or withdrawn,
   * or its enabled or checked state changed; its payload is the whole
   * `CommandList`, with a sequence greater than any list before it.
   */
  public static readonly commandsChanged: QualifiedName;

  /**
   * `shell.recentCommandsChanged`: a device ran a command from command search; its payload is that device's
   * `RecentCommands`.
   */
  public static readonly recentCommandsChanged: QualifiedName;
}

/**
 * The names of the shell's methods that every build understands. They never
 * change after protocol version 1.
 */
export declare class ShellMethods {
  /**
   * `shell.stop`: asks the runtime to stop; its payload is a `StopRequest`.
   */
  public static readonly stop: QualifiedName;

  /**
   * `shell.moveAside`: asks the runtime to move data that predates the
   * shell aside, after a `PreShellData` failure.
   */
  public static readonly moveAside: QualifiedName;

  /**
   * `shell.modules`: asks the runtime for every module of its build, what
   * its declaration says and where it stands; it answers with a
   * `ModuleStatusList`. A client that never asks
   * is unaffected.
   */
  public static readonly modules: QualifiedName;

  /**
   * `shell.work`: asks the runtime what work is in progress, without
   * stopping anything; it answers with a `WorkReport`.
   */
  public static readonly work: QualifiedName;

  /**
   * `shell.commands`: asks the runtime for the commands its active modules'
   * runtime parts registered; it answers with a `CommandList`.
   */
  public static readonly commands: QualifiedName;

  /**
   * `shell.runCommand`: runs a runtime command; its payload is a
   * `CommandRun` and its answer whatever the command returns. A command that
   * is not registered fails with `NotFound`.
   */
  public static readonly runCommand: QualifiedName;

  /**
   * `shell.notifications`: asks the runtime for its notifications; its payload is a `NotificationsQuery` and its answer a
   * `NotificationState` for that device.
   */
  public static readonly notifications: QualifiedName;

  /**
   * `shell.postNotification`: posts a notification for a window part; its payload is a `NotificationPost` whose kind its
   * module declares, and its answer the `NotificationReference` of the notification it created or replaced.
   */
  public static readonly postNotification: QualifiedName;

  /**
   * `shell.updateNotification`: replaces a posted notification's post; its payload is a `NotificationUpdate`. A
   * notification that is gone fails with `NotFound`.
   */
  public static readonly updateNotification: QualifiedName;

  /**
   * `shell.dismissNotification`: removes a notification; its payload is a `NotificationReference`. One that is already gone
   * is ignored.
   */
  public static readonly dismissNotification: QualifiedName;

  /**
   * `shell.markNotificationsRead`: marks every notification read, as opening the notifications list does; it takes no payload.
   */
  public static readonly markNotificationsRead: QualifiedName;

  /**
   * `shell.clearNotifications`: removes every notification that reports no work in progress, as the list's Clear all does;
   * it takes no payload.
   */
  public static readonly clearNotifications: QualifiedName;

  /**
   * `shell.readWindowBounds`: reads the bounds the desktop kept for a
   * window; its payload is a `WindowStateKey` and its answer a
   * `WindowStateValue`.
   */
  public static readonly readWindowBounds: QualifiedName;

  /**
   * `shell.writeWindowBounds`: keeps a window's bounds; its payload is a
   * `WindowStateWrite`.
   */
  public static readonly writeWindowBounds: QualifiedName;

  /**
   * `shell.readWindowLayout`: reads the layout a window kept; its payload is
   * a `WindowStateKey` and its answer a `WindowStateValue`.
   */
  public static readonly readWindowLayout: QualifiedName;

  /**
   * `shell.writeWindowLayout`: keeps a window's layout; its payload is a
   * `WindowStateWrite`.
   */
  public static readonly writeWindowLayout: QualifiedName;

  /**
   * `shell.settings`: asks for every setting's definition and its value for
   * the application; its payload is a `SettingsQuery` and its answer a
   * `SettingsSnapshot`.
   */
  public static readonly settings: QualifiedName;

  /**
   * `shell.setSetting`: sets a setting's value; its payload is a
   * `SettingValue`. An unknown setting fails with `NotFound`; a value the
   * setting does not accept, a scope it does not list, or a device setting
   * without a device fails with `InvalidParams`.
   */
  public static readonly setSetting: QualifiedName;

  /**
   * `shell.resetSetting`: returns a setting to the value of its enclosing
   * scopes or its default; its payload is a `SettingKey`. It fails as
   * `shell.setSetting` does.
   */
  public static readonly resetSetting: QualifiedName;

  /**
   * `shell.recentCommands`: asks for the commands a device ran recently from command search; its payload is a
   * `RecentCommandsQuery` and its answer that device's `RecentCommands`, without the device.
   */
  public static readonly recentCommands: QualifiedName;

  /**
   * `shell.recordCommand`: records that a device ran a command from command search; its payload is a `RecentCommandUse`.
   * The runtime keeps each device's 20 newest and publishes `shell.recentCommandsChanged`.
   */
  public static readonly recordCommand: QualifiedName;
}

/**
 * A key as a keyboard event reports it: what `KeyChord.matches` compares.
 * A DOM `KeyboardEvent` satisfies it.
 */
export interface IKeyStroke {
  /**
   * The key's value, such as `k`, `K`, `Enter` or `~`.
   */
  readonly key: string;

  /**
   * The physical key, such as `KeyK` or `Backquote`.
   */
  readonly code: string;

  /**
   * Whether Control is held.
   */
  readonly ctrlKey: boolean;

  /**
   * Whether Alt, or Option on macOS, is held.
   */
  readonly altKey: boolean;

  /**
   * Whether Shift is held.
   */
  readonly shiftKey: boolean;

  /**
   * Whether Cmd on macOS, or the Windows or Super key, is held.
   */
  readonly metaKey: boolean;
}

/**
 * One option of a choice setting: the value stored and the title people
 * see.
 */
export declare class SettingOption {
  /**
   * The value a setting holds when this option is chosen.
   */
  public readonly value: string;

  /**
   * The title people see.
   */
  public readonly title: string;

  /**
   * Creates the option.
   *
   * @param value The stored value; not blank.
   * @param title The title people see; not blank.
   * @throws ArgumentException synchronously when either is blank.
   *
   * @example
   * ```ts
   * import { SettingOption } from "@noldova/teamrun-shell-protocol";
   *
   * export const option: SettingOption = new SettingOption("Dark", "Dark");
   * ```
   */
  public constructor(value: string, title: string);

  /**
   * Reads an option from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The option.
   * @throws JsonException synchronously when a field is missing, blank or
   * not a string, or another field is present.
   *
   * @example
   * ```ts
   * import { SettingOption } from "@noldova/teamrun-shell-protocol";
   *
   * export const option: SettingOption = SettingOption.fromJson({ value: "Dark", title: "Dark" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): SettingOption;

  /**
   * Returns the wire form.
   *
   * @returns The `value` and `title` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { SettingOption } from "@noldova/teamrun-shell-protocol";
   *
   * export const json: JsonObject = new SettingOption("Dark", "Dark").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The type of a setting's value: its kind and the limits of that kind. It
 * decides which values a setting accepts.
 */
export declare class SettingType {
  /**
   * The kind of value.
   */
  public readonly kind: SettingKind;

  /**
   * A choice's options; empty for the other kinds.
   */
  public readonly options: readonly SettingOption[];

  /**
   * A number's minimum; `null` for the other kinds.
   */
  public readonly minimum: number | null;

  /**
   * A number's maximum; `null` for the other kinds.
   */
  public readonly maximum: number | null;

  /**
   * A number's step from its minimum; `null` for the other kinds.
   */
  public readonly step: number | null;

  /**
   * A text's maximum length; `null` for the other kinds.
   */
  public readonly maxLength: number | null;

  private constructor();

  /**
   * Creates the type of a setting that is on or off.
   *
   * @returns The boolean type.
   *
   * @example
   * ```ts
   * import { SettingType } from "@noldova/teamrun-shell-protocol";
   *
   * export const type: SettingType = SettingType.boolean();
   * ```
   */
  public static boolean(): SettingType;

  /**
   * Creates the type of a setting that holds one of its options' values.
   *
   * @param options The options; at least one, with distinct values.
   * @returns The choice type.
   * @throws ArgumentException synchronously when there is no option or two
   * share a value.
   *
   * @example
   * ```ts
   * import { SettingOption, SettingType } from "@noldova/teamrun-shell-protocol";
   *
   * export const type: SettingType = SettingType.choice([new SettingOption("Light", "Light"), new SettingOption("Dark", "Dark")]);
   * ```
   */
  public static choice(options: readonly SettingOption[]): SettingType;

  /**
   * Creates the type of a setting that holds a number from a minimum to a
   * maximum, in whole steps from the minimum.
   *
   * @param minimum The smallest value; finite.
   * @param maximum The largest value; finite and not below the minimum.
   * @param step The distance between values; finite and positive.
   * @returns The number type.
   * @throws ArgumentException synchronously when a limit is not finite, the
   * maximum is below the minimum or the step is not positive.
   *
   * @example
   * ```ts
   * import { SettingType } from "@noldova/teamrun-shell-protocol";
   *
   * export const type: SettingType = SettingType.number(12, 18, 1);
   * ```
   */
  public static number(minimum: number, maximum: number, step: number): SettingType;

  /**
   * Creates the type of a setting that holds a string up to a length.
   *
   * @param maxLength The longest string accepted; a positive integer.
   * @returns The text type.
   * @throws ArgumentException synchronously when the length is not a
   * positive integer.
   *
   * @example
   * ```ts
   * import { SettingType } from "@noldova/teamrun-shell-protocol";
   *
   * export const type: SettingType = SettingType.text(200);
   * ```
   */
  public static text(maxLength: number): SettingType;

  /**
   * Creates the type of a setting that holds a list of distinct module
   * ids.
   *
   * @returns The modules type.
   *
   * @example
   * ```ts
   * import { SettingType } from "@noldova/teamrun-shell-protocol";
   *
   * export const type: SettingType = SettingType.modules();
   * ```
   */
  public static modules(): SettingType;

  /**
   * Creates the type of the setting that holds the person's key bindings.
   *
   * @returns The key bindings type.
   *
   * @example
   * ```ts
   * import { SettingType } from "@noldova/teamrun-shell-protocol";
   *
   * export const type: SettingType = SettingType.keyBindings();
   * ```
   */
  public static keyBindings(): SettingType;

  /**
   * Reads a type from its wire form: `kind` and the fields of that kind.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The type.
   * @throws JsonException synchronously when the kind is unknown, a field of
   * the kind is missing or invalid, or a field of another kind is present.
   *
   * @example
   * ```ts
   * import { SettingType } from "@noldova/teamrun-shell-protocol";
   *
   * export const type: SettingType = SettingType.fromJson({ kind: "Number", minimum: 12, maximum: 18, step: 1 });
   * ```
   */
  public static fromJson(value: unknown, path?: string): SettingType;

  /**
   * Tells whether a value fits the type: a boolean; one of the options'
   * values; a number within the limits on a step; a string within the
   * length; a list of distinct, non-blank strings; or an object from
   * command names to `null` or a key `KeyChord.canBind` accepts for the
   * command.
   *
   * @param value The value.
   * @returns Whether the type accepts it.
   *
   * @example
   * ```ts
   * import { SettingType } from "@noldova/teamrun-shell-protocol";
   *
   * export const accepted: boolean = SettingType.number(12, 18, 1).accepts(14);
   * ```
   */
  public accepts(value: JsonValue): boolean;

  /**
   * Returns the wire form.
   *
   * @returns The `kind` field and the fields of that kind.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { SettingType } from "@noldova/teamrun-shell-protocol";
   *
   * export const json: JsonObject = SettingType.text(200).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * One object of a setting scope, such as one conversation: the scope's name
 * and the object's id. A value set for it overrides the values of the
 * scopes that enclose it.
 */
export declare class SettingScope {
  /**
   * The scope's name, which the module that owns the objects declares.
   */
  public readonly name: QualifiedName;

  /**
   * The object's id, as its owner defines it.
   */
  public readonly id: string;

  /**
   * Creates the scope reference.
   *
   * @param name The scope's name.
   * @param id The object's id; not blank.
   * @throws ArgumentException synchronously when the id is blank.
   *
   * @example
   * ```ts
   * import { QualifiedName, SettingScope } from "@noldova/teamrun-shell-protocol";
   *
   * export const scope: SettingScope = new SettingScope(QualifiedName.parse("chat.conversation"), "c42");
   * ```
   */
  public constructor(name: QualifiedName, id: string);

  /**
   * Reads a scope reference from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The scope reference.
   * @throws JsonException synchronously when the name is not a qualified
   * name, the id is blank, or another field is present.
   *
   * @example
   * ```ts
   * import { SettingScope } from "@noldova/teamrun-shell-protocol";
   *
   * export const scope: SettingScope = SettingScope.fromJson({ name: "chat.conversation", id: "c42" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): SettingScope;

  /**
   * Tells whether another reference names the same object of the same
   * scope.
   *
   * @param other The other reference, or `null`.
   * @returns Whether both name the same scope and id.
   *
   * @example
   * ```ts
   * import { QualifiedName, SettingScope } from "@noldova/teamrun-shell-protocol";
   *
   * const name: QualifiedName = QualifiedName.parse("chat.conversation");
   * export const same: boolean = new SettingScope(name, "c42").equals(new SettingScope(name, "c42"));
   * ```
   */
  public equals(other: SettingScope | null): boolean;

  /**
   * Returns the wire form.
   *
   * @returns The `name` and `id` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { QualifiedName, SettingScope } from "@noldova/teamrun-shell-protocol";
   *
   * export const json: JsonObject = new SettingScope(QualifiedName.parse("chat.conversation"), "c42").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A setting's definition: what it is, the values it accepts, its default,
 * where its value is kept, the scopes that may override it, and where
 * Settings shows it. A module declares its own in `settings.json`; the
 * shell declares its own the same way.
 */
export declare class SettingDefinition {
  /**
   * The setting's name, `<owner>.<name>`.
   */
  public readonly name: QualifiedName;

  /**
   * The title people see.
   */
  public readonly title: string;

  /**
   * What the setting does, in a sentence.
   */
  public readonly description: string;

  /**
   * The values it accepts.
   */
  public readonly type: SettingType;

  /**
   * The value in effect when none is set.
   */
  public readonly defaultValue: JsonValue;

  /**
   * Whether the value is kept per device or shared.
   */
  public readonly locality: SettingLocality;

  /**
   * The scopes whose objects may override the application's value; none
   * for a device setting.
   */
  public readonly scopes: readonly QualifiedName[];

  /**
   * The Settings page that shows it.
   */
  public readonly page: string;

  /**
   * The group on that page.
   */
  public readonly group: string;

  /**
   * Creates the definition.
   *
   * @param name The setting's name.
   * @param title The title; not blank.
   * @param description The description; not blank.
   * @param type The values it accepts.
   * @param defaultValue The default; a value the type accepts.
   * @param locality Where the value is kept.
   * @param scopes The scopes that may override it; distinct, and none for a
   * device setting.
   * @param page The Settings page; not blank.
   * @param group The group on the page; not blank.
   * @throws ArgumentException synchronously when a text is blank, the type
   * does not accept the default, or the scopes repeat or are given for a
   * device setting.
   *
   * @example
   * ```ts
   * import { QualifiedName, SettingDefinition, SettingLocality, SettingType } from "@noldova/teamrun-shell-protocol";
   *
   * export const definition: SettingDefinition = new SettingDefinition(
   *   QualifiedName.parse("chat.sendWithEnter"), "Send with Enter", "Sends a message when Enter is pressed.",
   *   SettingType.boolean(), true, SettingLocality.Shared, [QualifiedName.parse("chat.conversation")], "Chat", "Composer");
   * ```
   */
  public constructor(
    name: QualifiedName,
    title: string,
    description: string,
    type: SettingType,
    defaultValue: JsonValue,
    locality: SettingLocality,
    scopes: readonly QualifiedName[],
    page: string,
    group: string);

  /**
   * Reads a definition from its wire form, the form `settings.json` uses.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The definition.
   * @throws JsonException synchronously when a field is missing or invalid
   * or another field is present.
   *
   * @example
   * ```ts
   * import { SettingDefinition } from "@noldova/teamrun-shell-protocol";
   *
   * export const definition: SettingDefinition = SettingDefinition.fromJson({
   *   name: "chat.sendWithEnter", title: "Send with Enter", description: "Sends a message when Enter is pressed.",
   *   type: { kind: "Boolean" }, default: true, locality: "Shared", scopes: [], page: "Chat", group: "Composer"
   * });
   * ```
   */
  public static fromJson(value: unknown, path?: string): SettingDefinition;

  /**
   * Tells whether objects of a scope may override the setting.
   *
   * @param scope The scope's name.
   * @returns Whether the setting lists the scope.
   *
   * @example
   * ```ts
   * import { QualifiedName, SettingDefinition, SettingLocality, SettingType } from "@noldova/teamrun-shell-protocol";
   *
   * const conversation: QualifiedName = QualifiedName.parse("chat.conversation");
   * export const scoped: boolean = new SettingDefinition(
   *   QualifiedName.parse("chat.sendWithEnter"), "Send with Enter", "Sends a message when Enter is pressed.",
   *   SettingType.boolean(), true, SettingLocality.Shared, [conversation], "Chat", "Composer").isScopedBy(conversation);
   * ```
   */
  public isScopedBy(scope: QualifiedName): boolean;

  /**
   * Returns the wire form.
   *
   * @returns The fields `fromJson` reads.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { QualifiedName, SettingDefinition, SettingLocality, SettingType } from "@noldova/teamrun-shell-protocol";
   *
   * export const json: JsonObject = new SettingDefinition(
   *   QualifiedName.parse("chat.sendWithEnter"), "Send with Enter", "Sends a message when Enter is pressed.",
   *   SettingType.boolean(), true, SettingLocality.Shared, [], "Chat", "Composer").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Which value of a setting is meant: the setting, the scope object it is
 * set for or `null` for the application, and the device for a device
 * setting. The payload of `shell.resetSetting`.
 */
export declare class SettingKey {
  /**
   * The setting's name.
   */
  public readonly name: QualifiedName;

  /**
   * The scope object, or `null` for the application.
   */
  public readonly scope: SettingScope | null;

  /**
   * The device, for a device setting; `null` otherwise.
   */
  public readonly device: string | null;

  /**
   * Creates the key.
   *
   * @param name The setting's name.
   * @param scope The scope object; `null` by default, the application.
   * @param device The device; `null` by default. Not blank when given.
   * @throws ArgumentException synchronously when the device is blank.
   *
   * @example
   * ```ts
   * import { QualifiedName, SettingKey } from "@noldova/teamrun-shell-protocol";
   *
   * export const key: SettingKey = new SettingKey(QualifiedName.parse("shell.doNotDisturb"), null, "1b4e28ba-2fa1-41d2-883f-0016d3cca427");
   * ```
   */
  public constructor(name: QualifiedName, scope?: SettingScope | null, device?: string | null);

  /**
   * Reads a key from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The key.
   * @throws JsonException synchronously when the name is missing or not a
   * qualified name, the scope or device is invalid, or another field is
   * present.
   *
   * @example
   * ```ts
   * import { SettingKey } from "@noldova/teamrun-shell-protocol";
   *
   * export const key: SettingKey = SettingKey.fromJson({ name: "chat.sendWithEnter", scope: { name: "chat.conversation", id: "c42" } });
   * ```
   */
  public static fromJson(value: unknown, path?: string): SettingKey;

  /**
   * Returns the wire form.
   *
   * @returns The `name` field, and the `scope` and `device` fields when
   * given.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { QualifiedName, SettingKey } from "@noldova/teamrun-shell-protocol";
   *
   * export const json: JsonObject = new SettingKey(QualifiedName.parse("shell.mode")).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A change to a setting's value for a key, the payload of
 * `shell.settingsChanged`: the value now in effect and whether a value is
 * stored for the key, false after a reset.
 */
export declare class SettingChange {
  /**
   * Which value changed.
   */
  public readonly key: SettingKey;

  /**
   * The value now in effect for the key.
   */
  public readonly value: JsonValue;

  /**
   * Whether a value is stored for the key: true after a set, false after a
   * reset, when the value comes from an enclosing scope or the default.
   */
  public readonly isSet: boolean;

  /**
   * Creates the change.
   *
   * @param key Which value changed.
   * @param value The value now in effect for the key.
   * @param isSet Whether a value is stored for the key.
   *
   * @example
   * ```ts
   * import { QualifiedName, SettingChange, SettingKey } from "@noldova/teamrun-shell-protocol";
   *
   * export const change: SettingChange = new SettingChange(new SettingKey(QualifiedName.parse("shell.mode")), "System", false);
   * ```
   */
  public constructor(key: SettingKey, value: JsonValue, isSet: boolean);

  /**
   * Reads a change from its wire form: the key's fields, `value` and `isSet`.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The change.
   * @throws JsonException synchronously when `value` or `isSet` is missing
   * or invalid, the key is invalid, or another field is present.
   *
   * @example
   * ```ts
   * import { SettingChange } from "@noldova/teamrun-shell-protocol";
   *
   * export const change: SettingChange = SettingChange.fromJson({ name: "shell.mode", value: "Dark", isSet: true });
   * ```
   */
  public static fromJson(value: unknown, path?: string): SettingChange;

  /**
   * Returns the wire form.
   *
   * @returns The key's fields, `value` and `isSet`.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { QualifiedName, SettingChange, SettingKey } from "@noldova/teamrun-shell-protocol";
   *
   * export const json: JsonObject = new SettingChange(new SettingKey(QualifiedName.parse("shell.mode")), "Dark", true).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A setting's value for a key: the payload of `shell.setSetting`.
 */
export declare class SettingValue {
  /**
   * Which value.
   */
  public readonly key: SettingKey;

  /**
   * The value.
   */
  public readonly value: JsonValue;

  /**
   * Creates the value.
   *
   * @param key Which value.
   * @param value The value.
   *
   * @example
   * ```ts
   * import { QualifiedName, SettingKey, SettingValue } from "@noldova/teamrun-shell-protocol";
   *
   * export const value: SettingValue = new SettingValue(new SettingKey(QualifiedName.parse("shell.mode")), "Dark");
   * ```
   */
  public constructor(key: SettingKey, value: JsonValue);

  /**
   * Reads a value from its wire form: the key's fields and `value`.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The value.
   * @throws JsonException synchronously when `value` is missing, the key is
   * invalid, or another field is present.
   *
   * @example
   * ```ts
   * import { SettingValue } from "@noldova/teamrun-shell-protocol";
   *
   * export const value: SettingValue = SettingValue.fromJson({ name: "shell.mode", value: "Dark" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): SettingValue;

  /**
   * Returns the wire form.
   *
   * @returns The key's fields and `value`.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { QualifiedName, SettingKey, SettingValue } from "@noldova/teamrun-shell-protocol";
   *
   * export const json: JsonObject = new SettingValue(new SettingKey(QualifiedName.parse("shell.mode")), "Dark").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A setting's value in effect for the application, and whether it is set
 * or the default.
 */
export declare class SettingEntry {
  /**
   * The setting's name.
   */
  public readonly name: QualifiedName;

  /**
   * The value in effect.
   */
  public readonly value: JsonValue;

  /**
   * Whether a value is set; `false` when the default is in effect.
   */
  public readonly isSet: boolean;

  /**
   * Creates the entry.
   *
   * @param name The setting's name.
   * @param value The value in effect.
   * @param isSet Whether a value is set.
   *
   * @example
   * ```ts
   * import { QualifiedName, SettingEntry } from "@noldova/teamrun-shell-protocol";
   *
   * export const entry: SettingEntry = new SettingEntry(QualifiedName.parse("shell.mode"), "System", false);
   * ```
   */
  public constructor(name: QualifiedName, value: JsonValue, isSet: boolean);

  /**
   * Reads an entry from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The entry.
   * @throws JsonException synchronously when a field is missing or invalid
   * or another field is present.
   *
   * @example
   * ```ts
   * import { SettingEntry } from "@noldova/teamrun-shell-protocol";
   *
   * export const entry: SettingEntry = SettingEntry.fromJson({ name: "shell.mode", value: "Dark", isSet: true });
   * ```
   */
  public static fromJson(value: unknown, path?: string): SettingEntry;

  /**
   * Returns the wire form.
   *
   * @returns The `name`, `value` and `isSet` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { QualifiedName, SettingEntry } from "@noldova/teamrun-shell-protocol";
   *
   * export const json: JsonObject = new SettingEntry(QualifiedName.parse("shell.mode"), "System", false).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The answer of `shell.settings`: every setting's definition and its entry
 * for the application.
 */
export declare class SettingsSnapshot {
  /**
   * The definitions.
   */
  public readonly definitions: readonly SettingDefinition[];

  /**
   * The entries, each for a defined setting.
   */
  public readonly entries: readonly SettingEntry[];

  /**
   * Creates the snapshot.
   *
   * @param definitions The definitions; distinct names.
   * @param entries The entries; distinct, each naming a definition.
   * @throws ArgumentException synchronously when a name repeats or an entry
   * names no definition.
   *
   * @example
   * ```ts
   * import { SettingsSnapshot } from "@noldova/teamrun-shell-protocol";
   *
   * export const snapshot: SettingsSnapshot = new SettingsSnapshot([], []);
   * ```
   */
  public constructor(definitions: readonly SettingDefinition[], entries: readonly SettingEntry[]);

  /**
   * Reads a snapshot from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The snapshot.
   * @throws JsonException synchronously when a list is missing, an item is
   * invalid, a name repeats or an entry names no definition, or another
   * field is present.
   *
   * @example
   * ```ts
   * import { SettingsSnapshot } from "@noldova/teamrun-shell-protocol";
   *
   * export const snapshot: SettingsSnapshot = SettingsSnapshot.fromJson({ definitions: [], entries: [] });
   * ```
   */
  public static fromJson(value: unknown, path?: string): SettingsSnapshot;

  /**
   * Returns the wire form.
   *
   * @returns The `definitions` and `entries` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { SettingsSnapshot } from "@noldova/teamrun-shell-protocol";
   *
   * export const json: JsonObject = new SettingsSnapshot([], []).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The payload of `shell.settings`: the device whose device settings the
 * answer gives. The desktop sets it for a window.
 */
export declare class SettingsQuery {
  /**
   * The device, or `null`, when device settings are at their defaults.
   */
  public readonly device: string | null;

  /**
   * Creates the query.
   *
   * @param device The device, or `null`; not blank when given.
   * @throws ArgumentException synchronously when the device is blank.
   *
   * @example
   * ```ts
   * import { SettingsQuery } from "@noldova/teamrun-shell-protocol";
   *
   * export const query: SettingsQuery = new SettingsQuery("1b4e28ba-2fa1-41d2-883f-0016d3cca427");
   * ```
   */
  public constructor(device: string | null);

  /**
   * Reads a query from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The query.
   * @throws JsonException synchronously when the device is blank or another
   * field is present.
   *
   * @example
   * ```ts
   * import { SettingsQuery } from "@noldova/teamrun-shell-protocol";
   *
   * export const query: SettingsQuery = SettingsQuery.fromJson({ device: "1b4e28ba-2fa1-41d2-883f-0016d3cca427" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): SettingsQuery;

  /**
   * Returns the wire form.
   *
   * @returns The `device` field when given.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { SettingsQuery } from "@noldova/teamrun-shell-protocol";
   *
   * export const json: JsonObject = new SettingsQuery(null).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * One key a chord ends with: a letter, a digit, a punctuation key, a named
 * key or a function key. Letters match the key's value, falling back to the
 * physical key when the layout's value is not a Latin letter; digits,
 * punctuation and Space match the physical key, since Shift and layouts
 * change their value; named and function keys match their value.
 */
export declare class KeyName {
  /**
   * The key's name in a chord's text, such as `K`, `1`, `Comma`, `Enter` or
   * `F2`.
   */
  public readonly token: string;

  /**
   * Whether the key is one of F1 to F24.
   */
  public readonly isFunctionKey: boolean;

  private constructor();

  /**
   * Finds a key by its name.
   *
   * @param token The name, as a chord's text writes it.
   * @returns The key, or `undefined` when the name is not one.
   *
   * @example
   * ```ts
   * import { KeyName } from "@noldova/teamrun-shell-protocol";
   *
   * export const comma: KeyName | undefined = KeyName.find("Comma");
   * ```
   */
  public static find(token: string): KeyName | undefined;

  /**
   * Finds the key a keyboard event reports, by the same rules as `matches`.
   *
   * @param stroke The key a keyboard event reports.
   * @returns The key, or `undefined` for a key no chord names, such as a
   * modifier pressed alone.
   *
   * @example
   * ```ts
   * import { KeyName } from "@noldova/teamrun-shell-protocol";
   *
   * export const pressed: KeyName | undefined = KeyName.fromStroke({ key: "<", code: "Comma", ctrlKey: false, altKey: false, shiftKey: true, metaKey: false });
   * ```
   */
  public static fromStroke(stroke: IKeyStroke): KeyName | undefined;

  /**
   * Tells whether a stroke is this key, whatever modifiers it has.
   *
   * @param stroke The key a keyboard event reports.
   * @returns `true` when the stroke is this key.
   *
   * @example
   * ```ts
   * import { KeyName } from "@noldova/teamrun-shell-protocol";
   *
   * export const isK: boolean = KeyName.find("K")?.matches({ key: "k", code: "KeyK", ctrlKey: true, altKey: false, shiftKey: false, metaKey: false }) === true;
   * ```
   */
  public matches(stroke: IKeyStroke): boolean;

  /**
   * Returns what menus show for the key.
   *
   * @param isMac Whether to follow macOS's convention, which shows symbols
   * such as `↩` for Enter.
   * @returns The label.
   *
   * @example
   * ```ts
   * import { KeyName } from "@noldova/teamrun-shell-protocol";
   *
   * export const label: string | undefined = KeyName.find("Escape")?.label(false);
   * ```
   */
  public label(isMac: boolean): string;
}

/**
 * A key with its modifiers, written as text such as `Mod+Shift+K`: any of
 * `Mod`, `Ctrl`, `Alt` and `Shift` joined by `+` to one key. `Mod` is Ctrl
 * on Windows and Linux and Cmd on macOS; `Ctrl` is Control everywhere. There
 * is no token for the Windows, Super or Meta key.
 */
export declare class KeyChord {
  /**
   * Whether the chord holds Mod: Ctrl on Windows and Linux, Cmd on macOS.
   */
  public readonly hasMod: boolean;

  /**
   * Whether the chord holds Control.
   */
  public readonly hasCtrl: boolean;

  /**
   * Whether the chord holds Alt, or Option on macOS.
   */
  public readonly hasAlt: boolean;

  /**
   * Whether the chord holds Shift.
   */
  public readonly hasShift: boolean;

  /**
   * The key the chord ends with.
   */
  public readonly key: KeyName;

  /**
   * The chord's text with its modifiers in the order Mod, Ctrl, Alt, Shift.
   */
  public readonly text: string;

  /**
   * Whether the chord could take typing: it has no Mod, Ctrl or Alt and is
   * not a function key, such as `K`, `Shift+K` or `Enter`.
   */
  public get isTypingKey(): boolean;

  private constructor();

  /**
   * Reads a chord from its text without throwing, for checks that only need
   * to know whether the text is a chord.
   *
   * @param text The chord, such as `Mod+Shift+K`.
   * @returns The chord, or `null` when `parse` would refuse the text.
   *
   * @example
   * ```ts
   * import { KeyChord } from "@noldova/teamrun-shell-protocol";
   *
   * export const chord: KeyChord | null = KeyChord.find("Mod+Shift+K");
   * ```
   */
  public static find(text: string): KeyChord | null;

  /**
   * Reads a chord from its text, with its modifiers in any order.
   *
   * @param text The chord, such as `Mod+Shift+K`.
   * @param parameterName The parameter a failure names; `key` by default.
   * @returns The chord.
   * @throws ArgumentException synchronously when the text is not a chord: an
   * unknown or repeated modifier, an unknown key, or both Mod and Ctrl.
   *
   * @example
   * ```ts
   * import { KeyChord } from "@noldova/teamrun-shell-protocol";
   *
   * export const chord: KeyChord = KeyChord.parse("Shift+Mod+K");
   * ```
   */
  public static parse(text: string, parameterName?: string): KeyChord;

  /**
   * Reads a chord a command may have as its default key. A default needs
   * Mod, Ctrl or Alt, or a function key, so that typing is never taken, and
   * must not be a key that editing or the operating system owns on any
   * platform: Mod+A, C, V, X, Z and Y and Mod+Shift+Z; on macOS Mod+Q, W,
   * H, M, Comma, Tab and Space and Mod+Alt+Escape; on Windows and Linux
   * Alt+F4, Alt+Tab and Mod+Escape.
   *
   * @param text The chord.
   * @param parameterName The parameter a failure names; `key` by default.
   * @returns The chord.
   * @throws ArgumentException synchronously when the text is not a chord,
   * has no modifier that guards typing, or is reserved; the message says
   * which.
   *
   * @example
   * ```ts
   * import { KeyChord } from "@noldova/teamrun-shell-protocol";
   *
   * export const chord: KeyChord = KeyChord.parseDefault("Mod+Alt+N");
   * ```
   */
  public static parseDefault(text: string, parameterName?: string): KeyChord;

  /**
   * Reads the chord a keyboard event presses on a platform, as the person
   * records a key. On Windows and Linux Ctrl reads as Mod; on macOS Cmd reads
   * as Mod and Control as Ctrl.
   *
   * @param stroke The key a keyboard event reports.
   * @param platform The platform, as in `process.platform`.
   * @returns The chord, or `null` when no chord can name the stroke: a key
   * the chords do not name, such as a modifier pressed alone, the Windows,
   * Super or Meta key on Windows and Linux, or Control and Cmd together on
   * macOS.
   *
   * @example
   * ```ts
   * import { KeyChord } from "@noldova/teamrun-shell-protocol";
   *
   * export const chord: KeyChord | null = KeyChord.fromStroke({ key: "k", code: "KeyK", ctrlKey: false, altKey: false, shiftKey: true, metaKey: true }, "darwin");
   * ```
   */
  public static fromStroke(stroke: IKeyStroke, platform: string): KeyChord | null;

  /**
   * Finds who owns the chord when editing or an operating system reserves it
   * on any platform.
   *
   * @param command The command the chord would be bound to, whose being a
   * shell command frees Mod+W and Mod+Comma; `null` for a module's default.
   * @returns `editing`, `macOS` or `Windows and Linux`, or `null` when the
   * chord is free.
   *
   * @example
   * ```ts
   * import { KeyChord } from "@noldova/teamrun-shell-protocol";
   *
   * export const owner: string | null = KeyChord.parse("Ctrl+C").findReservedOwner(null);
   * ```
   */
  public findReservedOwner(command: QualifiedName | null): string | null;

  /**
   * Tells whether the person may bind the chord to a command. A binding
   * follows the rules of `parseDefault`, except that a shell command may also
   * take Mod+W and Mod+Comma, which the shell handles itself.
   *
   * @param command The command.
   * @returns `true` when the chord does not take typing and nothing reserves
   * it for the command.
   *
   * @example
   * ```ts
   * import { KeyChord, QualifiedName } from "@noldova/teamrun-shell-protocol";
   *
   * export const isAllowed: boolean = KeyChord.parse("Mod+Comma").canBind(QualifiedName.parse("notes.create"));
   * ```
   */
  public canBind(command: QualifiedName): boolean;

  /**
   * Tells whether a keyboard event is this chord on a platform. The
   * modifiers must match exactly.
   *
   * @param stroke The key a keyboard event reports.
   * @param platform The platform, as in `process.platform`; `darwin` reads
   * Mod as Cmd.
   * @returns `true` when the stroke is this chord.
   *
   * @example
   * ```ts
   * import { KeyChord } from "@noldova/teamrun-shell-protocol";
   *
   * export const pressed: boolean = KeyChord.parse("Mod+K").matches({ key: "k", code: "KeyK", ctrlKey: false, altKey: false, shiftKey: false, metaKey: true }, "darwin");
   * ```
   */
  public matches(stroke: IKeyStroke, platform: string): boolean;

  /**
   * Tells whether two chords are the same keys on a platform: on Windows and
   * Linux Mod and Ctrl are the same key.
   *
   * @param other The other chord.
   * @param platform The platform, as in `process.platform`.
   * @returns `true` when both chords press the same keys there.
   *
   * @example
   * ```ts
   * import { KeyChord } from "@noldova/teamrun-shell-protocol";
   *
   * export const same: boolean = KeyChord.parse("Mod+K").isSameOn(KeyChord.parse("Ctrl+K"), "win32");
   * ```
   */
  public isSameOn(other: KeyChord, platform: string): boolean;

  /**
   * Returns what menus show for the chord, by the platform's convention:
   * macOS symbols in the order ⌃⌥⇧⌘ followed by the key, such as `⌥⇧⌘K`;
   * elsewhere names joined by `+`, such as `Ctrl+Alt+Shift+K`.
   *
   * @param platform The platform, as in `process.platform`.
   * @returns The label.
   *
   * @example
   * ```ts
   * import { KeyChord } from "@noldova/teamrun-shell-protocol";
   *
   * export const label: string = KeyChord.parse("Mod+Shift+K").label("darwin");
   * ```
   */
  public label(platform: string): string;

  /**
   * Returns the chord's text.
   *
   * @returns The text, as `text` holds it.
   *
   * @example
   * ```ts
   * import { KeyChord } from "@noldova/teamrun-shell-protocol";
   *
   * export const text: string = KeyChord.parse("Shift+Mod+K").toString();
   * ```
   */
  public toString(): string;
}

/**
 * A command a runtime part registered, as `shell.commands` reports it.
 */
export declare class CommandInfo {
  /**
   * The command's name, `<module id>.<name>`.
   */
  public readonly name: QualifiedName;

  /**
   * What menus and search show for the command.
   */
  public readonly title: string;

  /**
   * The command's icon, a Material Symbols name; `null` when it has none.
   */
  public readonly icon: string | null;

  /**
   * The key the command asks for, or `null`.
   */
  public readonly defaultKey: KeyChord | null;

  /**
   * Whether the command can run now, for any arguments.
   */
  public readonly isEnabled: boolean;

  /**
   * Whether the command is checked, for any arguments; `null` when it is
   * not a command that is checked or unchecked.
   */
  public readonly isChecked: boolean | null;

  /**
   * Creates the information.
   *
   * @param name The command's name.
   * @param title The title; not whitespace only.
   * @param icon The icon, not whitespace only, or `null`.
   * @param defaultKey The default key, or `null`.
   * @param isEnabled Whether the command can run now; `true` by default.
   * @param isChecked Whether it is checked, or `null`, the default, when it
   * is not checkable.
   * @throws ArgumentException synchronously when the title or the icon is
   * blank.
   *
   * @example
   * ```ts
   * import { CommandInfo, KeyChord, QualifiedName } from "@noldova/teamrun-shell-protocol";
   *
   * export const command: CommandInfo = new CommandInfo(QualifiedName.parse("clock.tick"), "Tick", "timer", KeyChord.parseDefault("Mod+Alt+T"));
   * export const paused: CommandInfo = new CommandInfo(QualifiedName.parse("clock.pause"), "Pause", null, null, true, false);
   * ```
   */
  public constructor(name: QualifiedName, title: string, icon: string | null, defaultKey: KeyChord | null, isEnabled?: boolean, isChecked?: boolean | null);

  /**
   * Reads the information from its wire form. Unknown fields are ignored.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The information.
   * @throws JsonException synchronously when `name` or `title` is missing or
   * invalid, or `icon`, `defaultKey`, `isEnabled` or `isChecked` is invalid;
   * its path names the field.
   *
   * @example
   * ```ts
   * import { CommandInfo } from "@noldova/teamrun-shell-protocol";
   *
   * export const command: CommandInfo = CommandInfo.fromJson({ name: "clock.tick", title: "Tick", defaultKey: "Mod+Alt+T", isEnabled: false });
   * ```
   */
  public static fromJson(value: unknown, path?: string): CommandInfo;

  /**
   * Returns the wire form.
   *
   * @returns The `name` and `title` fields, `icon` and `defaultKey` when the
   * command has them, `isEnabled` only when it is `false`, and `isChecked`
   * when the command is checkable.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { CommandInfo, QualifiedName } from "@noldova/teamrun-shell-protocol";
   *
   * export const json: JsonObject = new CommandInfo(QualifiedName.parse("clock.tick"), "Tick", null, null).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The runtime commands of the active modules, in registration order, with
 * their state: the answer to `shell.commands` and the payload of
 * `shell.commandsChanged`.
 */
export declare class CommandList {
  /**
   * The commands.
   */
  public readonly commands: readonly CommandInfo[];

  /**
   * The runtime's count of command changes when the list was taken; a list
   * with a greater sequence is newer.
   */
  public readonly sequence: number;

  /**
   * Creates the list.
   *
   * @param commands The commands, copied.
   * @param sequence The count of changes; a whole number from 0.
   * @throws ArgumentException synchronously when the sequence is not a whole
   * number from 0.
   *
   * @example
   * ```ts
   * import { CommandList } from "@noldova/teamrun-shell-protocol";
   *
   * export const list: CommandList = new CommandList([], 0);
   * ```
   */
  public constructor(commands: readonly CommandInfo[], sequence: number);

  /**
   * Reads the list from its wire form. Unknown fields are ignored.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The list.
   * @throws JsonException synchronously when `commands` or `sequence` is
   * missing or invalid, or an entry is invalid; its path names the field or
   * the entry.
   *
   * @example
   * ```ts
   * import { CommandList } from "@noldova/teamrun-shell-protocol";
   *
   * export const list: CommandList = CommandList.fromJson({ commands: [{ name: "clock.tick", title: "Tick" }], sequence: 1 });
   * ```
   */
  public static fromJson(value: unknown, path?: string): CommandList;

  /**
   * Returns the wire form.
   *
   * @returns The `commands` and `sequence` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { CommandList } from "@noldova/teamrun-shell-protocol";
   *
   * export const json: JsonObject = new CommandList([], 0).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A request to run a runtime command: the payload of `shell.runCommand`.
 */
export declare class CommandRun {
  /**
   * The command's name.
   */
  public readonly name: QualifiedName;

  /**
   * The command's arguments; `null` when it takes none.
   */
  public readonly commandArguments: JsonValue;

  /**
   * Creates the request.
   *
   * @param name The command's name.
   * @param commandArguments The arguments.
   *
   * @example
   * ```ts
   * import { CommandRun, QualifiedName } from "@noldova/teamrun-shell-protocol";
   *
   * export const run: CommandRun = new CommandRun(QualifiedName.parse("clock.tick"), null);
   * ```
   */
  public constructor(name: QualifiedName, commandArguments: JsonValue);

  /**
   * Reads the request from its wire form, which accepts no unknown fields.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The request.
   * @throws JsonException synchronously when `name` or `arguments` is
   * missing or invalid, or a field is unknown; its path names the field.
   *
   * @example
   * ```ts
   * import { CommandRun } from "@noldova/teamrun-shell-protocol";
   *
   * export const run: CommandRun = CommandRun.fromJson({ name: "clock.tick", arguments: { by: 2 } });
   * ```
   */
  public static fromJson(value: unknown, path?: string): CommandRun;

  /**
   * Returns the wire form.
   *
   * @returns The `name` and `arguments` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { CommandRun, QualifiedName } from "@noldova/teamrun-shell-protocol";
   *
   * export const json: JsonObject = new CommandRun(QualifiedName.parse("clock.tick"), null).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * An action a notification offers: a button that runs a command.
 */
export declare class NotificationAction {
  /**
   * The button's text.
   */
  public readonly title: string;

  /**
   * The command the button runs, with its arguments.
   */
  public readonly command: CommandRun;

  /**
   * Creates the action.
   *
   * @param title The button's text.
   * @param command The command and its arguments.
   * @throws ArgumentException synchronously when `title` is blank.
   *
   * @example
   * ```ts
   * import { CommandRun, NotificationAction, QualifiedName } from "@noldova/teamrun-shell-protocol";
   *
   * export const action: NotificationAction = new NotificationAction("Show", new CommandRun(QualifiedName.parse("clock.tick"), null));
   * ```
   */
  public constructor(title: string, command: CommandRun);

  /**
   * Reads the action from its wire form, which accepts no unknown fields.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The action.
   * @throws JsonException synchronously when `title` or `command` is missing or invalid, or a field is unknown; its path names the field.
   *
   * @example
   * ```ts
   * import { NotificationAction } from "@noldova/teamrun-shell-protocol";
   *
   * export const action: NotificationAction = NotificationAction.fromJson({ title: "Show", command: { name: "clock.tick", arguments: null } });
   * ```
   */
  public static fromJson(value: unknown, path?: string): NotificationAction;

  /**
   * Returns the wire form.
   *
   * @returns The `title` and `command` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { CommandRun, NotificationAction, QualifiedName } from "@noldova/teamrun-shell-protocol";
   *
   * export const json: JsonObject = new NotificationAction("Show", new CommandRun(QualifiedName.parse("clock.tick"), null)).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * What a module posts as a notification: the payload of `shell.postNotification`, and of an update.
 */
export declare class NotificationPost {
  /**
   * The most actions a notification offers: 2.
   */
  public static readonly maximumActions: number;

  /**
   * The progress of work whose share done is unknown.
   */
  public static readonly indeterminate: "indeterminate";

  /**
   * The notification's kind, one its module declares in `contributes.notifications`.
   */
  public readonly kind: QualifiedName;

  /**
   * The key that identifies it within its kind; posting the same kind and key again replaces it. `null` when it has none.
   */
  public readonly key: string | null;

  /**
   * The title.
   */
  public readonly title: string;

  /**
   * The text below the title; `null` when it has none.
   */
  public readonly text: string | null;

  /**
   * How serious it is.
   */
  public readonly severity: NotificationSeverity;

  /**
   * The command that opening the notification runs; `null` when opening it does nothing.
   */
  public readonly open: CommandRun | null;

  /**
   * Its actions, at most {@link NotificationPost.maximumActions}.
   */
  public readonly actions: readonly NotificationAction[];

  /**
   * The progress of the work it reports: a share from 0 to 1, {@link NotificationPost.indeterminate}, or `null` when it reports none.
   */
  public readonly progress: number | typeof NotificationPost.indeterminate | null;

  /**
   * Creates the post.
   *
   * @param kind The kind.
   * @param key The key within the kind, or `null`.
   * @param title The title.
   * @param text The text, or `null`.
   * @param severity The severity.
   * @param open The command opening it runs, or `null`.
   * @param actions The actions.
   * @param progress The progress, or `null`.
   * @throws ArgumentException synchronously when the key, the title or the text is blank, there are more than two actions, or the progress is a number outside 0 to 1.
   *
   * @example
   * ```ts
   * import { NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/teamrun-shell-protocol";
   *
   * export const post: NotificationPost = new NotificationPost(
   *   QualifiedName.parse("clock.alarm"), null, "Alarm", "It is time.", NotificationSeverity.Info, null, [], null);
   * ```
   */
  public constructor(
    kind: QualifiedName,
    key: string | null,
    title: string,
    text: string | null,
    severity: NotificationSeverity,
    open: CommandRun | null,
    actions: readonly NotificationAction[],
    progress: number | typeof NotificationPost.indeterminate | null);

  /**
   * Reads the post from its wire form, which accepts no unknown fields.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The post.
   * @throws JsonException synchronously when a field is missing, invalid or unknown; its path names the field.
   *
   * @example
   * ```ts
   * import { NotificationPost } from "@noldova/teamrun-shell-protocol";
   *
   * export const post: NotificationPost = NotificationPost.fromJson({ kind: "clock.alarm", title: "Alarm", severity: "Info", actions: [], progress: 0.5 });
   * ```
   */
  public static fromJson(value: unknown, path?: string): NotificationPost;

  /**
   * Returns the wire form.
   *
   * @returns The `kind`, `title`, `severity` and `actions` fields, and `key`, `text`, `open` and `progress` when set.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/teamrun-shell-protocol";
   *
   * export const json: JsonObject = new NotificationPost(QualifiedName.parse("clock.alarm"), null, "Alarm", null, NotificationSeverity.Info, null, [], null).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A notification the runtime holds: what its module posted, with its id, time and whether it was read.
 */
export declare class Notification {
  /**
   * The id the runtime gave it, from 1.
   */
  public readonly id: number;

  /**
   * Its place in the order the runtime received posts, from 1: each post and re-post takes the next number, and an update
   * keeps it.
   */
  public readonly sequence: number;

  /**
   * What its module posted, as last updated.
   */
  public readonly post: NotificationPost;

  /**
   * When it was first posted, as an ISO 8601 date and time.
   */
  public readonly postedAt: string;

  /**
   * Whether the person has seen it in the notifications list.
   */
  public readonly isRead: boolean;

  /**
   * Creates the notification.
   *
   * @param id The id.
   * @param sequence Its place in the order of posts.
   * @param post What was posted.
   * @param postedAt When it was posted.
   * @param isRead Whether it was read.
   * @throws ArgumentException synchronously when the id or the sequence is not a whole number from 1 or the time is not a date
   * and time.
   *
   * @example
   * ```ts
   * import { Notification, NotificationPost } from "@noldova/teamrun-shell-protocol";
   *
   * export function hold(post: NotificationPost): Notification {
   *   return new Notification(1, 1, post, new Date().toISOString(), false);
   * }
   * ```
   */
  public constructor(id: number, sequence: number, post: NotificationPost, postedAt: string, isRead: boolean);

  /**
   * Reads the notification from its wire form, which accepts no unknown fields.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The notification.
   * @throws JsonException synchronously when a field is missing, invalid or unknown; its path names the field.
   *
   * @example
   * ```ts
   * import { Notification } from "@noldova/teamrun-shell-protocol";
   *
   * export const notification: Notification = Notification.fromJson({
   *   id: 1, sequence: 1, post: { kind: "clock.alarm", title: "Alarm", severity: "Info", actions: [] }, postedAt: "2026-10-03T08:00:00.000Z", isRead: false
   * });
   * ```
   */
  public static fromJson(value: unknown, path?: string): Notification;

  /**
   * Returns the wire form.
   *
   * @returns The `id`, `sequence`, `post`, `postedAt` and `isRead` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import type { Notification } from "@noldova/teamrun-shell-protocol";
   *
   * export function write(notification: Notification): JsonObject {
   *   return notification.toJson();
   * }
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The runtime's notifications, newest first, as the runtime holds them; `NotificationState` and `NotificationBroadcast` carry
 * them on the wire.
 */
export declare class NotificationList {
  /**
   * The notifications, newest first.
   */
  public readonly notifications: readonly Notification[];

  /**
   * Creates the list.
   *
   * @param notifications The notifications, newest first.
   *
   * @example
   * ```ts
   * import { NotificationList } from "@noldova/teamrun-shell-protocol";
   *
   * export const list: NotificationList = new NotificationList([]);
   * ```
   */
  public constructor(notifications: readonly Notification[]);

  /**
   * Reads the list from its wire form, which accepts no unknown fields.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The list.
   * @throws JsonException synchronously when `notifications` is missing or invalid, or a field is unknown; its path names the field.
   *
   * @example
   * ```ts
   * import { NotificationList } from "@noldova/teamrun-shell-protocol";
   *
   * export const list: NotificationList = NotificationList.fromJson({ notifications: [] });
   * ```
   */
  public static fromJson(value: unknown, path?: string): NotificationList;

  /**
   * Returns the wire form.
   *
   * @returns The `notifications` field.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { NotificationList } from "@noldova/teamrun-shell-protocol";
   *
   * export const json: JsonObject = new NotificationList([]).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A change to a posted notification: the payload of `shell.updateNotification`.
 */
export declare class NotificationUpdate {
  /**
   * The notification's id.
   */
  public readonly id: number;

  /**
   * What replaces its post; its kind stays the notification's own.
   */
  public readonly post: NotificationPost;

  /**
   * Creates the update.
   *
   * @param id The notification's id.
   * @param post The new post.
   * @throws ArgumentException synchronously when the id is not a whole number from 1.
   *
   * @example
   * ```ts
   * import { NotificationPost, NotificationUpdate } from "@noldova/teamrun-shell-protocol";
   *
   * export function change(id: number, post: NotificationPost): NotificationUpdate {
   *   return new NotificationUpdate(id, post);
   * }
   * ```
   */
  public constructor(id: number, post: NotificationPost);

  /**
   * Reads the update from its wire form, which accepts no unknown fields.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The update.
   * @throws JsonException synchronously when `id` or `post` is missing or invalid, or a field is unknown; its path names the field.
   *
   * @example
   * ```ts
   * import { NotificationUpdate } from "@noldova/teamrun-shell-protocol";
   *
   * export const update: NotificationUpdate = NotificationUpdate.fromJson({ id: 1, post: { kind: "clock.alarm", title: "Alarm", severity: "Info", actions: [] } });
   * ```
   */
  public static fromJson(value: unknown, path?: string): NotificationUpdate;

  /**
   * Returns the wire form.
   *
   * @returns The `id` and `post` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import type { NotificationUpdate } from "@noldova/teamrun-shell-protocol";
   *
   * export function write(update: NotificationUpdate): JsonObject {
   *   return update.toJson();
   * }
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A notification named by its id: the answer of `shell.postNotification` and the payload of `shell.dismissNotification`.
 */
export declare class NotificationReference {
  /**
   * The notification's id.
   */
  public readonly id: number;

  /**
   * Creates the reference.
   *
   * @param id The notification's id.
   * @throws ArgumentException synchronously when the id is not a whole number from 1.
   *
   * @example
   * ```ts
   * import { NotificationReference } from "@noldova/teamrun-shell-protocol";
   *
   * export const reference: NotificationReference = new NotificationReference(1);
   * ```
   */
  public constructor(id: number);

  /**
   * Reads the reference from its wire form, which accepts no unknown fields.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The reference.
   * @throws JsonException synchronously when `id` is missing or invalid, or a field is unknown; its path names the field.
   *
   * @example
   * ```ts
   * import { NotificationReference } from "@noldova/teamrun-shell-protocol";
   *
   * export const reference: NotificationReference = NotificationReference.fromJson({ id: 1 });
   * ```
   */
  public static fromJson(value: unknown, path?: string): NotificationReference;

  /**
   * Returns the wire form.
   *
   * @returns The `id` field.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { NotificationReference } from "@noldova/teamrun-shell-protocol";
   *
   * export const json: JsonObject = new NotificationReference(1).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A device's question for the runtime's notifications: the payload of `shell.notifications`, which the desktop sends for its
 * window, adding its own device.
 */
export declare class NotificationsQuery {
  /**
   * The device whose Do not disturb the answer reports.
   */
  public readonly device: string;

  /**
   * Creates the query.
   *
   * @param device The device's id.
   * @throws ArgumentException synchronously when the device is blank.
   *
   * @example
   * ```ts
   * import { NotificationsQuery } from "@noldova/teamrun-shell-protocol";
   *
   * export const query: NotificationsQuery = new NotificationsQuery("laptop");
   * ```
   */
  public constructor(device: string);

  /**
   * Reads the query from its wire form, which accepts no unknown fields.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The query.
   * @throws JsonException synchronously when `device` is missing or invalid, or a field is unknown; its path names the field.
   *
   * @example
   * ```ts
   * import { NotificationsQuery } from "@noldova/teamrun-shell-protocol";
   *
   * export const query: NotificationsQuery = NotificationsQuery.fromJson({ device: "laptop" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): NotificationsQuery;

  /**
   * Returns the wire form.
   *
   * @returns The `device` field.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { NotificationsQuery } from "@noldova/teamrun-shell-protocol";
   *
   * export const json: JsonObject = new NotificationsQuery("laptop").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The notifications as one device sees them: the answer of `shell.notifications`, and what the desktop forwards to its window
 * for each `shell.notifications` event.
 */
export declare class NotificationState {
  /**
   * The notifications, newest first.
   */
  public readonly notifications: readonly Notification[];

  /**
   * Whether Do not disturb is on for the device.
   */
  public readonly isDoNotDisturb: boolean;

  /**
   * The modules whose notifications are muted: they stay in the list but show no toast or operating system notification
   * and count as read.
   */
  public readonly mutedModules: readonly string[];

  /**
   * The sequence of the runtime's latest post, or 0 before any; a later notification has a higher sequence.
   */
  public readonly sequence: number;

  /**
   * Creates the state.
   *
   * @param notifications The notifications, newest first.
   * @param isDoNotDisturb Whether Do not disturb is on for the device.
   * @param mutedModules The modules whose notifications are muted.
   * @param sequence The sequence of the latest post.
   * @throws ArgumentException synchronously when a muted module is blank or the sequence is not a whole number from 0.
   *
   * @example
   * ```ts
   * import { NotificationState } from "@noldova/teamrun-shell-protocol";
   *
   * export const state: NotificationState = new NotificationState([], false, ["clock"], 0);
   * ```
   */
  public constructor(notifications: readonly Notification[], isDoNotDisturb: boolean, mutedModules: readonly string[], sequence: number);

  /**
   * Reads the state from its wire form, which accepts no unknown fields.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The state.
   * @throws JsonException synchronously when a field is missing, invalid or unknown; its path names the field.
   *
   * @example
   * ```ts
   * import { NotificationState } from "@noldova/teamrun-shell-protocol";
   *
   * export const state: NotificationState = NotificationState.fromJson({ notifications: [], isDoNotDisturb: true, mutedModules: [], sequence: 4 });
   * ```
   */
  public static fromJson(value: unknown, path?: string): NotificationState;

  /**
   * Returns the wire form.
   *
   * @returns The `notifications`, `isDoNotDisturb`, `mutedModules` and `sequence` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { NotificationState } from "@noldova/teamrun-shell-protocol";
   *
   * export const json: JsonObject = new NotificationState([], false, [], 0).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The payload of the `shell.notifications` event: the notifications and the devices with Do not disturb on. The desktop
 * forwards it to its window as the state for its own device.
 */
export declare class NotificationBroadcast {
  /**
   * The notifications, newest first.
   */
  public readonly notifications: readonly Notification[];

  /**
   * The devices with Do not disturb on.
   */
  public readonly quietDevices: readonly string[];

  /**
   * The modules whose notifications are muted.
   */
  public readonly mutedModules: readonly string[];

  /**
   * The sequence of the runtime's latest post, or 0 before any.
   */
  public readonly sequence: number;

  /**
   * Creates the broadcast.
   *
   * @param notifications The notifications, newest first.
   * @param quietDevices The devices with Do not disturb on.
   * @param mutedModules The modules whose notifications are muted.
   * @param sequence The sequence of the latest post.
   * @throws ArgumentException synchronously when a device or a muted module is blank or the sequence is not a whole number
   * from 0.
   *
   * @example
   * ```ts
   * import { NotificationBroadcast } from "@noldova/teamrun-shell-protocol";
   *
   * export const broadcast: NotificationBroadcast = new NotificationBroadcast([], ["laptop"], ["clock"], 0);
   * ```
   */
  public constructor(notifications: readonly Notification[], quietDevices: readonly string[], mutedModules: readonly string[], sequence: number);

  /**
   * Reads the broadcast from its wire form, which accepts no unknown fields.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The broadcast.
   * @throws JsonException synchronously when a field is missing, invalid or unknown; its path names the field.
   *
   * @example
   * ```ts
   * import { NotificationBroadcast } from "@noldova/teamrun-shell-protocol";
   *
   * export const broadcast: NotificationBroadcast = NotificationBroadcast.fromJson({ notifications: [], quietDevices: [], mutedModules: [], sequence: 0 });
   * ```
   */
  public static fromJson(value: unknown, path?: string): NotificationBroadcast;

  /**
   * Returns the state one device sees.
   *
   * @param device The device's id.
   * @returns The notifications, the muted modules and the sequence, with Do not disturb on when the device is among the
   * quiet ones.
   *
   * @example
   * ```ts
   * import { NotificationBroadcast, type NotificationState } from "@noldova/teamrun-shell-protocol";
   *
   * export const state: NotificationState = new NotificationBroadcast([], ["laptop"], [], 0).stateFor("laptop");
   * ```
   */
  public stateFor(device: string): NotificationState;

  /**
   * Returns the wire form.
   *
   * @returns The `notifications`, `quietDevices`, `mutedModules` and `sequence` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { NotificationBroadcast } from "@noldova/teamrun-shell-protocol";
   *
   * export const json: JsonObject = new NotificationBroadcast([], [], [], 0).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A device's question for the commands it ran recently: the payload of `shell.recentCommands`, which the desktop sends for
 * its window, adding its own device.
 */
export declare class RecentCommandsQuery {
  /**
   * The device whose recent commands the answer lists.
   */
  public readonly device: string;

  /**
   * Creates the query.
   *
   * @param device The device's id.
   * @throws ArgumentException synchronously when the device is blank.
   *
   * @example
   * ```ts
   * import { RecentCommandsQuery } from "@noldova/teamrun-shell-protocol";
   *
   * export const query: RecentCommandsQuery = new RecentCommandsQuery("laptop");
   * ```
   */
  public constructor(device: string);

  /**
   * Reads the query from its wire form, which accepts no unknown fields.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The query.
   * @throws JsonException synchronously when `device` is missing or invalid, or a field is unknown; its path names the field.
   *
   * @example
   * ```ts
   * import { RecentCommandsQuery } from "@noldova/teamrun-shell-protocol";
   *
   * export const query: RecentCommandsQuery = RecentCommandsQuery.fromJson({ device: "laptop" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): RecentCommandsQuery;

  /**
   * Returns the wire form.
   *
   * @returns The `device` field.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { RecentCommandsQuery } from "@noldova/teamrun-shell-protocol";
   *
   * export const json: JsonObject = new RecentCommandsQuery("laptop").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A command a device ran from command search: the payload of `shell.recordCommand`, which the desktop sends for its window,
 * adding its own device.
 */
export declare class RecentCommandUse {
  /**
   * The device that ran the command.
   */
  public readonly device: string;

  /**
   * The command's id, as command search names it.
   */
  public readonly id: string;

  /**
   * Creates the use.
   *
   * @param device The device's id.
   * @param id The command's id.
   * @throws ArgumentException synchronously when the device or the id is blank.
   *
   * @example
   * ```ts
   * import { RecentCommandUse } from "@noldova/teamrun-shell-protocol";
   *
   * export const use: RecentCommandUse = new RecentCommandUse("laptop", "shell.openSettings");
   * ```
   */
  public constructor(device: string, id: string);

  /**
   * Reads the use from its wire form, which accepts no unknown fields.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The use.
   * @throws JsonException synchronously when `device` or `id` is missing or invalid, or a field is unknown; its path names
   * the field.
   *
   * @example
   * ```ts
   * import { RecentCommandUse } from "@noldova/teamrun-shell-protocol";
   *
   * export const use: RecentCommandUse = RecentCommandUse.fromJson({ device: "laptop", id: "shell.openSettings" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): RecentCommandUse;

  /**
   * Returns the wire form.
   *
   * @returns The `device` and `id` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { RecentCommandUse } from "@noldova/teamrun-shell-protocol";
   *
   * export const json: JsonObject = new RecentCommandUse("laptop", "shell.openSettings").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The commands a device ran recently from command search, newest first: the answer of `shell.recentCommands` and the
 * payload of the `shell.recentCommandsChanged` event. The event names the device; the desktop forwards it only to that
 * device's windows, without the device.
 */
export declare class RecentCommands {
  /**
   * The commands' ids, newest first, each once.
   */
  public readonly ids: readonly string[];

  /**
   * The device that ran the commands, or `null` when the list is already that device's.
   */
  public readonly device: string | null;

  /**
   * Creates the list.
   *
   * @param ids The commands' ids, newest first.
   * @param device The device's id, or `null`; `null` by default.
   * @throws ArgumentException synchronously when an id or the device is blank, or an id is listed twice.
   *
   * @example
   * ```ts
   * import { RecentCommands } from "@noldova/teamrun-shell-protocol";
   *
   * export const recent: RecentCommands = new RecentCommands(["shell.openSettings", "clock.show"], "laptop");
   * ```
   */
  public constructor(ids: readonly string[], device?: string | null);

  /**
   * Reads the list from its wire form, which accepts no unknown fields; `device` may be left out.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The list.
   * @throws JsonException synchronously when `ids` is missing, a field is invalid or unknown, or an id is listed twice; its
   * path names the field.
   *
   * @example
   * ```ts
   * import { RecentCommands } from "@noldova/teamrun-shell-protocol";
   *
   * export const recent: RecentCommands = RecentCommands.fromJson({ ids: ["clock.show"], device: "laptop" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): RecentCommands;

  /**
   * Returns the wire form.
   *
   * @returns The `ids` field, and `device` when there is one.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { RecentCommands } from "@noldova/teamrun-shell-protocol";
   *
   * export const json: JsonObject = new RecentCommands(["clock.show"]).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A message of the local protocol. Its wire form is a JSON object whose
 * `kind` field names the message kind. Fields a message does not know are
 * ignored when it is read, except in a handshake, which carries the
 * capability token and accepts no unknown fields.
 */
export declare abstract class WireMessage {
  /**
   * The message's kind.
   */
  public abstract readonly kind: WireMessageKind;

  /**
   * Returns the wire form.
   *
   * @returns The `kind` field followed by the message's own fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { Cancel } from "@noldova/teamrun-shell-protocol";
   *
   * export const json: JsonObject = new Cancel("r1").toJson();
   * ```
   */
  public toJson(): JsonObject;

  /**
   * Returns the wire form as JSON text, without line breaks.
   *
   * @returns The JSON text.
   *
   * @example
   * ```ts
   * import { Cancel } from "@noldova/teamrun-shell-protocol";
   *
   * export const text: string = new Cancel("r1").toText();
   * ```
   */
  public toText(): string;

  /**
   * Returns the message's own fields, without `kind`.
   *
   * @returns The fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/teamrun-foundation-json";
   * import { WireMessage, WireMessageKind } from "@noldova/teamrun-shell-protocol";
   *
   * export class Notice extends WireMessage {
   *   public readonly kind: WireMessageKind = WireMessageKind.Event;
   *
   *   protected toJsonFields(): JsonObject {
   *     return { name: "shell.notice", payload: null };
   *   }
   * }
   * ```
   */
  protected abstract toJsonFields(): JsonObject;
}

/**
 * The first message a client sends on a connection. The runtime answers it
 * with a response carrying the same id: its own identity on success, or a
 * failure such as `UnsupportedVersion`, `BuildMismatch` or `Unauthorized`.
 */
export declare class Handshake extends WireMessage {
  /**
   * Always `Handshake`.
   */
  public override readonly kind: WireMessageKind;

  /**
   * The id the response carries.
   */
  public readonly id: string;

  /**
   * The client's build identity.
   */
  public readonly identity: BuildIdentity;

  /**
   * The runtime's capability token, read from its discovery metadata.
   */
  public readonly token: string;

  /**
   * The kind of client, such as `desktop` or `cli`.
   */
  public readonly client: string;

  /**
   * Creates the handshake.
   *
   * @param id The id the response carries; not whitespace only.
   * @param identity The client's build identity.
   * @param token The capability token; not whitespace only.
   * @param client The kind of client; not whitespace only.
   * @throws ArgumentException synchronously when the id, token or client is
   * empty or whitespace only.
   *
   * @example
   * ```ts
   * import { BuildIdentity, Handshake } from "@noldova/teamrun-shell-protocol";
   *
   * export function greet(identity: BuildIdentity, token: string): Handshake {
   *   return new Handshake("h1", identity, token, "cli");
   * }
   * ```
   */
  public constructor(id: string, identity: BuildIdentity, token: string, client: string);

  /**
   * Reads a handshake from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The handshake.
   * @throws JsonException synchronously when a field is unknown, missing, has
   * the wrong type or breaks the constructor's rules, in the handshake or its
   * identity; its path names the field.
   *
   * @example
   * ```ts
   * import { Handshake } from "@noldova/teamrun-shell-protocol";
   *
   * export function readHandshake(value: unknown): Handshake {
   *   return Handshake.fromJson(value);
   * }
   * ```
   */
  public static fromJson(value: unknown, path?: string): Handshake;

  /**
   * Returns the handshake's own fields.
   *
   * @returns The `id`, `identity`, `token` and `client` fields.
   *
   * @example
   * ```ts
   * import { BuildIdentity, Handshake } from "@noldova/teamrun-shell-protocol";
   *
   * export const text: string = new Handshake("h1", new BuildIdentity("0.0.1", 1, "9f2c41"), "token", "desktop").toText();
   * ```
   */
  protected override toJsonFields(): JsonObject;
}

/**
 * A call of a method. The runtime answers it with exactly one response with
 * the same id, unless the connection closes first.
 */
export declare class Request extends WireMessage {
  /**
   * Always `Request`.
   */
  public override readonly kind: WireMessageKind;

  /**
   * The id that correlates the response; unique among the connection's
   * unanswered requests.
   */
  public readonly id: string;

  /**
   * The method's name.
   */
  public readonly method: QualifiedName;

  /**
   * The method's arguments, as the method's owner defines them.
   */
  public readonly payload: JsonValue;

  /**
   * How long the runtime may take before it answers with
   * `DeadlineExceeded`, in milliseconds; absent when the request has no
   * time limit.
   */
  public readonly timeoutMilliseconds?: number;

  /**
   * Creates the request.
   *
   * @param id The correlation id; not whitespace only.
   * @param method The method's name.
   * @param payload The method's arguments.
   * @param timeoutMilliseconds The time limit in milliseconds, a positive
   * integer; omit it for no time limit.
   * @throws ArgumentException synchronously when the id is empty or
   * whitespace only.
   * @throws ArgumentOutOfRangeException synchronously when the time limit is
   * not a positive integer.
   *
   * @example
   * ```ts
   * import { QualifiedName, Request } from "@noldova/teamrun-shell-protocol";
   *
   * export const capture: Request = new Request("r7", QualifiedName.parse("checkpoints.capture"), { folder: "f1" }, 30_000);
   * ```
   */
  public constructor(id: string, method: QualifiedName, payload: JsonValue, timeoutMilliseconds?: number);

  /**
   * Reads a request from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The request.
   * @throws JsonException synchronously when a field is missing, has the
   * wrong type or breaks the constructor's or the name's rules; its path
   * names the field.
   *
   * @example
   * ```ts
   * import { Request } from "@noldova/teamrun-shell-protocol";
   *
   * export const request: Request = Request.fromJson({ id: "r7", method: "checkpoints.capture", payload: null });
   * ```
   */
  public static fromJson(value: unknown, path?: string): Request;

  /**
   * Returns the request's own fields.
   *
   * @returns The `id`, `method` and `payload` fields, and
   * `timeoutMilliseconds` when the request has a time limit.
   *
   * @example
   * ```ts
   * import { QualifiedName, Request } from "@noldova/teamrun-shell-protocol";
   *
   * export const text: string = new Request("r7", QualifiedName.parse("shell.ping"), null).toText();
   * ```
   */
  protected override toJsonFields(): JsonObject;
}

/**
 * The answer to a handshake or a request: a payload on success or a failure.
 */
export declare class Response extends WireMessage {
  /**
   * Always `Response`.
   */
  public override readonly kind: WireMessageKind;

  /**
   * The id of the handshake or request it answers, or `null` when the
   * failed message could not be read far enough to find its id.
   */
  public readonly id: string | null;

  /**
   * The result on success, which may be `null`; absent on failure.
   */
  public readonly payload?: JsonValue;

  /**
   * Why the call failed; absent on success.
   */
  public readonly failure?: Failure;

  /**
   * True when the response carries a failure.
   */
  public get hasFailed(): boolean;

  private constructor();

  /**
   * Creates a successful response.
   *
   * @param id The id of the message it answers; not whitespace only.
   * @param payload The result.
   * @returns The response.
   * @throws ArgumentException synchronously when the id is empty or
   * whitespace only.
   *
   * @example
   * ```ts
   * import { Response } from "@noldova/teamrun-shell-protocol";
   *
   * export const response: Response = Response.success("r7", { captured: true });
   * ```
   */
  public static success(id: string, payload: JsonValue): Response;

  /**
   * Creates a failed response.
   *
   * @param id The id of the message it answers, not whitespace only, or
   * `null` when it is unknown.
   * @param failure Why the call failed.
   * @returns The response.
   * @throws ArgumentException synchronously when the id is empty or
   * whitespace only.
   *
   * @example
   * ```ts
   * import { Failure, FailureCode, Response } from "@noldova/teamrun-shell-protocol";
   *
   * export const response: Response = Response.failure("r7", new Failure(FailureCode.UnknownMethod, "No part registered checkpoints.capture."));
   * ```
   */
  public static failure(id: string | null, failure: Failure): Response;

  /**
   * Reads a response from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The response.
   * @throws JsonException synchronously when it carries neither or both of
   * `payload` and `failure`, or when a field is missing, has the wrong type
   * or breaks the rules; its path names the field.
   *
   * @example
   * ```ts
   * import { Response } from "@noldova/teamrun-shell-protocol";
   *
   * export function isSuccessful(value: unknown): boolean {
   *   return !Response.fromJson(value).hasFailed;
   * }
   * ```
   */
  public static fromJson(value: unknown, path?: string): Response;

  /**
   * Returns the response's own fields.
   *
   * @returns The `id` field and either `payload` or `failure`.
   *
   * @example
   * ```ts
   * import { Response } from "@noldova/teamrun-shell-protocol";
   *
   * export const text: string = Response.success("r7", null).toText();
   * ```
   */
  protected override toJsonFields(): JsonObject;
}

/**
 * A notification to connected clients. Clients reconcile events with the
 * state they load, because a reconnecting client can miss some.
 */
export declare class Event extends WireMessage {
  /**
   * Always `Event`.
   */
  public override readonly kind: WireMessageKind;

  /**
   * The event's name.
   */
  public readonly name: QualifiedName;

  /**
   * The event's data, as the event's owner defines it.
   */
  public readonly payload: JsonValue;

  /**
   * Creates the event.
   *
   * @param name The event's name.
   * @param payload The event's data.
   *
   * @example
   * ```ts
   * import { Event, QualifiedName } from "@noldova/teamrun-shell-protocol";
   *
   * export const changed: Event = new Event(QualifiedName.parse("checkpoints.captured"), { folder: "f1" });
   * ```
   */
  public constructor(name: QualifiedName, payload: JsonValue);

  /**
   * Reads an event from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The event.
   * @throws JsonException synchronously when a field is missing, has the
   * wrong type or the name breaks its rules; its path names the field.
   *
   * @example
   * ```ts
   * import { Event } from "@noldova/teamrun-shell-protocol";
   *
   * export const event: Event = Event.fromJson({ name: "checkpoints.captured", payload: null });
   * ```
   */
  public static fromJson(value: unknown, path?: string): Event;

  /**
   * Returns the event's own fields.
   *
   * @returns The `name` and `payload` fields.
   *
   * @example
   * ```ts
   * import { Event, QualifiedName } from "@noldova/teamrun-shell-protocol";
   *
   * export const text: string = new Event(QualifiedName.parse("shell.changed"), null).toText();
   * ```
   */
  protected override toJsonFields(): JsonObject;
}

/**
 * Asks the runtime to stop an unanswered request. The runtime stops the
 * work it owns and answers the request with `Cancelled`; a request that has
 * already been answered is not affected.
 */
export declare class Cancel extends WireMessage {
  /**
   * Always `Cancel`.
   */
  public override readonly kind: WireMessageKind;

  /**
   * The id of the request to stop.
   */
  public readonly id: string;

  /**
   * Creates the cancellation.
   *
   * @param id The id of the request to stop; not whitespace only.
   * @throws ArgumentException synchronously when the id is empty or
   * whitespace only.
   *
   * @example
   * ```ts
   * import { Cancel } from "@noldova/teamrun-shell-protocol";
   *
   * export const cancel: Cancel = new Cancel("r7");
   * ```
   */
  public constructor(id: string);

  /**
   * Reads a cancellation from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The cancellation.
   * @throws JsonException synchronously when the id is missing, not a string
   * or blank.
   *
   * @example
   * ```ts
   * import { Cancel } from "@noldova/teamrun-shell-protocol";
   *
   * export const cancel: Cancel = Cancel.fromJson({ id: "r7" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): Cancel;

  /**
   * Returns the cancellation's own fields.
   *
   * @returns The `id` field.
   *
   * @example
   * ```ts
   * import { Cancel } from "@noldova/teamrun-shell-protocol";
   *
   * export const text: string = new Cancel("r7").toText();
   * ```
   */
  protected override toJsonFields(): JsonObject;
}

/**
 * Creates models from wire forms. A model's constructor reports a broken rule
 * as an `ArgumentException` naming the parameter; read from the wire, the
 * same failure becomes a `JsonException` whose path names the field. Message
 * models of modules use it in their `fromJson` too.
 */
export declare class WireContract {
  /**
   * Rejects fields a security-sensitive message does not define.
   *
   * @param reader The reader of the message's object.
   * @param fields Every field the message defines, including `kind` when it
   * is a whole message.
   * @throws JsonException synchronously when the object has another field;
   * its path names the first such field.
   *
   * @example
   * ```ts
   * import { JsonReader } from "@noldova/teamrun-foundation-json";
   * import { WireContract } from "@noldova/teamrun-shell-protocol";
   *
   * export function readStrict(value: unknown): JsonReader {
   *   const reader = JsonReader.fromValue(value);
   *   WireContract.requireKnownFields(reader, ["name"]);
   *   return reader;
   * }
   * ```
   */
  public static requireKnownFields(reader: JsonReader, fields: readonly string[]): void;

  /**
   * Runs a model's factory and translates its argument failures.
   *
   * @param reader The reader of the object the model is read from; its path
   * prefixes a failure's field.
   * @param factory Creates the model; it is called once, synchronously.
   * @returns The model the factory created.
   * @throws JsonException synchronously when the factory throws an
   * `ArgumentException`: its path is the reader's path followed by the
   * exception's parameter name, or the reader's path alone when it has
   * none, and the exception is its cause. Any other failure propagates
   * unchanged.
   *
   * @example
   * ```ts
   * import { JsonReader } from "@noldova/teamrun-foundation-json";
   * import { QualifiedName, WireContract } from "@noldova/teamrun-shell-protocol";
   *
   * export function readName(value: unknown): QualifiedName {
   *   const reader = JsonReader.fromValue(value);
   *   return WireContract.create(reader, () => QualifiedName.parse(reader.readString("name"), "name"));
   * }
   * ```
   */
  public static create<T>(reader: JsonReader, factory: () => T): T;
}

/**
 * Reads messages from their JSON text.
 */
export declare class WireDecoder {
  /**
   * Reads one message.
   *
   * @param text One frame's JSON text.
   * @returns The message, as the class its `kind` names.
   * @throws JsonException synchronously when the text is not JSON, not an
   * object, has an unknown kind or is not a valid message of its kind; its
   * path names the field.
   *
   * @example
   * ```ts
   * import { WireDecoder, type WireMessage } from "@noldova/teamrun-shell-protocol";
   *
   * export function decodeAll(frames: readonly string[]): readonly WireMessage[] {
   *   const decoder = new WireDecoder();
   *   return frames.map(t => decoder.decode(t));
   * }
   * ```
   */
  public decode(text: string): WireMessage;
}

/**
 * Splits a connection's text into frames: one message per line. Text after
 * the last line break is kept until the rest of its frame arrives. After it
 * throws, the reader must not be used again and the connection closes.
 *
 * The reader works on text: the transport decodes UTF-8 and sets its own
 * limit in bytes. The frame limit here counts characters, which are UTF-16
 * code units.
 */
export declare class FrameReader {
  /**
   * Creates the reader.
   *
   * @param maximumFrameLength The longest frame accepted, in characters; a
   * positive integer, 16 MiB by default.
   * @throws ArgumentOutOfRangeException synchronously when the maximum is not
   * a positive integer.
   *
   * @example
   * ```ts
   * import { FrameReader } from "@noldova/teamrun-shell-protocol";
   *
   * export const reader: FrameReader = new FrameReader(1024 * 1024);
   * ```
   */
  public constructor(maximumFrameLength?: number);

  /**
   * Reads the frames a chunk completes.
   *
   * @param chunk The next text received, decoded by the transport.
   * @returns The complete frames, in order, without their line breaks;
   * blank lines are skipped.
   * @throws ProtocolException synchronously with `FrameTooLarge` when a
   * frame, complete or not, exceeds the maximum length.
   *
   * @example
   * ```ts
   * import { FrameReader } from "@noldova/teamrun-shell-protocol";
   *
   * export const frames: string[] = new FrameReader().read("{\"kind\":\"Cancel\",\"id\":\"r1\"}\n{\"kind\"");
   * ```
   */
  public read(chunk: string): string[];
}

/**
 * Turns messages into frames. The frame limit counts characters, which are
 * UTF-16 code units; the transport encodes the text as UTF-8.
 */
export declare class FrameWriter {
  /**
   * Creates the writer.
   *
   * @param maximumFrameLength The longest frame written, in characters; a
   * positive integer, 16 MiB by default.
   * @throws ArgumentOutOfRangeException synchronously when the maximum is not
   * a positive integer.
   *
   * @example
   * ```ts
   * import { FrameWriter } from "@noldova/teamrun-shell-protocol";
   *
   * export const writer: FrameWriter = new FrameWriter(1024 * 1024);
   * ```
   */
  public constructor(maximumFrameLength?: number);

  /**
   * Writes one message as a frame.
   *
   * @param message The message.
   * @returns The message's JSON text followed by a line break.
   * @throws ProtocolException synchronously with `FrameTooLarge` when the
   * text exceeds the maximum length.
   *
   * @example
   * ```ts
   * import { Cancel, FrameWriter } from "@noldova/teamrun-shell-protocol";
   *
   * export const frame: string = new FrameWriter().write(new Cancel("r7"));
   * ```
   */
  public write(message: WireMessage): string;
}
