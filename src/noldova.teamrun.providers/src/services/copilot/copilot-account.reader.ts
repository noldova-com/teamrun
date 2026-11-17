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

import { Resources } from "../../resources.js";
import { UsageValues } from "../usage-values.js";

export class CopilotAccountReader {
  public static read(status: JsonValue): ProviderIdentity | null {
    if (UsageValues.fieldOf(status, Resources.copilotAuthenticatedField) !== true)
      return null;
    const login = CopilotAccountReader.text(UsageValues.fieldOf(status, Resources.copilotLoginField));
    const authType = CopilotAccountReader.text(UsageValues.fieldOf(status, Resources.copilotAuthTypeField));

    return Object.isUndefined(login) && Object.isUndefined(authType) ? null : new ProviderIdentity(undefined, undefined, undefined, authType, login);
  }

  private static text(value: JsonValue | undefined): string | undefined {
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
  }
}
