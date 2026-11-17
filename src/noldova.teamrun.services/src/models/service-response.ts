/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ServiceResponseStatus } from "../enums/service-response-status.js";
import { ServiceException } from "../exceptions/service.exception.js";
import type { ServiceResponseInfo } from "./service-response-info.js";

export class ServiceResponse<T> {
  public readonly status: ServiceResponseStatus;
  public readonly info: ServiceResponseInfo | null;
  public readonly payload: T | null;

  private constructor(status: ServiceResponseStatus, info: ServiceResponseInfo | null, payload: T | null) {
    this.status = status;
    this.info = info;
    this.payload = payload;
  }

  public get hasErrors(): boolean {
    return this.status === ServiceResponseStatus.Failure;
  }

  public static success<T>(payload: T): ServiceResponse<T> {
    return new ServiceResponse(ServiceResponseStatus.Success, null, payload);
  }

  public static failure<T>(info: ServiceResponseInfo): ServiceResponse<T> {
    return new ServiceResponse<T>(ServiceResponseStatus.Failure, info, null);
  }

  public static from<T>(other: ServiceResponse<unknown>): ServiceResponse<T> {
    return new ServiceResponse<T>(other.status, other.info, null);
  }

  public static fromError<T>(error: unknown, fallback: ServiceResponseInfo): ServiceResponse<T> {
    return ServiceResponse.failure(error instanceof ServiceException ? error.info : fallback);
  }
}
