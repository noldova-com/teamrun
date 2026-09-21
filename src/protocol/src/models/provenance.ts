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

import { Resources } from "../resources.js";
import { ObservedSettings } from "./observed-settings.js";
import { RequestedSettings } from "./requested-settings.js";
import { RoleApplication } from "../enums/role-application.js";

export class Provenance {
  public readonly providerAccountId: string | null;
  public readonly requested: RequestedSettings;
  public readonly observed: ObservedSettings;
  public readonly nativeSessionId: string | null;
  public readonly resumedNativeSession: boolean;
  public readonly nativeTurnId: string | null;
  public readonly roleApplied: RoleApplication | null;

  public constructor(
    providerAccountId: string | null,
    requested: RequestedSettings,
    observed: ObservedSettings,
    nativeSessionId: string | null,
    resumedNativeSession: boolean,
    nativeTurnId: string | null = null,
    roleApplied: RoleApplication | null = null) {
    if (resumedNativeSession && Object.isNull(nativeSessionId))
      throw new ArgumentException(Resources.resumedWithoutSession, Resources.resumedNativeSessionField);

    this.providerAccountId = providerAccountId;
    this.requested = requested;
    this.observed = observed;
    this.nativeSessionId = nativeSessionId;
    this.resumedNativeSession = resumedNativeSession;
    this.nativeTurnId = nativeTurnId;
    this.roleApplied = roleApplied;
  }

  public static fromJson(value: unknown, path?: string): Provenance {
    const reader = JsonReader.fromValue(value, path);
    const requested = reader.readObject(Resources.requestedField);
    const observed = reader.readObject(Resources.observedField);
    return new Provenance(
      reader.readNullableString(Resources.providerAccountIdField),
      RequestedSettings.fromJson(requested.toJson(), requested.path),
      ObservedSettings.fromJson(observed.toJson(), observed.path),
      reader.readNullableString(Resources.nativeSessionIdField),
      reader.readBoolean(Resources.resumedNativeSessionField),
      reader.hasField(Resources.nativeTurnIdField) ? reader.readNullableString(Resources.nativeTurnIdField) : null,
      reader.hasField(Resources.roleAppliedField) && !Object.isNull(reader.readNullableString(Resources.roleAppliedField))
        ? reader.readOneOf(Resources.roleAppliedField, Object.values(RoleApplication)) : null);
  }

  public toJson(): JsonObject {
    return {
      [Resources.providerAccountIdField]: this.providerAccountId,
      [Resources.requestedField]: this.requested.toJson(),
      [Resources.observedField]: this.observed.toJson(),
      [Resources.nativeSessionIdField]: this.nativeSessionId,
      [Resources.resumedNativeSessionField]: this.resumedNativeSession,
      [Resources.nativeTurnIdField]: this.nativeTurnId,
      ...(Object.isNull(this.roleApplied) ? {} : { [Resources.roleAppliedField]: this.roleApplied })
    };
  }

  public withNativeSession(nativeSessionId: string | null, resumedNativeSession: boolean, nativeTurnId: string | null = this.nativeTurnId): Provenance {
    return new Provenance(this.providerAccountId, this.requested, this.observed, nativeSessionId, resumedNativeSession, nativeTurnId, this.roleApplied);
  }

  public withObserved(observed: ObservedSettings): Provenance {
    return new Provenance(this.providerAccountId, this.requested, observed, this.nativeSessionId, this.resumedNativeSession,
      this.nativeTurnId, this.roleApplied);
  }

  public withRoleApplied(roleApplied: RoleApplication | null): Provenance {
    return new Provenance(this.providerAccountId, this.requested, this.observed,
      this.nativeSessionId, this.resumedNativeSession, this.nativeTurnId, roleApplied);
  }
}
