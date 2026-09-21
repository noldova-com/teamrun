/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { AuthStatus } from "../enums/auth-status.js";
import { Resources } from "../resources.js";
import { ProviderAccountIdentity } from "./provider-account-identity.js";

export class ProviderAccount {
  public readonly id: string;
  public readonly provider: string;
  public readonly label: string;
  public readonly profileDir: string;
  public readonly authStatus: AuthStatus;
  public readonly identity: ProviderAccountIdentity | null;
  public readonly harnessVersion: string | null;
  public readonly lastCheckedAt: string | null;
  public readonly lastError: string | null;
  public readonly createdAt: string;

  public constructor(
    id: string,
    provider: string,
    label: string,
    profileDir: string,
    authStatus: AuthStatus,
    identity: ProviderAccountIdentity | null,
    harnessVersion: string | null,
    lastCheckedAt: string | null,
    lastError: string | null,
    createdAt: string) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    ArgumentException.throwIfNullOrWhitespace(provider, Resources.providerField);
    ArgumentException.throwIfNullOrWhitespace(label, Resources.labelField);
    ArgumentException.throwIfNullOrWhitespace(profileDir, Resources.profileDirField);
    ArgumentException.throwIfNullOrWhitespace(createdAt, Resources.createdAtField);

    this.id = id;
    this.provider = provider;
    this.label = label;
    this.profileDir = profileDir;
    this.authStatus = authStatus;
    this.identity = identity;
    this.harnessVersion = harnessVersion;
    this.lastCheckedAt = lastCheckedAt;
    this.lastError = lastError;
    this.createdAt = createdAt;
  }

  public static fromJson(value: unknown, path?: string): ProviderAccount {
    const reader = JsonReader.fromValue(value, path);
    return new ProviderAccount(
      reader.readNonBlankString(Resources.idField),
      reader.readNonBlankString(Resources.providerField),
      reader.readNonBlankString(Resources.labelField),
      reader.readNonBlankString(Resources.profileDirField),
      reader.readOneOf(Resources.authStatusField, Object.values(AuthStatus)),
      ProviderAccount.identityFromJson(reader),
      reader.readNullableString(Resources.harnessVersionField),
      reader.readNullableString(Resources.lastCheckedAtField),
      reader.readNullableString(Resources.lastErrorField),
      reader.readNonBlankString(Resources.createdAtField));
  }

  private static identityFromJson(reader: JsonReader): ProviderAccountIdentity | null {
    const identity = reader.readNullableObject(Resources.identityField);
    return Object.isNull(identity) ? null : ProviderAccountIdentity.fromJson(identity.toJson(), identity.path);
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.providerField]: this.provider,
      [Resources.labelField]: this.label,
      [Resources.profileDirField]: this.profileDir,
      [Resources.authStatusField]: this.authStatus,
      [Resources.identityField]: Object.isNull(this.identity) ? null : this.identity.toJson(),
      [Resources.harnessVersionField]: this.harnessVersion,
      [Resources.lastCheckedAtField]: this.lastCheckedAt,
      [Resources.lastErrorField]: this.lastError,
      [Resources.createdAtField]: this.createdAt
    };
  }

  public withCheck(
    authStatus: AuthStatus,
    identity: ProviderAccountIdentity | null,
    harnessVersion: string | null,
    lastCheckedAt: string | null,
    lastError: string | null): ProviderAccount {
    return new ProviderAccount(this.id, this.provider, this.label, this.profileDir, authStatus, identity, harnessVersion, lastCheckedAt, lastError, this.createdAt);
  }
}
