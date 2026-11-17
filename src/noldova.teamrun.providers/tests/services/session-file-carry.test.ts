/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { SessionFileCarry } from "@noldova/teamrun.providers";

import { TemporaryDirectory } from "../fixtures/temporary-directory.fixture.js";

@TestClass
export class SessionFileCarryTests {
  @TestMethod
  public async replacesTheTargetWithTheCopyAndLeavesNoTemporaryFile(): Promise<void> {
    using directory = new TemporaryDirectory();
    mkdirSync(directory.resolve("work", "projects", "D--work"), { recursive: true });
    writeFileSync(directory.resolve("work", "projects", "D--work", "s-1.jsonl"), "new\n");
    mkdirSync(directory.resolve("spare", "projects", "D--work"), { recursive: true });
    writeFileSync(directory.resolve("spare", "projects", "D--work", "s-1.jsonl"), "old\n");

    const copied = await SessionFileCarry.copy(directory.resolve("work"), directory.resolve("spare"), directory.resolve("work", "projects", "D--work", "s-1.jsonl"));

    Assert.isTrue(copied);
    Assert.areEqual("new\n", readFileSync(directory.resolve("spare", "projects", "D--work", "s-1.jsonl"), "utf8"));
    Assert.areEqual("s-1.jsonl", readdirSync(directory.resolve("spare", "projects", "D--work")).join(","));
  }

  @TestMethod
  public async leavesTheTargetUnchangedAndNoTemporaryFileWhenTheWrittenCopyCantReplaceIt(): Promise<void> {
    using directory = new TemporaryDirectory();
    mkdirSync(directory.resolve("work", "projects", "D--work"), { recursive: true });
    writeFileSync(directory.resolve("work", "projects", "D--work", "s-1.jsonl"), "new\n");
    mkdirSync(directory.resolve("spare", "projects", "D--work", "s-1.jsonl"), { recursive: true });
    writeFileSync(directory.resolve("spare", "projects", "D--work", "s-1.jsonl", "kept.txt"), "old\n");

    const failure = await SessionFileCarry.copy(directory.resolve("work"), directory.resolve("spare"), directory.resolve("work", "projects", "D--work", "s-1.jsonl"))
      .then(() => null, (error: unknown) => error);

    Assert.areEqual("rename", failure instanceof Error && "syscall" in failure ? failure.syscall : null);
    Assert.areEqual("old\n", readFileSync(directory.resolve("spare", "projects", "D--work", "s-1.jsonl", "kept.txt"), "utf8"));
    Assert.areEqual("s-1.jsonl", readdirSync(directory.resolve("spare", "projects", "D--work")).join(","));
  }

  @TestMethod
  public async leavesTheTargetUnchangedAndNoTemporaryFileWhenTheCopyFails(): Promise<void> {
    using directory = new TemporaryDirectory();
    mkdirSync(directory.resolve("work", "projects", "D--work"), { recursive: true });
    mkdirSync(directory.resolve("spare", "projects", "D--work"), { recursive: true });
    writeFileSync(directory.resolve("spare", "projects", "D--work", "s-1.jsonl"), "old\n");

    const failure = await SessionFileCarry.copy(directory.resolve("work"), directory.resolve("spare"), directory.resolve("work", "projects", "D--work", "s-1.jsonl"))
      .then(() => null, (error: unknown) => error);

    Assert.isNotNull(failure);
    Assert.areEqual("old\n", readFileSync(directory.resolve("spare", "projects", "D--work", "s-1.jsonl"), "utf8"));
    Assert.areEqual(false, existsSync(directory.resolve("spare", "projects", "D--work", "s-1.jsonl.teamrun-copy")));
  }
}
