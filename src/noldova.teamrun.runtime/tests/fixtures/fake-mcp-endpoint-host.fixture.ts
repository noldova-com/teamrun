/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";
import type { McpToolCallParams, McpToolListParams } from "@noldova/teamrun.protocol";
import type { IMcpEndpointHost } from "@noldova/teamrun.runtime";

export class FakeMcpEndpointHost implements IMcpEndpointHost {
  public readonly checked: string[] = [];
  public readonly listed: string[] = [];
  public readonly calls: { token: string; name: string; input: JsonObject }[] = [];
  public failure: Error | null = null;

  public acceptsSessionTokenAsync(token: string): Promise<boolean> {
    if (this.failure !== null)
      return Promise.reject(this.failure);
    this.checked.push(token);
    return Promise.resolve(token === "session-token");
  }

  public listMcpToolsAsync(params: McpToolListParams): Promise<readonly JsonObject[]> {
    this.listed.push(params.token);
    return Promise.resolve([{ name: "teamrun_open_panel", description: "Opens a panel", inputSchema: { type: "object" } }]);
  }

  public callMcpToolAsync(params: McpToolCallParams): Promise<JsonObject> {
    this.calls.push({ token: params.token, name: params.name, input: params.arguments });
    return Promise.resolve({ content: [{ type: "text", text: `called ${params.name}` }], isError: false });
  }
}
