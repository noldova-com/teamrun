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

import { Resources } from "../resources.js";
import { ObservedSettings } from "./observed-settings.js";
import { RequestedSettings } from "./requested-settings.js";
import { RoleApplication } from "../enums/role-application.js";
import { ReplyUsage } from "./reply-usage.js";

export class Provenance {
  public readonly providerId: string | null;
  public readonly requested: RequestedSettings;
  public readonly observed: ObservedSettings;
  public readonly nativeSessionId: string | null;
  public readonly resumedNativeSession: boolean;
  public readonly nativeTurnId: string | null;
  public readonly roleApplied: RoleApplication | null;
  public readonly usage: ReplyUsage | null;

  public constructor(
    providerId: string | null,
    requested: RequestedSettings,
    observed: ObservedSettings,
    nativeSessionId: string | null,
    resumedNativeSession: boolean,
    nativeTurnId: string | null = null,
    roleApplied: RoleApplication | null = null,
    usage: ReplyUsage | null = null) {
    if (resumedNativeSession && Object.isNull(nativeSessionId))
      throw new ArgumentException(Resources.resumedWithoutSession, Resources.resumedNativeSessionField);

    this.providerId = providerId;
    this.requested = requested;
    this.observed = observed;
    this.nativeSessionId = nativeSessionId;
    this.resumedNativeSession = resumedNativeSession;
    this.nativeTurnId = nativeTurnId;
    this.roleApplied = roleApplied;
    this.usage = usage;
  }

  public static fromJson(value: unknown, path?: string): Provenance {
    const reader = JsonReader.fromValue(value, path);
    const requested = reader.readObject(Resources.requestedField);
    const observed = reader.readObject(Resources.observedField);
    const usage = reader.hasField(Resources.usageField) ? reader.readObject(Resources.usageField) : null;
    return new Provenance(
      reader.readNullableString(Resources.providerIdField),
      RequestedSettings.fromJson(requested.toJson(), requested.path),
      ObservedSettings.fromJson(observed.toJson(), observed.path),
      reader.readNullableString(Resources.nativeSessionIdField),
      reader.readBoolean(Resources.resumedNativeSessionField),
      reader.hasField(Resources.nativeTurnIdField) ? reader.readNullableString(Resources.nativeTurnIdField) : null,
      reader.hasField(Resources.roleAppliedField) && !Object.isNull(reader.readNullableString(Resources.roleAppliedField))
        ? reader.readOneOf(Resources.roleAppliedField, Object.values(RoleApplication)) : null,
      Object.isNull(usage) ? null : ReplyUsage.fromJson(usage.toJson(), usage.path));
  }

  public toJson(): JsonObject {
    return {
      [Resources.providerIdField]: this.providerId,
      [Resources.requestedField]: this.requested.toJson(),
      [Resources.observedField]: this.observed.toJson(),
      [Resources.nativeSessionIdField]: this.nativeSessionId,
      [Resources.resumedNativeSessionField]: this.resumedNativeSession,
      [Resources.nativeTurnIdField]: this.nativeTurnId,
      ...(Object.isNull(this.roleApplied) ? {} : { [Resources.roleAppliedField]: this.roleApplied }),
      ...(Object.isNull(this.usage) ? {} : { [Resources.usageField]: this.usage.toJson() })
    };
  }

  public withNativeSession(nativeSessionId: string | null, resumedNativeSession: boolean, nativeTurnId: string | null = this.nativeTurnId): Provenance {
    return new Provenance(this.providerId, this.requested, this.observed, nativeSessionId, resumedNativeSession, nativeTurnId, this.roleApplied, this.usage);
  }

  public withObserved(observed: ObservedSettings): Provenance {
    return new Provenance(this.providerId, this.requested, observed, this.nativeSessionId, this.resumedNativeSession,
      this.nativeTurnId, this.roleApplied, this.usage);
  }

  public withRoleApplied(roleApplied: RoleApplication | null): Provenance {
    return new Provenance(this.providerId, this.requested, this.observed,
      this.nativeSessionId, this.resumedNativeSession, this.nativeTurnId, roleApplied, this.usage);
  }

  public withUsage(usage: ReplyUsage): Provenance {
    return new Provenance(this.providerId, this.requested, this.observed, this.nativeSessionId, this.resumedNativeSession, this.nativeTurnId,
      this.roleApplied, Object.isNull(this.usage) ? usage : this.usage.merge(usage));
  }
}
