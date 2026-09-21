/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { JsonReader } from "@noldova/teamrun-foundation-json";
import { ProviderAccountIdentity } from "@noldova/teamrun-protocol";

import { Resources } from "../resources.js";

export class CodexAccount {
  public readonly type: string;
  public readonly email: string | null;
  public readonly planType: string | null;

  public constructor(type: string, email: string | null, planType: string | null) {
    this.type = type;
    this.email = email;
    this.planType = planType;
  }

  public static fromJson(value: unknown, path?: string): CodexAccount | null {
    const account = JsonReader.fromValue(value, path).readNullableObject(Resources.accountField);
    if (Object.isNull(account))
      return null;

    const type = account.readNonBlankString(Resources.typeField);
    if (type !== Resources.chatGptAccountType)
      return new CodexAccount(type, null, null);

    const email = account.hasField(Resources.emailField) ? account.readNullableString(Resources.emailField) : null;
    const planType = account.hasField(Resources.planTypeField) ? account.readNullableString(Resources.planTypeField) : null;

    return new CodexAccount(type, email, planType);
  }

  public toIdentity(): ProviderAccountIdentity {
    return new ProviderAccountIdentity(this.email ?? undefined, this.planType ?? undefined, undefined, this.type);
  }
}
