/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, writeFileSync } from "node:fs";

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ClaudeCompactionReader, Resources } from "@noldova/teamrun.providers";

import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class ClaudeCompactionReaderTests {
  @TestMethod
  public async readsTheLastCompactSummaryOfTheSessionsFileInWhicheverProjectFolderHoldsIt(): Promise<void> {
    using directory = new TemporaryDirectory();
    const session = "11111111-1111-1111-1111-111111111111";
    mkdirSync(directory.resolve("projects", "D--other"), { recursive: true });
    mkdirSync(directory.resolve("projects", "D--work"), { recursive: true });
    writeFileSync(directory.resolve("projects", "stray.jsonl"), String.empty);
    writeFileSync(directory.resolve("projects", "D--work", `${session}.jsonl`), [
      { type: "user", message: { role: "user", content: "Start" } },
      { type: "system", subtype: "compact_boundary" },
      ClaudeCompactionReaderTests.summary("The first summary."),
      { type: "system", subtype: "compact_boundary" },
      ClaudeCompactionReaderTests.summary("The second summary."),
      { type: "user", message: { role: "user", content: "Go on" } }
    ].map(t => JSON.stringify(t)).join("\n") + "\n");

    Assert.areEqual("The second summary.", await ClaudeCompactionReader.read(directory.path, session));
  }

  @TestMethod
  public async readsNothingWithoutTheSessionsFileOrASummaryInItAndRejectsASummaryThatIsntText(): Promise<void> {
    using directory = new TemporaryDirectory();
    mkdirSync(directory.resolve("projects", "D--work"), { recursive: true });
    writeFileSync(directory.resolve("projects", "D--work", "plain.jsonl"), JSON.stringify({ type: "user", message: { role: "user", content: "Start" } }));
    writeFileSync(directory.resolve("projects", "D--work", "blocks.jsonl"),
      JSON.stringify({ type: "user", isCompactSummary: true, message: { role: "user", content: [{ type: "text", text: "Blocks" }] } }));

    const read = await Promise.all(["missing", "plain", "blocks"].map(t => ClaudeCompactionReader.read(directory.path, t).then(u => String(u), (error: unknown) => String(error))));

    Assert.areEqual(`null,null,ConfigurationUnreadableException: ${Resources.formatClaudeCompactSummaryNotText(directory.resolve("projects", "D--work", "blocks.jsonl"))}`, read.join(","));
  }

  @TestMethod
  public async readsASummaryLongerThanAChunkFromBehindALineLongerThanOneWithoutANewlineAtTheEnd(): Promise<void> {
    using directory = new TemporaryDirectory();
    const chunk = Resources.jsonlTailChunkBytes;
    const summary = "s".repeat(chunk * 1.5);
    mkdirSync(directory.resolve("projects", "D--work"), { recursive: true });
    writeFileSync(directory.resolve("projects", "D--work", "long.jsonl"), [
      { type: "user", message: { role: "user", content: "Start" } },
      { type: "user", message: { role: "user", content: summary }, isCompactSummary: true },
      { type: "assistant", message: { role: "assistant", content: "t".repeat(chunk * 1.5) } }
    ].map(t => JSON.stringify(t)).join("\n"));

    Assert.areEqual(summary, await ClaudeCompactionReader.read(directory.path, "long"));
  }

  @TestMethod
  public async readsASummaryWhoseMarkerTheChunksSplit(): Promise<void> {
    using directory = new TemporaryDirectory();
    const head = JSON.stringify({ type: "user", isCompactSummary: true, message: { role: "user", content: "Split" } });
    const at = head.indexOf(Resources.claudeCompactSummaryMarker) + 5;
    const fill = JSON.stringify({ type: "assistant", message: { role: "assistant", content: String.empty } });
    const filler = fill.replace("\"\"", `"${"f".repeat(Resources.jsonlTailChunkBytes + at - head.length - 1 - fill.length)}"`);
    mkdirSync(directory.resolve("projects", "D--work"), { recursive: true });
    writeFileSync(directory.resolve("projects", "D--work", "split.jsonl"), `${head}\n${filler}`);

    Assert.areEqual(Resources.jsonlTailChunkBytes + at, head.length + 1 + filler.length);
    Assert.areEqual("Split", await ClaudeCompactionReader.read(directory.path, "split"));
  }

  @TestMethod
  public async rejectsWhenThereIsNoProjectsFolder(): Promise<void> {
    using directory = new TemporaryDirectory();

    const read = await ClaudeCompactionReader.read(directory.path, "missing").then(() => "read", () => "rejected");

    Assert.areEqual("rejected", read);
  }

  private static summary(text: string): JsonObject {
    return { type: "user", isCompactSummary: true, isVisibleInTranscriptOnly: true, message: { role: "user", content: text } };
  }
}
