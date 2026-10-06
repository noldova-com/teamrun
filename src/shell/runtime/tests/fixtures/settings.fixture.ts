/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SettingDefinition } from "@noldova/teamrun-shell-protocol";
import {
  DataDirectory, OwnershipLock, ProcessSettings, ProcessSupervisor, SettingsService, ShellDatabase, ShellMigrations, SystemCommand
} from "@noldova/teamrun-shell-runtime";

import { TemporaryFolderFixture } from "./temporary-folder.fixture.js";
import { TextOutputFixture } from "./text-output.fixture.js";

export class SettingsFixture implements AsyncDisposable {
  public readonly service: SettingsService;
  public readonly database: ShellDatabase;
  public readonly diagnostics: TextOutputFixture;
  public readonly processes: ProcessSupervisor;
  private readonly folder: TemporaryFolderFixture;
  private readonly lock: OwnershipLock;

  private constructor(folder: TemporaryFolderFixture, lock: OwnershipLock, database: ShellDatabase, diagnostics: TextOutputFixture, definitions: readonly SettingDefinition[]) {
    this.folder = folder;
    this.lock = lock;
    this.database = database;
    this.diagnostics = diagnostics;
    this.service = new SettingsService(database, definitions, diagnostics);
    this.processes = ProcessSupervisor.create(database, process.platform, process.env, new SystemCommand(), diagnostics, new ProcessSettings(1_000, 1_000));
  }

  public static async createAsync(definitions: readonly SettingDefinition[] = []): Promise<SettingsFixture> {
    const folder = await TemporaryFolderFixture.createAsync();
    const lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    const database = await ShellDatabase.openAsync(lock, ShellMigrations.all);
    return new SettingsFixture(folder, lock, database, new TextOutputFixture(), definitions);
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    this.database.close();
    this.lock.release();
    await this.folder[Symbol.asyncDispose]();
  }
}
