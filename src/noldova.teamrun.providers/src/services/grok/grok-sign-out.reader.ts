/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";

import type { IAcpSignOutReader } from "../../interfaces/i-acp-sign-out.reader.js";
import { Resources } from "../../resources.js";
import { UsageValues } from "../usage-values.js";

export class GrokSignOutReader implements IAcpSignOutReader {
  public readonly methods: readonly string[] = Resources.xaiLogoutMethods;

  public read(answer: JsonValue): string | null {
    if (UsageValues.fieldOf(answer, Resources.xaiOkField) !== true)
      return Resources.grokSignOutRefused;
    return UsageValues.fieldOf(answer, Resources.xaiApiKeyStillSetField) === true ? Resources.grokApiKeyStillSet : null;
  }
}
