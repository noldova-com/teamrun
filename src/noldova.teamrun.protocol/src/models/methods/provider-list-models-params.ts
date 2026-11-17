/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";

export class ProviderListModelsParams {
  public readonly kind: string;
  public readonly providerId: string | null;
  public readonly refresh: boolean;
  public readonly workingDirectory: string | null;

  public constructor(kind: string, providerId: string | null, refresh: boolean = false, workingDirectory: string | null = null) {
    ArgumentException.throwIfNullOrWhitespace(kind, Resources.kindField);
    if (!Object.isNull(providerId))
      ArgumentException.throwIfNullOrWhitespace(providerId, Resources.providerIdField);

    this.kind = kind;
    this.providerId = providerId;
    this.refresh = refresh;
    this.workingDirectory = workingDirectory;
  }

  public static fromJson(value: unknown, path?: string): ProviderListModelsParams {
    const reader = JsonReader.fromValue(value, path);
    return new ProviderListModelsParams(reader.readNonBlankString(Resources.kindField), reader.readNullableString(Resources.providerIdField),
      reader.hasField(Resources.refreshField) ? reader.readBoolean(Resources.refreshField) : false,
      reader.hasField(Resources.workingDirectoryField) ? reader.readNullableString(Resources.workingDirectoryField) : null);
  }

  public toJson(): JsonObject {
    return {
      [Resources.kindField]: this.kind,
      [Resources.providerIdField]: this.providerId,
      [Resources.refreshField]: this.refresh,
      ...Object.isNull(this.workingDirectory) ? {} : { [Resources.workingDirectoryField]: this.workingDirectory }
    };
  }
}
