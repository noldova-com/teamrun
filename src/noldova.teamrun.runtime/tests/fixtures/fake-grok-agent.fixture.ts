/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createInterface } from "node:readline";

type Message = { readonly id?: number; readonly method?: string };

export class FakeGrokAgent {
  public run(): void {
    createInterface({ input: process.stdin }).on("line", line => this.answer(JSON.parse(line) as Message));
  }

  private answer(message: Message): void {
    if (message.id === undefined || message.method === undefined)
      return;
    if (message.method === "initialize")
      this.respond(message.id, { protocolVersion: 1, authMethods: [{ id: "cached_token", name: "Grok" }],
        agentCapabilities: { loadSession: true, promptCapabilities: { image: false } },
        _meta: { agentVersion: "1.0.30-fixture", modelState: { currentModelId: "grok-test", availableModels: [{ modelId: "grok-test", name: "Test model" }] } } });
    else if (message.method === "authenticate")
      this.respond(message.id, {});
    else if (message.method === "session/new")
      this.respond(message.id, { sessionId: "grok-session", configOptions: [
        { type: "select", id: "model", name: "Model", category: "model", currentValue: "grok-test", options: [{ value: "grok-test", name: "Test model" }] }
      ] });
    else if (message.method === "session/prompt")
      this.respond(message.id, { stopReason: "end_turn" });
    else
      process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: `Unknown method ${message.method}` } })}\n`);
  }

  private respond(id: number, result: object): void {
    process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
  }
}

new FakeGrokAgent().run();
