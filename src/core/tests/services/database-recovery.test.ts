/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DatabaseContext, DatabaseRecovery, MigrationCatalog, Resources } from "@noldova/teamrun-core";
import { ServiceException } from "@noldova/teamrun-foundation-services";
import { SqlQuery } from "@noldova/teamrun-foundation-data-sql";

import { TemporaryDataDirectory as TemporaryDirectory } from "../fixtures/temporary-data-directory.fixture.js";
import { LegacyDatabaseContext } from "../fixtures/legacy-database-context.fixture.js";

@TestClass
export class DatabaseRecoveryTests {
  @TestMethod
  public async snapshotsCommittedWalDataWithoutOverwritingAnExistingRecoveryPoint(): Promise<void> {
    using directory = new TemporaryDirectory();
    using context = DatabaseContext.open(directory.path);
    context.database.connection.execute(new SqlQuery("CREATE TABLE fixture(value TEXT)"));
    context.database.connection.execute(new SqlQuery("INSERT INTO fixture VALUES ('kept')"));
    const id = "00000000-0000-4000-8000-000000000001";
    const path = await DatabaseRecovery.createBackup(directory.path, id);
    Assert.isNotNull(path);
    const backup = new DatabaseSync(path, { readOnly: true });
    try { Assert.areEqual("kept", backup.prepare("SELECT value FROM fixture").get()?.["value"]); }
    finally { backup.close(); }
    await Assert.throwsAsync(() => DatabaseRecovery.createBackup(directory.path, id), Error);
    Assert.isTrue(existsSync(path));
    Assert.isFalse(readdirSync(join(directory.path, "backups")).some(t => t.endsWith(".pending")));
    await Assert.throwsAsync(() => DatabaseRecovery.createBackup(directory.path, "../bad"), ServiceException);
    Assert.isNull(await DatabaseRecovery.createBackup(join(directory.path, "empty"), id));
  }

  @TestMethod
  public async backsUpBeforeMigrationAndRefusesNewerOrMalformedHistory(): Promise<void> {
    using directory = new TemporaryDirectory();
    {
      using legacy = new LegacyDatabaseContext(directory.path);
      Assert.areEqual(1, legacy.database.getAppliedMigrations().length);
    }
    await new Promise(resolve => setTimeout(resolve, 50));
    const started = Date.now();
    await DatabaseRecovery.prepare(directory.path);
    Assert.isTrue(Date.now() - started < 5000);
    Assert.areEqual(1, readdirSync(join(directory.path, "backups")).filter(t => t.endsWith(".sqlite")).length);
    using context = DatabaseContext.open(directory.path);
    context.database.connection.execute(new SqlQuery("INSERT INTO __migrations (id,appliedAt) VALUES ('9999-future','t')"));
    await Assert.throwsAsync(() => DatabaseRecovery.prepare(directory.path), ServiceException);
    Assert.throws(() => DatabaseContext.open(directory.path), ServiceException);
    context.database.connection.execute(new SqlQuery("DELETE FROM __migrations WHERE id='9999-future'"));
    DatabaseRecovery.assertCompatible(MigrationCatalog.all.map(t => t.id));
    const raw = new DatabaseSync(join(directory.path, Resources.databaseFileName));
    try { raw.exec("INSERT INTO __migrations (id,appliedAt) VALUES (X'AB','t')"); }
    finally { raw.close(); }
    await Assert.throwsAsync(() => DatabaseRecovery.prepare(directory.path), ServiceException);
  }

  @TestMethod
  public async rejectsAnIntegrityFailureAndDoesNotPublishAnIncompleteBackup(): Promise<void> {
    using directory = new TemporaryDirectory();
    await DatabaseRecovery.prepare(directory.path);
    const raw = new DatabaseSync(join(directory.path, Resources.databaseFileName));
    try {
      raw.exec("CREATE TABLE fixture(value TEXT)");
      await DatabaseRecovery.prepare(directory.path);
    }
    finally { raw.close(); }
    const path = join(directory.path, Resources.databaseFileName);
    const bytes = readFileSync(path);
    bytes.writeUInt32BE(1, 36);
    writeFileSync(path, bytes);
    await Assert.throwsAsync(() => DatabaseRecovery.createBackup(directory.path, "00000000-0000-4000-8000-000000000002"), ServiceException);
    Assert.areEqual(0, readdirSync(join(directory.path, "backups")).length);
  }
}
