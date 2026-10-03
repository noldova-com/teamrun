/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../../resources.js";

export class DataDirectory {
  public readonly root: string;

  public constructor(root: string) {
    if (!path.isAbsolute(root))
      throw new ArgumentException(Resources.rootNotAbsolute, Resources.rootParameterName);

    this.root = path.resolve(root);
  }

  public get ownershipDatabase(): string {
    return path.join(this.root, Resources.ownershipDatabaseFileName);
  }

  public get shellDatabase(): string {
    return path.join(this.root, Resources.shellDatabaseFileName);
  }

  public get discoveryFolder(): string {
    return path.join(this.root, Resources.discoveryFolderName);
  }

  public get discoveryFile(): string {
    return path.join(this.discoveryFolder, Resources.discoveryFileName);
  }

  public get profileFolder(): string {
    return path.join(this.root, Resources.profileFolderName);

  }

  public get backupsFolder(): string {
    return path.join(this.root, Resources.backupsFolderName);
  }

  public get modulesFolder(): string {
    return path.join(this.root, Resources.modulesFolderName);
  }

  public get workFolder(): string {
    return path.join(this.root, Resources.workFolderName);
  }

  public get logsFolder(): string {
    return path.join(this.root, Resources.logsFolderName);
  }

  public get runtimeLog(): string {
    return path.join(this.logsFolder, Resources.runtimeLogFileName);
  }

  public get previousRuntimeLog(): string {
    return path.join(this.logsFolder, Resources.previousRuntimeLogFileName);
  }

  public get desktopLog(): string {
    return path.join(this.logsFolder, Resources.desktopLogFileName);
  }

  public get previousDesktopLog(): string {
    return path.join(this.logsFolder, Resources.previousDesktopLogFileName);
  }

  public locateModuleDatabase(id: string): string {
    return path.join(this.locateModuleFolder(id), `${id}${Resources.moduleDatabaseExtension}`);
  }

  public locateModuleFolder(id: string): string {
    return path.join(this.modulesFolder, DataDirectory.requireModuleId(id));
  }

  public locateWorkFolder(id: string): string {
    return path.join(this.workFolder, DataDirectory.requireModuleId(id));
  }

  private static requireModuleId(id: string): string {
    if (!Resources.moduleIdPattern.test(id) || id === Resources.reservedModuleId)
      throw new ArgumentException(Resources.moduleIdInvalid, Resources.idParameterName);
    return id;
  }
}
