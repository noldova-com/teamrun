/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { BackupVerificationException, DatabaseBackup } from "@noldova/teamrun-shell-runtime";

import { CorruptDatabaseFixture } from "../../fixtures/corrupt-database.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class DatabaseBackupTests {
  @TestMethod
  public async copiesCommittedWriteAheadLogDataIntoAVerifiedOwnerOnlyBackup(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const backups = path.join(folder.path, "backups");
    const source = new DatabaseSync(path.join(folder.path, "source.sqlite"));
    let file: string;
    try {
      source.exec("PRAGMA journal_mode = WAL; CREATE TABLE notes (text TEXT) STRICT; INSERT INTO notes VALUES ('only in the log');");

      file = await DatabaseBackup.createAsync(source, backups, "copy.sqlite");
    }
    finally {
      source.close();
    }

    Assert.areEqual(path.join(backups, "copy.sqlite"), file);
    Assert.areEqual("copy.sqlite", (await readdir(backups)).join(","));
    DatabaseBackup.verify(file);
    const copy = new DatabaseSync(file, { readOnly: true });
    try {
      Assert.areEqual("only in the log", copy.prepare("SELECT text FROM notes").get()?.["text"]);
    }
    finally {
      copy.close();
    }
    if (process.platform !== "win32")
      Assert.areEqual(0o600, (await stat(file)).mode & 0o777);
  }

  @TestMethod
  public async neverOverwritesAnExistingBackup(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const source = new DatabaseSync(path.join(folder.path, "source.sqlite"));
    try {
      await DatabaseBackup.createAsync(source, folder.path, "copy.sqlite");

      await Assert.throwsAsync(() => DatabaseBackup.createAsync(source, folder.path, "copy.sqlite"), Error);
    }
    finally {
      source.close();
    }
    Assert.areEqual("copy.sqlite,source.sqlite", (await readdir(folder.path)).sort().join(","));
  }

  @TestMethod
  public async refusesToPublishACopyThatFailsItsIntegrityCheck(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const corrupt = path.join(folder.path, "corrupt.sqlite");
    await CorruptDatabaseFixture.writeAsync(corrupt);
    const source = new DatabaseSync(corrupt);
    try {
      await Assert.throwsAsync(() => DatabaseBackup.createAsync(source, path.join(folder.path, "backups"), "copy.sqlite"), BackupVerificationException);
    }
    finally {
      source.close();
    }

    Assert.areEqual(0, (await readdir(path.join(folder.path, "backups"))).length);
  }

  @TestMethod
  public async findsAFileThatIsNoDatabaseUnverified(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "text.sqlite");
    await writeFile(file, "This is plain text, not a SQLite database, and it is long enough to have a header.");

    const exception = Assert.throws(() => DatabaseBackup.verify(file), BackupVerificationException);

    Assert.isInstanceOf(exception.cause, Error);
    Assert.areEqual("The database backup did not pass its integrity check.", exception.message);
  }
}
