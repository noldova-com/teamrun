/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import type { OwnMcpServer } from "@noldova/teamrun.protocol";

export interface IAcpOwnMcpServersReader {
  readonly methods: readonly string[];
  read(answer: JsonValue): readonly OwnMcpServer[];
}
