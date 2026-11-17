/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { JsonReader } from "@noldova/context.json";

export class FakeClaude {
  public run(): void {
    if (process.argv.includes("--version")) {
      process.stdout.write(`${process.env["TEAMRUN_FAKE_CLAUDE_VERSION"] ?? "9.9.9 (Claude Code)"}\n`);
      return;
    }
    if (process.argv.includes("auth") && process.argv.includes("status")) {
      this.printStatus();
      return;
    }
    if (process.argv.includes("auth") && process.argv.includes("logout")) {
      this.logOut();
      return;
    }
    if (process.argv.includes("--output-format") && process.env["TEAMRUN_FAKE_CLAUDE_TURN"] === "hold") {
      process.stdin.once("end", () => process.exit(0));
      process.stdin.resume();
      return;
    }
    const received = process.env["TEAMRUN_FAKE_CLAUDE_STDIN"];
    if (process.argv.includes("--output-format") && process.env["TEAMRUN_FAKE_CLAUDE_TURN"] === "control" && typeof received === "string") {
      this.answerControlRequests(received);
      return;
    }

    process.stderr.write("The fake only knows --version and auth status.\n");
    process.exitCode = 2;
  }

  private answerControlRequests(received: string): void {
    createInterface({ input: process.stdin }).on("line", line => {
      appendFileSync(received, `${line}\n`);
      const message = JsonReader.parse(line);
      if (message.readString("type") !== "control_request")
        return;
      const request = message.readObject("request");
      const response = request.readString("subtype") === "mcp_set_servers" ? { added: Object.keys(request.readObject("servers").toJson()), removed: [], errors: {} } : {};
      process.stdout.write(`${JSON.stringify({ type: "control_response", response: { subtype: "success", request_id: message.readString("request_id"), response } })}\n`);
    }).once("close", () => process.exit(0));
  }

  private logOut(): void {
    const mode = process.env["TEAMRUN_FAKE_CLAUDE_LOGOUT"];
    if (process.env["TEAMRUN_FAKE_CLAUDE_HANG"] === "1")
      setTimeout(() => process.exit(0), 60_000);
    else if (mode === "fail") {
      process.stderr.write("Not signed in to this profile.\n");
      process.exitCode = 1;
    }
    else if (mode === "silent")
      process.exitCode = 3;
    else
      process.stdout.write("Successfully logged out from your Anthropic account.\n");
  }

  private printStatus(): void {
    if (process.env["TEAMRUN_FAKE_CLAUDE_HANG"] === "1") {
      setTimeout(() => process.exit(0), 60_000);
      return;
    }

    const output = process.env["TEAMRUN_FAKE_CLAUDE_OUTPUT"];
    if (output === "traffic") {
      process.stdout.write(`${JSON.stringify({ loggedIn: process.env["CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC"] === "1", email: "found@example.com" })}\n`);
      return;
    }
    if (output === "env") {
      const status = {
        loggedIn: true,
        email: process.env["CLAUDE_CONFIG_DIR"] ?? "unset",
        orgName: process.env["ANTHROPIC_API_KEY"] ?? "no-key",
        subscriptionType: process.env["CLAUDE_AGENT_SDK_CLIENT_APP"] ?? "no-app",
        authMethod: process.env["CLAUDE_CODE_USE_BEDROCK"] ?? "no-routing"
      };
      process.stdout.write(`${JSON.stringify(status)}\n`);
      return;
    }

    process.stdout.write(`${output ?? "{\"loggedIn\":false}"}\n`);
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  new FakeClaude().run();
