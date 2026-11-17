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

import { AuthStatus } from "../enums/auth-status.js";
import { Resources } from "../resources.js";
import { ProviderIdentity } from "./provider-identity.js";

export class Provider {
  public readonly id: string;
  public readonly kind: string;
  public readonly label: string;
  public readonly profileDir: string;
  public readonly authStatus: AuthStatus;
  public readonly identity: ProviderIdentity | null;
  public readonly harnessVersion: string | null;
  public readonly lastCheckedAt: string | null;
  public readonly lastError: string | null;
  public readonly createdAt: string;
  public readonly enabled: boolean;
  public readonly ownMcpServers: boolean;
  public readonly binaryPath: string | null;

  public constructor(
    id: string,
    kind: string,
    label: string,
    profileDir: string,
    authStatus: AuthStatus,
    identity: ProviderIdentity | null,
    harnessVersion: string | null,
    lastCheckedAt: string | null,
    lastError: string | null,
    createdAt: string,
    enabled: boolean = true,
    ownMcpServers: boolean = false,
    binaryPath: string | null = null) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    ArgumentException.throwIfNullOrWhitespace(kind, Resources.kindField);
    ArgumentException.throwIfNullOrWhitespace(label, Resources.labelField);
    ArgumentException.throwIfNullOrWhitespace(profileDir, Resources.profileDirField);
    ArgumentException.throwIfNullOrWhitespace(createdAt, Resources.createdAtField);
    if (!Object.isNull(binaryPath))
      ArgumentException.throwIfNullOrWhitespace(binaryPath, Resources.binaryPathField);

    this.id = id;
    this.kind = kind;
    this.label = label;
    this.profileDir = profileDir;
    this.authStatus = authStatus;
    this.identity = identity;
    this.harnessVersion = harnessVersion;
    this.lastCheckedAt = lastCheckedAt;
    this.lastError = lastError;
    this.createdAt = createdAt;
    this.enabled = enabled;
    this.ownMcpServers = ownMcpServers;
    this.binaryPath = binaryPath;
  }

  public static fromJson(value: unknown, path?: string): Provider {
    const reader = JsonReader.fromValue(value, path);
    return new Provider(
      reader.readNonBlankString(Resources.idField),
      reader.readNonBlankString(Resources.kindField),
      reader.readNonBlankString(Resources.labelField),
      reader.readNonBlankString(Resources.profileDirField),
      reader.readOneOf(Resources.authStatusField, Object.values(AuthStatus)),
      Provider.identityFromJson(reader),
      reader.readNullableString(Resources.harnessVersionField),
      reader.readNullableString(Resources.lastCheckedAtField),
      reader.readNullableString(Resources.lastErrorField),
      reader.readNonBlankString(Resources.createdAtField),
      reader.hasField(Resources.enabledField) ? reader.readBoolean(Resources.enabledField) : true,
      reader.hasField(Resources.ownMcpServersField) ? reader.readBoolean(Resources.ownMcpServersField) : false,
      reader.hasField(Resources.binaryPathField) ? reader.readNullableString(Resources.binaryPathField) : null);
  }

  private static identityFromJson(reader: JsonReader): ProviderIdentity | null {
    const identity = reader.readNullableObject(Resources.identityField);
    return Object.isNull(identity) ? null : ProviderIdentity.fromJson(identity.toJson(), identity.path);
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.kindField]: this.kind,
      [Resources.labelField]: this.label,
      [Resources.profileDirField]: this.profileDir,
      [Resources.authStatusField]: this.authStatus,
      [Resources.identityField]: Object.isNull(this.identity) ? null : this.identity.toJson(),
      [Resources.harnessVersionField]: this.harnessVersion,
      [Resources.lastCheckedAtField]: this.lastCheckedAt,
      [Resources.lastErrorField]: this.lastError,
      [Resources.createdAtField]: this.createdAt,
      [Resources.enabledField]: this.enabled,
      [Resources.ownMcpServersField]: this.ownMcpServers,
      [Resources.binaryPathField]: this.binaryPath
    };
  }

  public withCheck(
    authStatus: AuthStatus,
    identity: ProviderIdentity | null,
    harnessVersion: string | null,
    lastCheckedAt: string | null,
    lastError: string | null): Provider {
    return new Provider(this.id, this.kind, this.label, this.profileDir, authStatus, identity, harnessVersion, lastCheckedAt, lastError, this.createdAt,
      this.enabled, this.ownMcpServers, this.binaryPath);
  }

  public withProfile(label: string, profileDir: string): Provider {
    if (profileDir === this.profileDir)
      return new Provider(this.id, this.kind, label, profileDir, this.authStatus, this.identity, this.harnessVersion, this.lastCheckedAt, this.lastError, this.createdAt,
        this.enabled, this.ownMcpServers, this.binaryPath);

    return new Provider(this.id, this.kind, label, profileDir, AuthStatus.Unknown, null, null, null, null, this.createdAt, this.enabled,
      this.ownMcpServers, this.binaryPath);
  }

  public withEnabled(enabled: boolean): Provider {
    return new Provider(this.id, this.kind, this.label, this.profileDir, this.authStatus, this.identity, this.harnessVersion, this.lastCheckedAt, this.lastError,
      this.createdAt, enabled, this.ownMcpServers, this.binaryPath);
  }

  public withOwnMcpServers(ownMcpServers: boolean): Provider {
    return new Provider(this.id, this.kind, this.label, this.profileDir, this.authStatus, this.identity, this.harnessVersion, this.lastCheckedAt, this.lastError,
      this.createdAt, this.enabled, ownMcpServers, this.binaryPath);
  }

  public withBinaryPath(binaryPath: string | null): Provider {
    if (binaryPath === this.binaryPath)
      return this;

    return new Provider(this.id, this.kind, this.label, this.profileDir, AuthStatus.Unknown, null, null, null, null, this.createdAt, this.enabled,
      this.ownMcpServers, binaryPath);
  }
}
