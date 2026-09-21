/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChangeFeed, DataProvider, type DataSource, type Migrator } from "@noldova/teamrun-foundation-data";

import { MemoryChangeFeed } from "./memory-change-feed.fixture.js";
import { MemoryConnection } from "./memory-connection.fixture.js";
import { MemoryMigrationHistory } from "./memory-migration-history.fixture.js";
import type { NotesMigration } from "./notes-migration.fixture.js";
import { RecordingMigrator } from "./recording-migrator.fixture.js";

export class MemoryProvider extends DataProvider<MemoryConnection, NotesMigration> {
  public readonly history: MemoryMigrationHistory = new MemoryMigrationHistory();
  public readonly connections: MemoryConnection[] = [];
  public readonly changeFeeds: MemoryChangeFeed[] = [];

  public override openConnection(dataSource: DataSource): MemoryConnection {
    const connection = new MemoryConnection(dataSource);
    this.connections.push(connection);
    return connection;
  }

  public override createMigrator(connection: MemoryConnection, migrations: readonly NotesMigration[]): Migrator<NotesMigration> {
    return new RecordingMigrator(migrations, this.history, connection);
  }

  public override createChangeFeed(_connection: MemoryConnection): ChangeFeed {
    const changeFeed = new MemoryChangeFeed();
    this.changeFeeds.push(changeFeed);
    return changeFeed;
  }
}
