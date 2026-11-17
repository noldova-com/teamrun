/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync } from "node:fs";

import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AgentSdkQueryFactory, type IClaudeQuery, NodeProcessStarter, ProcessOrigin, ProcessTerminator } from "@noldova/teamrun.providers";

import { ClaudeTestHost } from "../../fixtures/claude-test-host.fixture.js";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";
import { WatchingProcessStarter } from "../../fixtures/watching-process-starter.fixture.js";

@TestClass
export class AgentSdkQueryFactoryTests {
  @TestMethod
  public async startsARealQueryThatFailsWithoutAnExecutable(): Promise<void> {
    using directory = new TemporaryDirectory();
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 10_000);
    const query = new AgentSdkQueryFactory(new NodeProcessStarter(new ProcessTerminator(process.platform))).start("hello", {
      cwd: directory.path,
      env: { PATH: process.env["PATH"] ?? "" },
      pathToClaudeCodeExecutable: directory.resolve("no-such-claude.exe"),
      abortController: abort,
      settingSources: [],
      strictMcpConfig: true,
      mcpServers: {}
    }, new ProcessOrigin("claude", null));

    try {
      await Assert.throwsAsync(() => AgentSdkQueryFactoryTests.drain(query), Error);
    }
    finally {
      clearTimeout(timer);
      query.close();
    }
  }

  @TestMethod
  public async startsClaudeCodeThroughTheStarterWithItsErrorOutputInTheStderrOption(): Promise<void> {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 10_000);
    const errors: string[] = [];
    const starter = new WatchingProcessStarter(() => undefined);
    const origin = new ProcessOrigin("claude", "acc-1");
    const query = new AgentSdkQueryFactory(starter).start("hello", {
      env: { ...process.env },
      pathToClaudeCodeExecutable: ClaudeTestHost.FAKE_CLAUDE_PATH,
      abortController: abort,
      settingSources: [],
      strictMcpConfig: true,
      mcpServers: {},
      stderr: (data: string) => errors.push(data)
    }, origin);

    try {
      await Assert.throwsAsync(() => AgentSdkQueryFactoryTests.drain(query), Error);
    }
    finally {
      clearTimeout(timer);
      query.close();
    }
    Assert.isTrue(errors.join("").includes("The fake only knows --version and auth status."), errors.join(""));
    Assert.areEqual(origin, starter.started[0]?.origin);
  }

  @TestMethod
  public async sendsTheServersItSetsOverClaudeCodesStandardInputAndNeverOnItsCommandLineOrInItsEnvironment(): Promise<void> {
    using directory = new TemporaryDirectory();
    const received = directory.resolve("stdin.jsonl");
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 10_000);
    const starter = new WatchingProcessStarter(() => undefined);
    const closed = Promise.withResolvers<void>();
    const prompt: AsyncIterable<SDKUserMessage> = {
      [Symbol.asyncIterator]: () => ({ next: () => closed.promise.then(() => ({ done: true as const, value: undefined })) })
    };
    const query = new AgentSdkQueryFactory(starter).start(prompt, {
      env: { ...process.env, TEAMRUN_FAKE_CLAUDE_TURN: "control", TEAMRUN_FAKE_CLAUDE_STDIN: received },
      pathToClaudeCodeExecutable: ClaudeTestHost.FAKE_CLAUDE_PATH,
      abortController: abort,
      settingSources: [],
      strictMcpConfig: true,
      mcpServers: {}
    }, new ProcessOrigin("claude", null));
    const token = "stdin-only-token-4711";

    let added: string[];
    try {
      added = (await query.setMcpServers({ teamrun: { type: "http", url: "http://127.0.0.1:4711/mcp", headers: { Authorization: `Bearer ${token}` } } })).added;
    }
    finally {
      closed.resolve();
      clearTimeout(timer);
      query.close();
    }

    const sent = readFileSync(received, "utf8");
    Assert.areEqual("teamrun", added.join(","));
    Assert.isTrue(sent.includes("\"subtype\":\"mcp_set_servers\"") && sent.includes(`Bearer ${token}`), sent);
    const [started] = starter.started;
    const [environment] = starter.environments;
    Assert.isDefined(started);
    Assert.isDefined(environment);
    Assert.isFalse(started.arguments.some(t => t.includes(token)), started.arguments.join(" "));
    Assert.isFalse(Object.values(environment).some(t => t?.includes(token) === true));
  }

  private static async drain(query: IClaudeQuery): Promise<number> {
    let count = 0;
    for await (const message of query)
      count += message.type.length;

    return count;
  }
}
