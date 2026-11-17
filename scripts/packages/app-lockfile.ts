/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export class AppLockfile {
  private static readonly PACKAGES_FIELD: string = "packages";
  private static readonly ROOT_ENTRY: string = "";
  private static readonly FOLDER: string = "node_modules/";
  private static readonly MANIFEST_NAME: string = "package.json";
  private static readonly PINNED_SECTIONS: readonly string[] = ["dependencies", "devDependencies"];
  private static readonly DEPENDENCY_SECTIONS: readonly string[] = ["dependencies", "optionalDependencies", "peerDependencies"];
  private static readonly COMPARED_FIELDS: readonly string[] = ["version", "resolved", "integrity"];
  private static readonly CHECKSUM_FIELD: string = "integrity";
  private static readonly NOTE_FIELD: string = "deprecated";
  private static readonly SOURCE_FIELD: string = "resolved";
  private static readonly ENCODING: BufferEncoding = "utf8";
  private static readonly INDENT: number = 2;

  private readonly own: ReadonlySet<string>;
  private readonly archivesStart: string;

  public constructor(own: ReadonlySet<string>, archivesStart: string) {
    this.own = own;
    this.archivesStart = archivesStart;
  }

  public async writeAsync(generated: string, manifest: string, file: string): Promise<void> {
    const lockfile = await AppLockfile.readAsync(generated);
    const pins = await AppLockfile.readAsync(manifest);
    const kept: Record<string, unknown> = {};
    for (const [location, entry] of Object.entries(AppLockfile.readRecord(lockfile, AppLockfile.PACKAGES_FIELD)))
      kept[location] = location === AppLockfile.ROOT_ENTRY ? AppLockfile.pin(entry, pins)
        : this.isOwn(location) ? this.locate(AppLockfile.without(entry, [AppLockfile.NOTE_FIELD, AppLockfile.CHECKSUM_FIELD]))
          : AppLockfile.without(entry, [AppLockfile.NOTE_FIELD]);
    await writeFile(file, `${JSON.stringify({ ...lockfile, [AppLockfile.PACKAGES_FIELD]: kept }, null, AppLockfile.INDENT)}\n`);
  }

  public async findUnlockedAsync(file: string, installed: string): Promise<readonly string[]> {
    const locked = AppLockfile.readRecord(await AppLockfile.readAsync(file), AppLockfile.PACKAGES_FIELD);
    const unlocked = Object.entries(AppLockfile.readRecord(await AppLockfile.readAsync(installed), AppLockfile.PACKAGES_FIELD))
      .filter(([location, entry]) => location !== AppLockfile.ROOT_ENTRY && !this.isOwn(location) && !AppLockfile.isLockedAs(locked[location], entry))
      .map(([location]) => location);
    for (const [location, entry] of Object.entries(locked))
      if (this.isOwn(location) ? !await AppLockfile.isDependedOnAsAsync(entry, path.join(path.dirname(file), location, AppLockfile.MANIFEST_NAME)) : this.isArchive(entry))
        unlocked.push(location);
    return [...new Set(unlocked)];
  }

  private isOwn(location: string): boolean {
    return this.own.has(location.slice(location.lastIndexOf(AppLockfile.FOLDER) + AppLockfile.FOLDER.length));
  }

  private locate(entry: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
    const source = String(entry[AppLockfile.SOURCE_FIELD] ?? "");
    const archive = source.slice(Math.max(source.lastIndexOf("/"), source.lastIndexOf("\\")) + 1);
    return { ...entry, [AppLockfile.SOURCE_FIELD]: `${this.archivesStart}${archive}` };
  }

  private isArchive(entry: unknown): boolean {
    return String(AppLockfile.asRecord(entry)[AppLockfile.SOURCE_FIELD] ?? "").startsWith(this.archivesStart);
  }

  private static isLockedAs(locked: unknown, installed: unknown): boolean {
    const lockedEntry = AppLockfile.asRecord(locked);
    const installedEntry = AppLockfile.asRecord(installed);
    return locked !== undefined && AppLockfile.COMPARED_FIELDS.every(t => lockedEntry[t] === installedEntry[t]);
  }

  private static async isDependedOnAsAsync(locked: unknown, manifest: string): Promise<boolean> {
    if (!existsSync(manifest))
      return false;
    const lockedEntry = AppLockfile.asRecord(locked);
    const installedManifest = await AppLockfile.readAsync(manifest);
    return AppLockfile.DEPENDENCY_SECTIONS.every(t => AppLockfile.isSameRecord(AppLockfile.asRecord(lockedEntry[t]), AppLockfile.asRecord(installedManifest[t])));
  }

  private static isSameRecord(first: Readonly<Record<string, unknown>>, second: Readonly<Record<string, unknown>>): boolean {
    const keys = Object.keys(first);
    return keys.length === Object.keys(second).length && keys.every(t => Object.hasOwn(second, t) && first[t] === second[t]);
  }

  private static pin(entry: unknown, manifest: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
    const pinned: Record<string, unknown> = { ...AppLockfile.asRecord(entry) };
    for (const section of AppLockfile.PINNED_SECTIONS)
      if (manifest[section] !== undefined)
        pinned[section] = manifest[section];
    return pinned;
  }

  private static without(entry: unknown, fields: readonly string[]): Readonly<Record<string, unknown>> {
    return Object.fromEntries(Object.entries(AppLockfile.asRecord(entry)).filter(([field]) => !fields.includes(field)));
  }

  private static async readAsync(file: string): Promise<Readonly<Record<string, unknown>>> {
    return AppLockfile.asRecord(JSON.parse(await readFile(file, AppLockfile.ENCODING)));
  }

  private static readRecord(value: Readonly<Record<string, unknown>>, field: string): Readonly<Record<string, unknown>> {
    return AppLockfile.asRecord(value[field]);
  }

  private static asRecord(value: unknown): Readonly<Record<string, unknown>> {
    return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Readonly<Record<string, unknown>> : {};
  }
}
