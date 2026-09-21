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
 * Whether a service honoured a request.
 */
export declare enum ServiceResponseStatus {
  /**
   * The request was honoured; the response carries the payload, when the
   * service produces one.
   */
  Success = "Success",
  /**
   * The request was not honoured; the response carries the info that says
   * why, and no payload.
   */
  Failure = "Failure"
}

/**
 * Why a request was not honoured, as data a client can act on: a name the
 * client keys on, the developer-readable message, and the arguments a client
 * formats into its own localized text.
 */
export declare class ServiceResponseInfo {
  /**
   * The failure's identity, such as `notFound`; the value a client and its
   * dictionary key on.
   */
  public readonly name: string;

  /**
   * The developer-readable message.
   */
  public readonly message: string;

  /**
   * The parameters of the failure, in order, for a client that formats its
   * own text; a copy.
   */
  public readonly arguments: readonly string[];

  /**
   * Initializes the info. A blank name or message throws
   * `ArgumentException`; the arguments default to none.
   */
  public constructor(name: string, message: string, args?: readonly string[]);
}

/**
 * The throwing form of a failure: a service throws it, and the boundary turns
 * it into a failure response with `ServiceResponse.fromError`, keeping the
 * cause for diagnostics.
 */
export declare class ServiceException extends Exception {
  /**
   * The failure as response info.
   */
  public readonly info: ServiceResponseInfo;

  /**
   * Initializes the exception with the info's name, message, and arguments
   * and optional options carrying the cause. A blank name or message throws
   * `ArgumentException`.
   */
  public constructor(name: string, message: string, args?: readonly string[], options?: ExceptionOptions);
}

/**
 * A request to a service: a typed payload and nothing else. An application
 * that needs more on every request, such as a caller credential or a wire
 * form, extends the class.
 */
export declare class ServiceRequest<T> {
  /**
   * The payload.
   */
  public readonly payload: T;

  /**
   * Initializes the request.
   */
  public constructor(payload: T);
}

/**
 * The answer of a service: a status, the info that explains a failure, and
 * the payload of a success. A success carries no info and a failure carries
 * no payload; a success may carry no payload either, for a request that
 * produces nothing. Instances come from the factories.
 */
export declare class ServiceResponse<T> {
  /**
   * Whether the request was honoured.
   */
  public readonly status: ServiceResponseStatus;

  /**
   * Why the request was not honoured; `null` on success.
   */
  public readonly info: ServiceResponseInfo | null;

  /**
   * What the service produced; `null` on failure, and on a success that
   * produces nothing.
   */
  public readonly payload: T | null;

  /**
   * True when the status is `Failure`.
   */
  public get hasErrors(): boolean;

  /**
   * Returns a success carrying the payload.
   */
  public static success<T>(payload: T): ServiceResponse<T>;

  /**
   * Returns a failure carrying the info.
   */
  public static failure<T>(info: ServiceResponseInfo): ServiceResponse<T>;

  /**
   * Returns a response with another response's status and info and no
   * payload: the way an inner failure travels outward through a layer that
   * answers with a different payload type.
   */
  public static from<T>(other: ServiceResponse<unknown>): ServiceResponse<T>;

  /**
   * Returns the failure for a caught error: a `ServiceException` gives its
   * own info, anything else gives the fallback, so a boundary handles every
   * outcome in one line.
   */
  public static fromError<T>(error: unknown, fallback: ServiceResponseInfo): ServiceResponse<T>;

  private constructor(status: ServiceResponseStatus, info: ServiceResponseInfo | null, payload: T | null);
}
