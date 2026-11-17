/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { AuthStatus } from "../enums/auth-status.js";
import { Resources } from "../resources.js";

export class ProviderIdentity {
  public readonly email: string | undefined;
  public readonly plan: string | undefined;
  public readonly organization: string | undefined;
  public readonly authMethod: string | undefined;
  public readonly userName: string | undefined;

  public constructor(email?: string, plan?: string, organization?: string, authMethod?: string, userName?: string) {
    this.email = email;
    this.plan = plan;
    this.organization = organization;
    this.authMethod = authMethod;
    this.userName = userName;
  }

  public get account(): string | undefined {
    return this.email ?? this.userName;
  }

  public static fromJson(value: unknown, path?: string): ProviderIdentity {
    const reader = JsonReader.fromValue(value, path);
    return new ProviderIdentity(
      reader.readOptionalString(Resources.emailField),
      reader.readOptionalString(Resources.planField),
      reader.readOptionalString(Resources.organizationField),
      reader.readOptionalString(Resources.authMethodField),
      reader.readOptionalString(Resources.userNameField));
  }

  public static describeAccount(authStatus: AuthStatus, identity: ProviderIdentity | null): string | null {
    return identity?.account ?? (authStatus === AuthStatus.LoggedIn ? Resources.accountNotReported : null);
  }

  public toJson(): JsonObject {
    const fields: Record<string, string> = {};
    if (!Object.isUndefined(this.email))
      fields[Resources.emailField] = this.email;
    if (!Object.isUndefined(this.plan))
      fields[Resources.planField] = this.plan;
    if (!Object.isUndefined(this.organization))
      fields[Resources.organizationField] = this.organization;
    if (!Object.isUndefined(this.authMethod))
      fields[Resources.authMethodField] = this.authMethod;
    if (!Object.isUndefined(this.userName))
      fields[Resources.userNameField] = this.userName;
    return fields;
  }
}
