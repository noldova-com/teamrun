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

export class ProviderAccountIdentity {
  public readonly email?: string;
  public readonly plan?: string;
  public readonly organization?: string;
  public readonly authMethod?: string;

  public constructor(email?: string, plan?: string, organization?: string, authMethod?: string) {
    if (!Object.isUndefined(email))
      this.email = email;
    if (!Object.isUndefined(plan))
      this.plan = plan;
    if (!Object.isUndefined(organization))
      this.organization = organization;
    if (!Object.isUndefined(authMethod))
      this.authMethod = authMethod;
  }

  public static fromJson(value: unknown, path?: string): ProviderAccountIdentity {
    const reader = JsonReader.fromValue(value, path);
    return new ProviderAccountIdentity(
      reader.readOptionalString(Resources.emailField),
      reader.readOptionalString(Resources.planField),
      reader.readOptionalString(Resources.organizationField),
      reader.readOptionalString(Resources.authMethodField));
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
    return fields;
  }
}
