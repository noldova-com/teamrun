/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DataDirectory, OwnershipLock, type PermissionCenter, RememberedPermissionStore, ShellDatabase, ShellMigrations } from "@noldova/desktop.runtime";

import { RecordingOutput } from "./recording-output.fixture.js";
import { TemporaryDirectory } from "./temporary-directory.fixture.js";

export class OpenPermissionCenter implements Disposable {
  public readonly store: RememberedPermissionStore;
  private readonly folder: TemporaryDirectory;
  private readonly lock: OwnershipLock;
  private readonly shell: ShellDatabase;

  private constructor(folder: TemporaryDirectory, lock: OwnershipLock, shell: ShellDatabase) {
    this.folder = folder;
    this.lock = lock;
    this.shell = shell;
    this.store = new RememberedPermissionStore(shell);
  }

  public static async openAsync(center: PermissionCenter): Promise<OpenPermissionCenter> {
    const folder = new TemporaryDirectory();
    const lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    const opened = new OpenPermissionCenter(folder, lock, await ShellDatabase.openAsync(lock, ShellMigrations.all, new Date(), new RecordingOutput()));
    center.open(opened.store);

    return opened;
  }

  public [Symbol.dispose](): void {
    this.shell[Symbol.dispose]();
    this.lock[Symbol.dispose]();
    this.folder[Symbol.dispose]();
  }
}
