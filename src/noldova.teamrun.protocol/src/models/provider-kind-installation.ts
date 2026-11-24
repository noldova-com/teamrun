/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { ProviderKindInstallState } from "../enums/provider-kind-install-state.js";
import { Resources } from "../resources.js";

export class ProviderKindInstallation {
  public readonly kind: string;
  public readonly state: ProviderKindInstallState;
  public readonly reason: string | null;
  public readonly received: number;
  public readonly total: number;
  public readonly version: string | null;
  public readonly update: string | null;
  public readonly cancellable: boolean;
  public readonly missingTool: string | null;
  public readonly foundPath: string | null;
  public readonly notice: string | null;

  public constructor(kind: string, state: ProviderKindInstallState, reason: string | null = null, received: number = 0, total: number = 0,
    version: string | null = null, update: string | null = null, cancellable: boolean = true, missingTool: string | null = null,
    foundPath: string | null = null, notice: string | null = null) {
    ArgumentException.throwIfNullOrWhitespace(kind, Resources.kindField);

    this.kind = kind;
    this.state = state;
    this.reason = reason;
    this.received = received;
    this.total = total;
    this.version = version;
    this.update = update;
    this.cancellable = cancellable;
    this.missingTool = missingTool;
    this.foundPath = foundPath;
    this.notice = notice;
  }

  public static fromJson(value: unknown, path?: string): ProviderKindInstallation {
    const reader = JsonReader.fromValue(value, path);
    return new ProviderKindInstallation(
      reader.readNonBlankString(Resources.kindField),
      reader.readOneOf(Resources.stateField, Object.values(ProviderKindInstallState)),
      reader.readNullableString(Resources.reasonField),
      reader.readInteger(Resources.receivedField),
      reader.readInteger(Resources.totalField),
      reader.readNullableString(Resources.versionField),
      reader.readNullableString(Resources.updateField),
      reader.readBoolean(Resources.cancellableField),
      reader.hasField(Resources.missingToolField) ? reader.readNullableString(Resources.missingToolField) : null,
      reader.hasField(Resources.foundPathField) ? reader.readNullableString(Resources.foundPathField) : null,
      reader.hasField(Resources.noticeField) ? reader.readNullableString(Resources.noticeField) : null);
  }

  public toJson(): JsonObject {
    return {
      [Resources.kindField]: this.kind,
      [Resources.stateField]: this.state,
      [Resources.reasonField]: this.reason,
      [Resources.receivedField]: this.received,
      [Resources.totalField]: this.total,
      [Resources.versionField]: this.version,
      [Resources.updateField]: this.update,
      [Resources.cancellableField]: this.cancellable,
      [Resources.missingToolField]: this.missingTool,
      [Resources.foundPathField]: this.foundPath,
      [Resources.noticeField]: this.notice
    };
  }
}
