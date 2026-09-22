/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { InstallationRole } from "../enums/installation-role.js";
import { InstallationUpdatePhase } from "../enums/installation-update-phase.js";
import { InvalidOperationException } from "../exceptions/invalid-operation.exception.js";
import { InstallationMember } from "../models/installation-member.js";
import { InstallationUpdate } from "../models/installation-update.js";
import { Resources } from "../resources.js";
import { ProcessProbe } from "./lock/process-probe.js";

export class InstallationRegistry {
  private readonly probe: ProcessProbe;

  public readonly path: string;

  public constructor(path: string, probe: ProcessProbe = new ProcessProbe()) {
    ArgumentException.throwIfNullOrWhitespace(path, Resources.pathParameterName);

    this.path = resolve(path);
    this.probe = probe;
  }

  public static forEntry(entryPath: string, executable: string, homeDirectory: string): InstallationRegistry | null {
    if (!resolve(entryPath).split(sep).includes(Resources.installationArchiveName))
      return null;
    const identity = realpathSync.native(executable);
    const id = createHash(Resources.installationHashAlgorithm).update(identity).digest(Resources.installationHashEncoding);
    return new InstallationRegistry(join(homeDirectory, ...Resources.installationRegistrySegments, id, Resources.installationRegistryFile));
  }

  public static forDataDirectory(dataDirectory: string, homeDirectory: string): InstallationRegistry | null {
    const path = join(dataDirectory, Resources.installationLinkFile);
    if (!existsSync(path))
      return null;
    const id = readFileSync(path, Resources.utf8Encoding).trim();
    if (!Resources.installationIdPattern.test(id))
      throw new InvalidOperationException(Resources.installationLinkInvalid);
    return new InstallationRegistry(join(homeDirectory, ...Resources.installationRegistrySegments, id, Resources.installationRegistryFile));
  }

  public linkDataDirectory(dataDirectory: string): void {
    const id = basename(dirname(this.path));
    if (!Resources.installationIdPattern.test(id))
      throw new InvalidOperationException(Resources.installationLinkInvalid);
    const path = join(dataDirectory, Resources.installationLinkFile);
    mkdirSync(dataDirectory, { recursive: true });
    writeFileSync(path + Resources.lockTemporarySuffix, id, { encoding: Resources.utf8Encoding, mode: Resources.lockFileMode });
    renameSync(path + Resources.lockTemporarySuffix, path);
  }

  public register(member: InstallationMember): void {
    this.transaction(database => {
      const update = this.readUpdate(database);
      if (!Object.isNull(update)) {
        if (update.phase !== InstallationUpdatePhase.Installing || member.role !== InstallationRole.Desktop || member.productVersion !== update.targetVersion)
          throw new InvalidOperationException(Resources.installationUpdating);
        const owner = database.prepare(Resources.installationFindMember).get(update.ownerId);
        if (!Object.isUndefined(owner) && this.probe.isAlive(InstallationMember.fromJson(JSON.parse(String(owner[Resources.installationJsonColumn]))).processId))
          throw new InvalidOperationException(Resources.installationUpdating);
        database.exec(Resources.installationDeleteUpdate);
      }
      database.prepare(Resources.installationPutMember).run(member.id, JSON.stringify(this.canonicalMember(member).toJson()));
    });
  }

  public activate(member: InstallationMember): void {
    this.transaction(database => {
      if (Object.isUndefined(database.prepare(Resources.installationFindMember).get(member.id)))
        throw new InvalidOperationException(Resources.installationMemberMissing);
      database.prepare(Resources.installationPutMember).run(member.id, JSON.stringify(this.canonicalMember(member).toJson()));
    });
  }

  public unregister(id: string): void {
    this.transaction(database => {
      database.prepare(Resources.installationDeleteMember).run(id);
      const update = this.readUpdate(database);
      if (update?.ownerId === id && update.phase === InstallationUpdatePhase.Preparing)
        database.exec(Resources.installationDeleteUpdate);
    });
  }

  public assertLaunchAllowed(): void {
    this.transaction(database => {
      if (!Object.isNull(this.readUpdate(database)))
        throw new InvalidOperationException(Resources.installationUpdating);
    });
  }

