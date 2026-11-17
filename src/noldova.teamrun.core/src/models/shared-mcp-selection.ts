/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SharedMcpServerDefinition } from "@noldova/teamrun.protocol";

import { SharedMcpValues } from "./shared-mcp-values.js";

export class SharedMcpSelection {
  public static readonly none: SharedMcpSelection = new SharedMcpSelection([], []);

  public readonly servers: readonly SharedMcpServerDefinition[];
  public readonly notes: readonly string[];
  public readonly values: SharedMcpValues;

  public constructor(servers: readonly SharedMcpServerDefinition[], notes: readonly string[], values: SharedMcpValues = SharedMcpValues.none) {
    this.servers = [...servers];
    this.notes = [...notes];
    this.values = values;
  }
}
