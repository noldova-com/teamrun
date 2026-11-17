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
import { CodexCompactionReader } from "@noldova/teamrun.providers";

import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class CodexCompactionReaderTests {
  private static readonly thread: string = "019a0000-0000-7000-8000-000000000001";

  @TestMethod
  public async readsTheLastCompactedMessageOfTheThreadsRolloutInWhicheverDayFolderHoldsIt(): Promise<void> {
    using directory = new TemporaryDirectory();
    CodexCompactionReaderTests.write(directory, ["2026", "11", "01"], "rollout-2026-11-01T10-00-00-019a0000-0000-7000-8000-000000000009.jsonl",
      [CodexCompactionReaderTests.compacted("Another thread.")]);
    CodexCompactionReaderTests.write(directory, ["2026", "11", "02"], `rollout-2026-11-02T09-00-00-${CodexCompactionReaderTests.thread}.jsonl`, [
      { timestamp: "t", type: "session_meta", payload: { id: CodexCompactionReaderTests.thread } },
      CodexCompactionReaderTests.compacted("The first summary."),
      { timestamp: "t", type: "response_item", payload: { type: "message", role: "user", content: [] } },
      CodexCompactionReaderTests.compacted("The second summary."),
      { timestamp: "t", type: "event_msg", payload: { type: "token_count" } }
    ]);
    writeFileSync(directory.resolve("sessions", "2026", "notes.txt"), "Not a rollout.");

    Assert.areEqual("The second summary.", await CodexCompactionReader.read(directory.path, CodexCompactionReaderTests.thread));
  }

  @TestMethod
  public async readsNothingWithoutTheThreadsRolloutOrAMessageInItsCompaction(): Promise<void> {
    using directory = new TemporaryDirectory();
    const thread = (id: number): string => CodexCompactionReaderTests.thread.replace(/1$/u, String(id));
    CodexCompactionReaderTests.write(directory, ["2026", "11", "02"], `rollout-a-${thread(2)}.jsonl`, [{ timestamp: "t", type: "session_meta", payload: {} }]);
    CodexCompactionReaderTests.write(directory, ["2026", "11", "02"], `rollout-b-${thread(3)}.jsonl`, [{ timestamp: "t", type: "compacted",
      payload: { message: "", replacement_history: [{ type: "compaction", encrypted_content: "gAAA" }] } }]);
    CodexCompactionReaderTests.write(directory, ["2026", "11", "02"], `rollout-c-${thread(4)}.jsonl`, [{ timestamp: "t", type: "compacted", payload: {} }]);

    const read = await Promise.all([1, 2, 3, 4].map(t => CodexCompactionReader.read(directory.path, thread(t))));

    Assert.areEqual("null,null,null,null", read.map(t => String(t)).join(","));
  }

  @TestMethod
  public async rejectsWhenThereIsNoSessionsFolder(): Promise<void> {
    using directory = new TemporaryDirectory();

    const read = await CodexCompactionReader.read(directory.path, CodexCompactionReaderTests.thread).then(() => "read", () => "rejected");

    Assert.areEqual("rejected", read);
  }

  private static compacted(message: string): JsonObject {
    return { timestamp: "t", type: "compacted", payload: { message, replacement_history: [] } };
  }

  private static write(directory: TemporaryDirectory, days: readonly string[], name: string, lines: readonly JsonObject[]): void {
    mkdirSync(directory.resolve("sessions", ...days), { recursive: true });
    writeFileSync(directory.resolve("sessions", ...days, name), lines.map(t => JSON.stringify(t)).join(String.fromCharCode(10)));
  }
}
