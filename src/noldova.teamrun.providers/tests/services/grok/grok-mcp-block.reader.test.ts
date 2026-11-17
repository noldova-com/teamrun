/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { GrokMcpBlockReader, Resources } from "@noldova/teamrun.providers";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class GrokMcpBlockReaderTests {
  private static readonly SINCE: string = "2026-10-25T18:36:30.000Z";

  private static entry(ts: string, msg: string, ctx: Readonly<Record<string, unknown>>): string {
    return JSON.stringify({ ts, src: "shell", lvl: "warn", msg, ctx });
  }

  private static write(directory: TemporaryDirectory, lines: readonly string[]): string {
    const profile = directory.resolve("profile");
    mkdirSync(directory.resolve("profile", "logs"), { recursive: true });
    writeFileSync(directory.resolve("profile", "logs", "unified.jsonl"), `${lines.join("\r\n")}\r\n`);
    return profile;
  }

  @TestMethod
  public readsTheLatestBlockOfEachServerSinceTheTurnStartedAndSkipsEverythingElseIncludingLinesThatArentEntries(): void {
    using directory = new TemporaryDirectory();
    const profile = GrokMcpBlockReaderTests.write(directory, [
      GrokMcpBlockReaderTests.entry("2026-10-25T18:36:36.990Z", Resources.grokMcpBlockedMessage, { server: "teamrun", reason: "locked down by policy (old)" }),
      GrokMcpBlockReaderTests.entry("2026-10-25T18:37:01.000Z", Resources.grokMcpBlockedMessage, { server: "teamrun", reason: "locked down by policy\u001b[31m (C:\\Users\\John Smith\\.grok\\requirements.toml)" }),
      "not json",
      "[\"not an entry\"]",
      "42",
      GrokMcpBlockReaderTests.entry("2026-10-25T18:37:02.000Z", Resources.grokMcpBlockedMessage, { server: "other", reason: "not in allowedMcpServers (/home/Jane Doe/.grok/requirements.toml)" }),
      GrokMcpBlockReaderTests.entry("2026-10-25T18:37:03.000Z", "shell.turn.tool_prep_done", { mcp_wait_ms: 0, tool_count: 26 })
    ]);

    Assert.areEqual(JSON.stringify([["other", "not in allowedMcpServers (requirements.toml)"], ["teamrun", "locked down by policy [31m (requirements.toml)"]]),
      JSON.stringify([...GrokMcpBlockReader.read(profile, GrokMcpBlockReaderTests.SINCE)]));
  }

  @TestMethod
  public readsNothingFromABlockBeforeTheTurnAMissingLogOrABlockWithoutAReasonOrAServer(): void {
    using directory = new TemporaryDirectory();
    Assert.areEqual(0, GrokMcpBlockReader.read(directory.resolve("missing"), GrokMcpBlockReaderTests.SINCE).size);
    const before = GrokMcpBlockReaderTests.write(directory, [
      GrokMcpBlockReaderTests.entry("2026-10-25T18:36:29.999Z", Resources.grokMcpBlockedMessage, { server: "teamrun", reason: "locked down by policy" })
    ]);
    Assert.areEqual(0, GrokMcpBlockReader.read(before, GrokMcpBlockReaderTests.SINCE).size);
    const incomplete = GrokMcpBlockReaderTests.write(directory, [
      GrokMcpBlockReaderTests.entry("2026-10-25T18:36:40.000Z", Resources.grokMcpBlockedMessage, { server: "teamrun" }),
      GrokMcpBlockReaderTests.entry("2026-10-25T18:36:41.000Z", Resources.grokMcpBlockedMessage, { reason: "locked down by policy" })
    ]);
    Assert.areEqual(0, GrokMcpBlockReader.read(incomplete, GrokMcpBlockReaderTests.SINCE).size);
  }

  @TestMethod
  public readsOnlyTheLogsNewestPartAndDropsTheLineItCutsInTwo(): void {
    using directory = new TemporaryDirectory();
    const block = GrokMcpBlockReaderTests.entry("2026-10-25T18:36:40.000Z", Resources.grokMcpBlockedMessage, { server: "teamrun", reason: "locked down by policy" });
    const filler = GrokMcpBlockReaderTests.entry("2026-10-25T18:36:41.000Z", "filler", { text: "x".repeat(1000) });
    const count = Math.ceil(Resources.grokLogTailBytes / filler.length) + 1;
    const profile = GrokMcpBlockReaderTests.write(directory, [block, ...Array.from({ length: count }, () => filler)]);
    Assert.areEqual(0, GrokMcpBlockReader.read(profile, GrokMcpBlockReaderTests.SINCE).size);

    const recent = GrokMcpBlockReaderTests.write(directory, [...Array.from({ length: count }, () => filler), block]);
    Assert.areEqual("locked down by policy", GrokMcpBlockReader.read(recent, GrokMcpBlockReaderTests.SINCE).get("teamrun"));
  }
}