  public begin(update: InstallationUpdate): readonly InstallationMember[] {
    return this.transaction(database => {
      if (!Object.isNull(this.readUpdate(database)) || update.phase !== InstallationUpdatePhase.Preparing || update.expiresAt <= Date.now())
        throw new InvalidOperationException(Resources.installationUpdating);
      const members = this.readMembers(database);
      if (!members.some(t => t.id === update.ownerId && t.role === InstallationRole.Desktop)
        || members.some(t => Object.isNull(t.endpoint)))
        throw new InvalidOperationException(Resources.installationMemberMissing);
      database.prepare(Resources.installationPutUpdate).run(JSON.stringify(update.toJson()));
      return members;
    });
  }

  public renew(update: InstallationUpdate): void {
    this.transaction(database => {
      const current = this.requireUpdate(database, update.id);
      if (current.phase !== InstallationUpdatePhase.Preparing || update.phase !== InstallationUpdatePhase.Preparing
        || current.ownerId !== update.ownerId || current.targetVersion !== update.targetVersion || update.expiresAt <= Date.now())
        throw new InvalidOperationException(Resources.installationUpdateLost);
      database.prepare(Resources.installationPutUpdate).run(JSON.stringify(update.toJson()));
    });
  }

  public markInstalling(id: string): void {
    this.transaction(database => {
      const current = this.requireUpdate(database, id);
      database.prepare(Resources.installationPutUpdate).run(JSON.stringify(new InstallationUpdate(current.id, current.ownerId,
        current.targetVersion, InstallationUpdatePhase.Installing, current.expiresAt).toJson()));
    });
  }

  public release(id: string): void {
    this.transaction(database => {
      const current = this.readUpdate(database);
      if (current?.id === id)
        database.exec(Resources.installationDeleteUpdate);
    });
  }

  public isPreparing(id: string): boolean {
    return this.transaction(database => {
      const current = this.readUpdate(database);
      return current?.id === id && current.phase === InstallationUpdatePhase.Preparing;
    });
  }

  public ownsUpdate(id: string): boolean {
    return this.transaction(database => this.readUpdate(database)?.id === id);
  }

  public isInstalling(id: string): boolean {
    return this.transaction(database => {
      const current = this.readUpdate(database);
      return current?.id === id && current.phase === InstallationUpdatePhase.Installing;
    });
  }

  public members(): readonly InstallationMember[] {
    return this.transaction(database => this.readMembers(database));
  }

  private readMembers(database: DatabaseSync): readonly InstallationMember[] {
    const result: InstallationMember[] = [];
    for (const row of database.prepare(Resources.installationSelectMembers).all()) {
      const member = InstallationMember.fromJson(JSON.parse(String(row[Resources.installationJsonColumn])));
      if (this.probe.isAlive(member.processId))
        result.push(member);
      else
        database.prepare(Resources.installationDeleteMember).run(member.id);
    }
    return result;
  }

  private readUpdate(database: DatabaseSync): InstallationUpdate | null {
    const row = database.prepare(Resources.installationSelectUpdate).get();
    if (Object.isUndefined(row))
      return null;
    const update = InstallationUpdate.fromJson(JSON.parse(String(row[Resources.installationJsonColumn])));
    if (update.phase === InstallationUpdatePhase.Preparing && update.expiresAt <= Date.now()) {
      database.exec(Resources.installationDeleteUpdate);
      return null;
    }
    return update;
  }

  private requireUpdate(database: DatabaseSync, id: string): InstallationUpdate {
    const current = this.readUpdate(database);
    if (Object.isNull(current) || current.id !== id)
      throw new InvalidOperationException(Resources.installationUpdateLost);
    return current;
  }

  private transaction<T>(action: (database: DatabaseSync) => T): T {
    mkdirSync(dirname(this.path), { recursive: true, mode: Resources.installationDirectoryMode });
    const database = new DatabaseSync(this.path);
    try {
      chmodSync(this.path, Resources.lockFileMode);
      database.exec(Resources.installationSchema);
      database.exec(Resources.installationBegin);
      try {
        const result = action(database);
        database.exec(Resources.installationCommit);
        return result;
      }
      catch (error) {
        database.exec(Resources.installationRollback);
        throw error;
      }
    }
    finally {
      database.close();
    }
  }

  private canonicalMember(member: InstallationMember): InstallationMember {
    mkdirSync(member.dataDirectory, { recursive: true });
    return new InstallationMember(member.id, member.role, member.processId, realpathSync.native(member.dataDirectory),
      member.productVersion, member.endpoint, member.token);
  }
}
