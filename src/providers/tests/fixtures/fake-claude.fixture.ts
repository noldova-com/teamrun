/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export class FakeClaude {
  public run(): void {
    if (process.argv.includes("--version")) {
      process.stdout.write(`${process.env["TEAMRUN_FAKE_CLAUDE_VERSION"] ?? "9.9.9-fake (Claude Code)"}\n`);
      return;
    }
    if (process.argv.includes("auth") && process.argv.includes("status")) {
      this.printStatus();
      return;
    }

    process.stderr.write("The fake only knows --version and auth status.\n");
    process.exitCode = 2;
  }

  private printStatus(): void {
    if (process.env["TEAMRUN_FAKE_CLAUDE_HANG"] === "1") {
      setTimeout(() => process.exit(0), 60_000);
      return;
    }

    const output = process.env["TEAMRUN_FAKE_CLAUDE_OUTPUT"];
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
