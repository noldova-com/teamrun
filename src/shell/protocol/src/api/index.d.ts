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
   * A frame exceeds the connection's maximum length; the connection closes.
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
   */
  public static parse(text: string, parameterName?: string): QualifiedName;

  /**
   * Compares two names.
   *
   * @param other The other name.
   * @returns True when both have the same text.
   */
  public equals(other: QualifiedName): boolean;

  /**
   * Returns the full name.
   *
   * @returns `owner.member`.
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
   */
  public static fromJson(value: unknown, path?: string): BuildIdentity;

  /**
   * Checks whether this identity's runtime can serve a client.
   *
   * @param other The client's identity.
   * @returns `UnsupportedVersion` when the protocol versions differ,
   * `BuildMismatch` when the fingerprints or product versions differ, and
   * `null` when the client is served.
   */
  public findMismatch(other: BuildIdentity): FailureCode | null;

  /**
   * Returns the wire form.
   *
   * @returns The `productVersion`, `protocolVersion` and `fingerprint`
   * fields.
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
   */
  public static fromJson(value: unknown, path?: string): Failure;

  /**
   * Returns the wire form.
   *
   * @returns The `code` and `message` fields, and `details` when the
   * failure has them.
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
   */
  public static fromJson(value: unknown, path?: string): RuntimeHandover;

  /**
   * Returns the wire form.
   *
   * @returns The `identity` and `executablePath` fields.
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
   */
  public static fromJson(value: unknown, path?: string): StopRequest;

  /**
   * Returns the wire form.
   *
   * @returns The `policy` field.
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
   */
  public static fromJson(value: unknown, path?: string): RunningWork;

  /**
   * Returns the wire form.
   *
   * @returns The `descriptions` field.
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
   */
  public static fromJson(value: unknown, path?: string): PreShellData;

  /**
   * Returns the wire form.
   *
   * @returns The `location` field.
   */
  public toJson(): JsonObject;
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
   */
  public toJson(): JsonObject;

  /**
   * Returns the wire form as JSON text, without line breaks.
   *
   * @returns The JSON text.
   */
  public toText(): string;

  /**
   * Returns the message's own fields, without `kind`.
   *
   * @returns The fields.
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
   */
  public static fromJson(value: unknown, path?: string): Handshake;

  /**
   * Returns the handshake's own fields.
   *
   * @returns The `id`, `identity`, `token` and `client` fields.
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
   */
  public static fromJson(value: unknown, path?: string): Request;

  /**
   * Returns the request's own fields.
   *
   * @returns The `id`, `method` and `payload` fields, and
   * `timeoutMilliseconds` when the request has a time limit.
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

  /**
   * Creates a successful response.
   *
   * @param id The id of the message it answers; not whitespace only.
   * @param payload The result.
   * @returns The response.
   * @throws ArgumentException synchronously when the id is empty or
   * whitespace only.
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
   */
  public static fromJson(value: unknown, path?: string): Response;

  /**
   * Returns the response's own fields.
   *
   * @returns The `id` field and either `payload` or `failure`.
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
   */
  public static fromJson(value: unknown, path?: string): Event;

  /**
   * Returns the event's own fields.
   *
   * @returns The `name` and `payload` fields.
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
   */
  public static fromJson(value: unknown, path?: string): Cancel;

  /**
   * Returns the cancellation's own fields.
   *
   * @returns The `id` field.
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
   */
  public constructor(maximumFrameLength?: number);

  /**
   * Writes one message as a frame.
   *
   * @param message The message.
   * @returns The message's JSON text followed by a line break.
   * @throws ProtocolException synchronously with `FrameTooLarge` when the
   * text exceeds the maximum length.
   */
  public write(message: WireMessage): string;
}
