/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";

export interface IAcpSignOutReader {
  readonly methods: readonly string[];
  read(answer: JsonValue): string | null;
}
