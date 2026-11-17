/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";
import type { IMcpToolHost } from "@noldova/teamrun.protocol";

export class FakeMcpToolHost implements IMcpToolHost {
  public static readonly slowTool: string = "teamrun_slow";
  public static readonly brokenTool: string = "teamrun_broken";
  public static readonly throwingTool: string = "teamrun_throwing";

  public readonly calls: { name: string; input: JsonObject; signal: AbortSignal }[] = [];
  public listFailure: unknown = null;

  public listToolsAsync(_signal: AbortSignal): Promise<readonly JsonObject[]> {
    if (this.listFailure !== null)
      return Promise.reject(this.listFailure);
    return Promise.resolve([{ name: "teamrun_list_chats", description: "Lists the chats.", inputSchema: { type: "object" } }]);
  }

  public callToolAsync(name: string, input: JsonObject, signal: AbortSignal): Promise<JsonObject> {
    this.calls.push({ name, input, signal });
    if (name === FakeMcpToolHost.brokenTool)
      return Promise.reject(new Error("The runtime stopped."));
    if (name === FakeMcpToolHost.throwingTool)
      return Promise.reject("The host broke.");
    if (name !== FakeMcpToolHost.slowTool)
      return Promise.resolve({ content: [{ type: "text", text: JSON.stringify(input) }], isError: false });
    return new Promise(resolve => signal.addEventListener("abort", () => resolve({ content: [], isError: true }), { once: true }));
  }
}
