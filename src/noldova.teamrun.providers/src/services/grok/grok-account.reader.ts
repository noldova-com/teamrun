/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { ProviderIdentity } from "@noldova/teamrun.protocol";

import type { IAcpAccountReader } from "../../interfaces/i-acp-account.reader.js";
import { Resources } from "../../resources.js";
import { UsageValues } from "../usage-values.js";

export class GrokAccountReader implements IAcpAccountReader {
  public readonly methods: readonly string[] = Resources.xaiAuthInfoMethods;
  public readonly planMethods: readonly string[] = Resources.xaiBillingMethods;

  public read(answer: JsonValue): ProviderIdentity | null {
    const email = GrokAccountReader.text(UsageValues.fieldOf(answer, Resources.emailField));
    const method = GrokAccountReader.text(UsageValues.fieldOf(answer, Resources.xaiMethodIdField));
    const organization = GrokAccountReader.text(UsageValues.fieldOf(answer, Resources.xaiOrganizationNameField)) ??
      GrokAccountReader.text(UsageValues.fieldOf(answer, Resources.xaiTeamNameField));

    return Object.isUndefined(email) && Object.isUndefined(method) && Object.isUndefined(organization) ? null
      : new ProviderIdentity(email, undefined, organization, method);
  }

  public readPlan(answer: JsonValue): string | null {
    return GrokAccountReader.text(UsageValues.fieldOf(answer, Resources.xaiSubscriptionTierField)) ?? null;
  }

  private static text(value: JsonValue | undefined): string | undefined {
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
  }
}
