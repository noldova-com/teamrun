/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { AgentSdkQueryFactory, type IClaudeQuery } from "@noldova/teamrun-providers";

import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class AgentSdkQueryFactoryTests {
  @TestMethod
  public async startsARealQueryThatFailsWithoutAnExecutable(): Promise<void> {
    using directory = new TemporaryDirectory();
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 10_000);
    const query = new AgentSdkQueryFactory().start("hello", {
      cwd: directory.path,
      env: { PATH: process.env["PATH"] ?? "" },
      pathToClaudeCodeExecutable: directory.resolve("no-such-claude.exe"),
      abortController: abort,
      settingSources: [],
      strictMcpConfig: true,
      mcpServers: {}
    });

    try {
      await Assert.throwsAsync(() => AgentSdkQueryFactoryTests.drain(query), Error);
    }
    finally {
      clearTimeout(timer);
      query.close();
    }
  }

  private static async drain(query: IClaudeQuery): Promise<number> {
    let count = 0;
    for await (const message of query)
      count += message.type.length;

    return count;
  }
}
