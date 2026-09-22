/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { InstallationRole } from "../enums/installation-role.js";
import { Resources } from "../resources.js";
import { Endpoint } from "./endpoint.js";

export class InstallationMember {
  public readonly id: string;
  public readonly role: InstallationRole;
  public readonly processId: number;
  public readonly dataDirectory: string;
  public readonly productVersion: string;
  public readonly endpoint: Endpoint | null;
  public readonly token: string | null;

  public constructor(id: string, role: InstallationRole, processId: number, dataDirectory: string, productVersion: string,
    endpoint: Endpoint | null, token: string | null) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.installationIdField);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(processId, Resources.processIdField);
    ArgumentException.throwIfNullOrWhitespace(dataDirectory, Resources.installationDataDirectoryField);
    ArgumentException.throwIfNullOrWhitespace(productVersion, Resources.productVersionField);
    if (Object.isNull(endpoint) !== Object.isNull(token))
      throw new ArgumentException(Resources.installationEndpointInvalid, Resources.endpointField);
    if (!Object.isNull(token))
      ArgumentException.throwIfNullOrWhitespace(token, Resources.tokenField);

    this.id = id;
    this.role = role;
    this.processId = processId;
    this.dataDirectory = dataDirectory;
    this.productVersion = productVersion;
    this.endpoint = endpoint;
    this.token = token;
  }

  public withEndpoint(endpoint: Endpoint, token: string): InstallationMember {
    return new InstallationMember(this.id, this.role, this.processId, this.dataDirectory, this.productVersion, endpoint, token);
  }

  public static fromJson(value: unknown): InstallationMember {
    const reader = JsonReader.fromValue(value);
    const endpoint = reader.toJson()[Resources.endpointField];
    return new InstallationMember(reader.readNonBlankString(Resources.installationIdField),
      reader.readOneOf(Resources.installationRoleField, Object.values(InstallationRole)), reader.readInteger(Resources.processIdField),
      reader.readNonBlankString(Resources.installationDataDirectoryField), reader.readNonBlankString(Resources.productVersionField),
      Object.isNull(endpoint) ? null : Endpoint.fromJson(endpoint), reader.readNullableString(Resources.tokenField));
  }

  public toJson(): JsonObject {
    return { [Resources.installationIdField]: this.id, [Resources.installationRoleField]: this.role, [Resources.processIdField]: this.processId,
      [Resources.installationDataDirectoryField]: this.dataDirectory, [Resources.productVersionField]: this.productVersion,
      [Resources.endpointField]: this.endpoint?.toJson() ?? null, [Resources.tokenField]: this.token };
  }
}
