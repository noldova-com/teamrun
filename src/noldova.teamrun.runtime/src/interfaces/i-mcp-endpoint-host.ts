/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";
import type { McpToolCallParams, McpToolListParams } from "@noldova/teamrun.protocol";

export interface IMcpEndpointHost {
  acceptsSessionTokenAsync(token: string): Promise<boolean>;
  listMcpToolsAsync(params: McpToolListParams, signal?: AbortSignal): Promise<readonly JsonObject[]>;
  callMcpToolAsync(params: McpToolCallParams, signal?: AbortSignal): Promise<JsonObject>;
}
