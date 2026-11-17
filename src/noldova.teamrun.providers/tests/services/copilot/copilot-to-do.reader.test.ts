/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { JsonReader, type JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AuthStatus, type PlanStep, Provider } from "@noldova/teamrun.protocol";
import { CopilotToDoReader, Resources } from "@noldova/teamrun.providers";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class CopilotToDoReaderTests {
  private static readonly QUERY: string = "INSERT INTO todos (id, title, status) VALUES ('a', 'Read', 'done')";
  private static readonly OUTPUT: JsonValue = { content: "1 row(s) inserted.", detailedContent: `SQL: ${CopilotToDoReaderTests.QUERY}

1 row(s) inserted.` };
  private static readonly WRITE: JsonValue = { rawInput: { description: "Plan the fix", query: CopilotToDoReaderTests.QUERY }, rawOutput: CopilotToDoReaderTests.OUTPUT };

  private static store(profile: string, session: string, rows: readonly (readonly [string, string, string, number])[] | null): void {
    mkdirSync(`${profile}/session-state/${session}`, { recursive: true });
    const database = new DatabaseSync(`${profile}/session-state/${session}/session.db`);
    if (!Object.isNull(rows)) {
      database.exec("CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, status TEXT, created_at INTEGER, updated_at INTEGER)");
      for (const [id, title, status, createdAt] of rows)
        database.prepare("INSERT INTO todos (id, title, status, created_at) VALUES (?, ?, ?, ?)").run(id, title, status, createdAt);
    }
    else
      database.exec("CREATE TABLE notes (id TEXT)");
    database.close();
  }

  private static shown(steps: readonly PlanStep[] | null): string {
    return Object.isNull(steps) ? "null" : steps.map(t => `${t.text}:${t.status}`).join(",");
  }

  @TestMethod
  public readsTheSessionsToDosInTheOrderCopilotAddedThemWithEachStatusAndNoBlankTitle(): void {
    using directory = new TemporaryDirectory();
    CopilotToDoReaderTests.store(directory.resolve("home"), "s", [["c", "Run the tests", "blocked", 3], ["b", "Fix the bug", "in_progress", 2], ["a", "Read the code", "done", 1],
      ["d", " ", "pending", 4], ["z", "Ship", "pending", 5], ["y", "Check", "unknown", 5]]);

    const steps = new CopilotToDoReader(directory.resolve("home")).read(JsonReader.fromValue(CopilotToDoReaderTests.WRITE), "s", null);

    Assert.areEqual("Read the code:Completed,Fix the bug:InProgress,Run the tests:Pending,Ship:Pending,Check:Pending", CopilotToDoReaderTests.shown(steps));
  }

  @TestMethod
  public readsTheFirstHundredToDosAndTheFirstFiveHundredCharactersOfATitle(): void {
    using directory = new TemporaryDirectory();
    CopilotToDoReaderTests.store(directory.resolve("home"), "s", Array.from({ length: 101 }, (_, index) => [`t${String(index)}`, index === 0 ? "x".repeat(501) : `Step ${String(index)}`,
      "pending", index] as const));

    const steps = new CopilotToDoReader(directory.resolve("home")).read(JsonReader.fromValue(CopilotToDoReaderTests.WRITE), "s", null);

    Assert.areEqual(JSON.stringify([100, 500, "Step 99"]), JSON.stringify([steps?.length, steps?.[0]?.text.length, steps?.at(-1)?.text]));
  }

  @TestMethod
  public readsFromTheProvidersProfileFolderWhenItHasOne(): void {
    using directory = new TemporaryDirectory();
    CopilotToDoReaderTests.store(directory.resolve("home"), "s", [["a", "From home", "pending", 1]]);
    CopilotToDoReaderTests.store(directory.resolve("work"), "s", [["a", "From work", "pending", 1]]);
    const provider = new Provider("a", "copilot", "Work", directory.resolve("work"), AuthStatus.Unknown, null, null, null, null, "t");
    const reader = new CopilotToDoReader(directory.resolve("home"));

    Assert.areEqual("From work:Pending", CopilotToDoReaderTests.shown(reader.read(JsonReader.fromValue(CopilotToDoReaderTests.WRITE), "s", provider)));
    Assert.areEqual("From home:Pending", CopilotToDoReaderTests.shown(reader.read(JsonReader.fromValue(CopilotToDoReaderTests.WRITE), "s", null)));
  }

  @TestMethod
  public readsAfterEveryKindOfWriteToTheToDosAndNoOtherQuery(): void {
    using directory = new TemporaryDirectory();
    CopilotToDoReaderTests.store(directory.resolve("home"), "s", [["a", "Read the code", "pending", 1]]);
    const reader = new CopilotToDoReader(directory.resolve("home"));
    const read = (rawInput: JsonValue | undefined): string => CopilotToDoReaderTests.shown(reader.read(JsonReader.fromValue(Object.isUndefined(rawInput)
      ? { rawOutput: CopilotToDoReaderTests.OUTPUT } : { rawInput, rawOutput: CopilotToDoReaderTests.OUTPUT }), "s", null));

    Assert.areEqual(Array.from({ length: 7 }, () => "Read the code:Pending").join("|"),
      ["insert or replace into \"todos\" (id) values ('a')", "UPDATE todos SET status = 'done'", "DELETE FROM `todos` WHERE id = 'b'", "REPLACE INTO todos VALUES ('a')",
        "INSERT INTO todos VALUES ('a')", "UPDATE main.todos SET status = 'done'", "UPDATE OR IGNORE \"main\" . [todos] SET status = 'done'"].map(t => read({ query: t })).join("|"));
    Assert.areEqual("null|null|null|null|null|null|null|null", [read({ query: "SELECT * FROM todos" }), read({ query: "INSERT INTO todos_archive VALUES ('a')" }),
      read({ query: "UPDATE notes SET todos = 1" }), read({ query: "UPDATE temp.todos SET status = 'done'" }), read({ query: 1 }), read({}), read(["INSERT INTO todos VALUES ('a')"]), read(undefined)].join("|"));
  }

  @TestMethod
  public readsTheCommittedToDosWhileAWriteIsOpenAndNothingOnceItsWaitPassesWhileTheDatabaseIsLocked(): void {
    using directory = new TemporaryDirectory();
    CopilotToDoReaderTests.store(directory.resolve("home"), "s", [["a", "Read the code", "pending", 1]]);
    const reader = new CopilotToDoReader(directory.resolve("home"));
    const writer = new DatabaseSync(directory.resolve("home", "session-state", "s", "session.db"));
    try {
      writer.exec("BEGIN IMMEDIATE; INSERT INTO todos (id, title, status, created_at) VALUES ('b', 'Fix the bug', 'pending', 2)");
      const open = CopilotToDoReaderTests.shown(reader.read(JsonReader.fromValue(CopilotToDoReaderTests.WRITE), "s", null));
      writer.exec("ROLLBACK; BEGIN EXCLUSIVE");
      const began = Date.now();
      const locked = CopilotToDoReaderTests.shown(reader.read(JsonReader.fromValue(CopilotToDoReaderTests.WRITE), "s", null));
      const waited = Date.now() - began;

      Assert.areEqual("Read the code:Pending|null", `${open}|${locked}`);
      Assert.isTrue(waited >= Resources.copilotToDoBusyTimeout - 50 && waited < 10_000, String(waited));
    }
    finally {
      writer.close();
    }
  }

  @TestMethod
  public readsNothingAfterAToolOtherThanCopilotsSqlTool(): void {
    using directory = new TemporaryDirectory();
    CopilotToDoReaderTests.store(directory.resolve("home"), "s", [["a", "Read the code", "pending", 1]]);
    const reader = new CopilotToDoReader(directory.resolve("home"));
    const read = (rawOutput: JsonValue | undefined): string => CopilotToDoReaderTests.shown(reader.read(JsonReader.fromValue(Object.isUndefined(rawOutput)
      ? { rawInput: { query: CopilotToDoReaderTests.QUERY } } : { rawInput: { query: CopilotToDoReaderTests.QUERY }, rawOutput }), "s", null));

    Assert.areEqual("null|null|null|null|null|Read the code:Pending", [read(undefined), read(["SQL: x"]), read({ content: "SQL: x" }), read({ detailedContent: 1 }),
      read({ detailedContent: "Ran: INSERT INTO todos" }), read(CopilotToDoReaderTests.OUTPUT)].join("|"));
  }

  @TestMethod
  public readsNothingForASessionIdThatIsntOneFolderNameOrADatabaseThatCantBeRead(): void {
    using directory = new TemporaryDirectory();
    CopilotToDoReaderTests.store(directory.resolve("home"), "notes", null);
    const reader = new CopilotToDoReader(directory.resolve("home"));
    const read = (session: string): string => CopilotToDoReaderTests.shown(reader.read(JsonReader.fromValue(CopilotToDoReaderTests.WRITE), session, null));

    Assert.areEqual("null|null|null|null|null", ["..", ".", "a/b", "missing", "notes"].map(t => read(t)).join("|"));
  }
}
