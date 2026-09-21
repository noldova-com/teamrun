/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";
import { ProviderAccountIdentity } from "./provider-account-identity.js";

export class ObservedSettings {
  public readonly provider: string | null;
  public readonly model: string | null;
  public readonly effort: string | null;
  public readonly harnessVersion: string | null;
  public readonly identity: ProviderAccountIdentity | null;

  public constructor(
    provider: string | null,
    model: string | null,
    effort: string | null,
    harnessVersion: string | null,
    identity: ProviderAccountIdentity | null) {
    this.provider = provider;
    this.model = model;
    this.effort = effort;
    this.harnessVersion = harnessVersion;
    this.identity = identity;
  }

  public static fromJson(value: unknown, path?: string): ObservedSettings {
    const reader = JsonReader.fromValue(value, path);
    return new ObservedSettings(
      reader.readNullableString(Resources.providerField),
      reader.readNullableString(Resources.modelField),
      reader.readNullableString(Resources.effortField),
      reader.readNullableString(Resources.harnessVersionField),
      ObservedSettings.identityFromJson(reader));
  }

  private static identityFromJson(reader: JsonReader): ProviderAccountIdentity | null {
    const identity = reader.readNullableObject(Resources.identityField);
    return Object.isNull(identity) ? null : ProviderAccountIdentity.fromJson(identity.toJson(), identity.path);
  }

  public toJson(): JsonObject {
    return {
      [Resources.providerField]: this.provider,
      [Resources.modelField]: this.model,
      [Resources.effortField]: this.effort,
      [Resources.harnessVersionField]: this.harnessVersion,
      [Resources.identityField]: Object.isNull(this.identity) ? null : this.identity.toJson()
    };
  }
}
