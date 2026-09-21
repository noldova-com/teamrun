/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject, type JsonValue } from "@noldova/teamrun-foundation-json";
import { ServiceResponse, ServiceResponseInfo, ServiceResponseStatus } from "@noldova/teamrun-foundation-services";

import { ErrorCode } from "../enums/error-code.js";
import { WireMessageKind } from "../enums/wire-message-kind.js";
import { Resources } from "../resources.js";
import type { PayloadReader } from "../types/payload.reader.js";
import type { PayloadWriter } from "../types/payload-writer.js";
import { WireMessage } from "./wire-message.js";

export class Response extends WireMessage {
  private static readonly CODES: readonly ErrorCode[] = Object.values(ErrorCode);
  private static readonly STATUSES: readonly ServiceResponseStatus[] = Object.values(ServiceResponseStatus);

  public override readonly kind: WireMessageKind = WireMessageKind.Response;
  public readonly id: string | null;
  public readonly status: ServiceResponseStatus;
  public readonly info: ServiceResponseInfo | null;
  public readonly payload: JsonValue;

  private constructor(id: string | null, status: ServiceResponseStatus, info: ServiceResponseInfo | null, payload: JsonValue) {
    super();
    if (!Object.isNull(id))
      ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    if (status === ServiceResponseStatus.Success && !Object.isNull(info))
      throw new ArgumentException(Resources.successForbidsInfo, Resources.infoField);
    if (status === ServiceResponseStatus.Failure && Object.isNull(info))
      throw new ArgumentException(Resources.failureRequiresInfo, Resources.infoField);
    if (status === ServiceResponseStatus.Failure && !Object.isNull(payload))
      throw new ArgumentException(Resources.failureForbidsPayload, Resources.payloadField);
    if (!Object.isNull(info) && !Response.CODES.some(t => t === info.name))
      throw new ArgumentException(Resources.unknownErrorCode, Resources.infoField);

    this.id = id;
    this.status = status;
    this.info = info;
    this.payload = payload;
  }

  public get hasErrors(): boolean {
    return this.status === ServiceResponseStatus.Failure;
  }

  public static success(id: string | null, payload: JsonValue): Response {
    return new Response(id, ServiceResponseStatus.Success, null, payload);
  }

  public static failure(id: string | null, info: ServiceResponseInfo): Response {
    return new Response(id, ServiceResponseStatus.Failure, info, null);
  }

  public static fromServiceResponse<T>(id: string | null, response: ServiceResponse<T>, writePayload: PayloadWriter<T>): Response {
    if (!Object.isNull(response.info))
      return Response.failure(id, response.info);

    return Response.success(id, Object.isNull(response.payload) ? null : writePayload(response.payload));
  }

  public static fromJson(value: unknown, path?: string): Response {
    const reader = JsonReader.fromValue(value, path);
    const info = reader.readNullableObject(Resources.infoField);
    return new Response(
      reader.readNullableString(Resources.idField),
      reader.readOneOf(Resources.statusField, Response.STATUSES),
      Object.isNull(info) ? null : Response.readInfo(info),
      reader.readValue(Resources.payloadField));
  }

  public withPayload<T>(readPayload: PayloadReader<T>): ServiceResponse<T> {
    if (!Object.isNull(this.info))
      return ServiceResponse.failure<T>(this.info);
    if (Object.isNull(this.payload))
      return ServiceResponse.from<T>(ServiceResponse.success(null));

    return ServiceResponse.success(readPayload(this.payload, Resources.payloadPath));
  }

  protected override toJsonFields(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.statusField]: this.status,
      [Resources.infoField]: Object.isNull(this.info) ? null : Response.writeInfo(this.info),
      [Resources.payloadField]: this.payload
    };
  }

  private static readInfo(reader: JsonReader): ServiceResponseInfo {
    return new ServiceResponseInfo(
      reader.readOneOf(Resources.nameField, Response.CODES),
      reader.readNonBlankString(Resources.messageField),
      reader.readStringArray(Resources.argumentsField));
  }

  private static writeInfo(info: ServiceResponseInfo): JsonObject {
    return { [Resources.nameField]: info.name, [Resources.messageField]: info.message, [Resources.argumentsField]: [...info.arguments] };
  }
}
