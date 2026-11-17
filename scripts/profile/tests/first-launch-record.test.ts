/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, it } from "node:test";

import { FirstLaunchRecord } from "../first-launch-record.ts";

const folders: string[] = [];

const dataFolder = (statements: readonly string[] | null): string => {
  const data = mkdtempSync(path.join(tmpdir(), "first-launch-"));
  folders.push(data);
  if (statements === null)
    return data;
  const file = path.join(data, ...FirstLaunchRecord.DATABASE);
  mkdirSync(path.dirname(file), { recursive: true });
  const database = new DatabaseSync(file);
  for (const statement of statements)
    database.exec(statement);
  database.close();
  return data;
};

describe("FirstLaunchRecord", () => {
  afterEach(() => {
    for (const folder of folders.splice(0))
      rmSync(folder, { recursive: true, force: true });
  });

  it("finds the first launch pending in a data folder without TeamRun's database, or whose database has no preferences yet", () => {
    assert.equal(FirstLaunchRecord.isPending(dataFolder(null)), true);
    assert.equal(FirstLaunchRecord.isPending(dataFolder(["CREATE TABLE providers (json TEXT)"])), true);
  });

  it("finds it pending while its preference has no finish", () => {
    const data = dataFolder([
      "CREATE TABLE providers (json TEXT)",
      "CREATE TABLE preferences (name TEXT, json TEXT)",
      "INSERT INTO preferences VALUES ('firstLaunch', '{\"finishedAt\":null}')"
    ]);

    assert.equal(FirstLaunchRecord.isPending(data), true);
  });

  it("finds it finished once its preference has a finish or a provider exists", () => {
    const finished = dataFolder([
      "CREATE TABLE preferences (name TEXT, json TEXT)",
      "INSERT INTO preferences VALUES ('firstLaunch', '{\"finishedAt\":\"2026-10-31T00:00:00.000Z\"}')"
    ]);
    const withProvider = dataFolder(["CREATE TABLE providers (json TEXT)", "INSERT INTO providers VALUES ('{}')"]);

    assert.equal(FirstLaunchRecord.isPending(finished), false);
    assert.equal(FirstLaunchRecord.isPending(withProvider), false);
  });
});
