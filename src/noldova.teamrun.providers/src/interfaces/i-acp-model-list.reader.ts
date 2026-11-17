/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonReader, JsonValue } from "@noldova/context.json";
import type { ProviderModel } from "@noldova/teamrun.protocol";

export interface IAcpModelListReader {
  readonly methods: readonly string[];
  read(answer: JsonValue, initialized: JsonReader): readonly ProviderModel[] | null;
}
