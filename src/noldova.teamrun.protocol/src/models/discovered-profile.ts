/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { AuthStatus } from "../enums/auth-status.js";
import { Resources } from "../resources.js";
import { ProviderIdentity } from "./provider-identity.js";

export class DiscoveredProfile {
  public readonly kind: string;
  public readonly profileDir: string;
  public readonly label: string;
  public readonly usual: boolean;
  public readonly authStatus: AuthStatus;
  public readonly identity: ProviderIdentity | null;

  public constructor(kind: string, profileDir: string, label: string, usual: boolean, authStatus: AuthStatus, identity: ProviderIdentity | null = null) {
    ArgumentException.throwIfNullOrWhitespace(kind, Resources.kindField);
    ArgumentException.throwIfNullOrWhitespace(profileDir, Resources.profileDirField);
    ArgumentException.throwIfNullOrWhitespace(label, Resources.labelField);

    this.kind = kind;
    this.profileDir = profileDir;
    this.label = label;
    this.usual = usual;
    this.authStatus = authStatus;
    this.identity = identity;
  }

  public static fromJson(value: unknown, path?: string): DiscoveredProfile {
    const reader = JsonReader.fromValue(value, path);
    const kind = reader.readNonBlankString(Resources.kindField);
    const profileDir = reader.readNonBlankString(Resources.profileDirField);
    const label = reader.readNonBlankString(Resources.labelField);
    const usual = reader.readBoolean(Resources.usualField);
    const authStatus = reader.readOneOf(Resources.authStatusField, Object.values(AuthStatus));
    const identity = reader.readNullableObject(Resources.identityField);
    return new DiscoveredProfile(kind, profileDir, label, usual, authStatus, Object.isNull(identity) ? null : ProviderIdentity.fromJson(identity.toJson(), identity.path));
  }

  public toJson(): JsonObject {
    return {
      [Resources.kindField]: this.kind,
      [Resources.profileDirField]: this.profileDir,
      [Resources.labelField]: this.label,
      [Resources.usualField]: this.usual,
      [Resources.authStatusField]: this.authStatus,
      [Resources.identityField]: Object.isNull(this.identity) ? null : this.identity.toJson()
    };
  }
}
