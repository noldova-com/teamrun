/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { UpdateProcess } from "@noldova/teamrun-shell-protocol";

import type { IRuntimeConnection } from "./i-runtime-connection.js";

export interface IUpdateTarget {
  readonly dataDirectory: string;
  readonly runtime: UpdateProcess;
  readonly connection: IRuntimeConnection;
}
