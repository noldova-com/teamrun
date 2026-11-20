/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { SetVersionException } from "./set-version.exception.ts";

export class VersionSetter {
  public static readonly CHANGELOG_FILE: string = "CHANGELOG.md";
  public static readonly MANIFESTS: readonly string[] = ["package.json", "src/package.json", "app/package.json", "app/src/noldova.teamrun.window.app/package.json"];
  private static readonly VERSION_PATTERN: RegExp = /^\d+\.\d+\.\d+$/;
  private static readonly VERSION_FILE: string = "version.json";
  private static readonly TEXT_FILES: readonly string[] = ["version.json", "src/noldova.teamrun/module.json"];
  private static readonly LOCKFILES: readonly string[] = ["package-lock.json", "app/package-lock.json"];
  private static readonly PACKAGES_FOLDER: string = "src";
  private static readonly MANIFEST_NAME: string = "package.json";
  private static readonly UNRELEASED: string = "## Unreleased";
  private static readonly SECTION_START: string = "## ";
  private static readonly GROUP_START: string = "### ";
  private static readonly MODULES_FOLDER: string = "node_modules/";
  private static readonly DEPENDENCY_SECTIONS: readonly string[] = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
  private static readonly INDENT: number = 2;

  private readonly root: string;

  public constructor(root: string) {
    this.root = root;
  }

  public async setAsync(version: string, released: string | null): Promise<string> {
    if (!VersionSetter.VERSION_PATTERN.test(version))
      throw new SetVersionException(`The version must be major.minor.patch, such as 0.0.3, not "${version}".`);
    const current = VersionSetter.readVersion(await this.readAsync(VersionSetter.VERSION_FILE), VersionSetter.VERSION_FILE);
    if (!VersionSetter.isNewer(version, current))
      throw new SetVersionException(`${version} isn't newer than ${VersionSetter.VERSION_FILE}'s ${current}.`);
    const changelog = VersionSetter.release(await this.readAsync(VersionSetter.CHANGELOG_FILE), version, released);
    const own = await this.listOwnAsync();
    const written = new Map<string, string>([[VersionSetter.CHANGELOG_FILE, changelog]]);
    for (const file of VersionSetter.TEXT_FILES)
      written.set(file, VersionSetter.replaceVersion(await this.readAsync(file), file, current, version));
    for (const file of VersionSetter.MANIFESTS)
      written.set(file, VersionSetter.format(VersionSetter.setManifest(VersionSetter.parse(await this.readAsync(file), file), own, current, version)));
    for (const file of VersionSetter.LOCKFILES)
      written.set(file, VersionSetter.format(VersionSetter.setLockfile(VersionSetter.parse(await this.readAsync(file), file), own, current, version)));
    for (const [file, text] of written)
      await writeFile(path.join(this.root, file), text);
    return current;
  }

  public static release(changelog: string, version: string, released: string | null): string {
    const lines = changelog.split("\n");
    const start = lines.indexOf(VersionSetter.UNRELEASED);
    if (start < 0)
      throw new SetVersionException(`${VersionSetter.CHANGELOG_FILE} has no "${VersionSetter.UNRELEASED}" section, so ${version} would release nothing it names.`);
    const end = VersionSetter.findSectionEnd(lines, start);
    const section = lines.slice(start + 1, end);
    const nothing = new SetVersionException(`The "${VersionSetter.UNRELEASED}" section of ${VersionSetter.CHANGELOG_FILE} names nothing ${version} releases.`);
    if (!section.some(t => t.trim().length > 0 && !t.startsWith(VersionSetter.GROUP_START)))
      throw nothing;
    const heading = `${VersionSetter.SECTION_START}${version}`;
    if (released === null)
      return [...lines.slice(0, start), VersionSetter.UNRELEASED, String(), heading, ...section, ...lines.slice(end)].join("\n");
    const shipped = VersionSetter.readShipped(released);
    const moved = VersionSetter.keep(section, t => shipped.has(t));
    if (moved.length === 0)
      throw nothing;
    const left = VersionSetter.keep(section, t => !shipped.has(t));
    return [...lines.slice(0, start), VersionSetter.UNRELEASED, String(), ...(left.length === 0 ? [] : [...VersionSetter.trim(left), String()]),
      heading, String(), ...VersionSetter.trim(moved), String(), ...lines.slice(end)].join("\n");
  }

  private static isNewer(version: string, current: string): boolean {
    const [major = 0, minor = 0, patch = 0] = version.split(".").map(Number);
    const [currentMajor = 0, currentMinor = 0, currentPatch = 0] = current.split(".").map(Number);
    return major !== currentMajor ? major > currentMajor : minor !== currentMinor ? minor > currentMinor : patch > currentPatch;
  }

  private static readShipped(changelog: string): ReadonlySet<string> {
    const lines = changelog.split("\n");
    const start = lines.indexOf(VersionSetter.UNRELEASED);
    return new Set(start < 0 ? [] : lines.slice(start + 1, VersionSetter.findSectionEnd(lines, start)).filter(t => t.length > 0 && !t.startsWith(VersionSetter.GROUP_START)));
  }

  private static findSectionEnd(lines: readonly string[], start: number): number {
    const end = lines.findIndex((t, index) => index > start && t.startsWith(VersionSetter.SECTION_START));
    return end < 0 ? lines.length : end;
  }

  private static keep(section: readonly string[], isKept: (line: string) => boolean): readonly string[] {
    const kept: string[] = [];
    let group: string | null = null;
    for (const line of section) {
      if (line.startsWith(VersionSetter.GROUP_START)) {
        group = line;
        continue;
      }
      if (line.length === 0 || !isKept(line))
        continue;
      if (group !== null) {
        kept.push(String(), group, String());
        group = null;
      }
      kept.push(line);
    }
    return kept;
  }

  private static trim(lines: readonly string[]): readonly string[] {
    const first = lines.findIndex(t => t.length > 0);
    return first < 0 ? [] : lines.slice(first);
  }

  private async listOwnAsync(): Promise<ReadonlySet<string>> {
    const names = new Set<string>();
    for (const entry of await readdir(path.join(this.root, VersionSetter.PACKAGES_FOLDER), { withFileTypes: true })) {
      const file = path.posix.join(VersionSetter.PACKAGES_FOLDER, entry.name, VersionSetter.MANIFEST_NAME);
      if (entry.isDirectory() && existsSync(path.join(this.root, file))) {
        const name = VersionSetter.parse(await this.readAsync(file), file)["name"];
        if (typeof name === "string")
          names.add(name);
      }
    }
    return names;
  }

  private async readAsync(file: string): Promise<string> {
    try {
      return await readFile(path.join(this.root, file), "utf8");
    }
    catch (error) {
      throw new SetVersionException(`${file} can't be read: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private static readVersion(text: string, file: string): string {
    const version = VersionSetter.parse(text, file)["version"];
    if (typeof version !== "string")
      throw new SetVersionException(`${file} holds no version string.`);
    return version;
  }

  private static replaceVersion(text: string, file: string, current: string, version: string): string {
    const field = `"version": "${current}"`;
    if (text.split(field).length !== 2)
      throw new SetVersionException(`${file} must hold ${field} once.`);
    return text.replace(field, `"version": "${version}"`);
  }

  private static setManifest(manifest: Record<string, unknown>, own: ReadonlySet<string>, current: string, version: string): Record<string, unknown> {
    return VersionSetter.setPins({ ...manifest, ...(manifest["version"] === current ? { version } : {}) }, own, current, version);
  }

  private static setLockfile(lockfile: Record<string, unknown>, own: ReadonlySet<string>, current: string, version: string): Record<string, unknown> {
    const packages: Record<string, unknown> = {};
    for (const [location, entry] of Object.entries(VersionSetter.asRecord(lockfile["packages"]))) {
      const record = VersionSetter.asRecord(entry);
      const name = location.slice(location.lastIndexOf(VersionSetter.MODULES_FOLDER) + VersionSetter.MODULES_FOLDER.length);
      const isWorkspace = !location.includes(VersionSetter.MODULES_FOLDER);
      const isOwn = !isWorkspace && own.has(name);
      const resolved = record["resolved"];
      packages[location] = VersionSetter.setPins({
        ...record,
        ...((isWorkspace || isOwn) && record["version"] === current ? { version } : {}),
        ...(isOwn && typeof resolved === "string" ? { resolved: resolved.replace(`-${current}.tgz`, `-${version}.tgz`) } : {})
      }, own, current, version);
    }
    return { ...lockfile, ...(lockfile["version"] === current ? { version } : {}), packages };
  }

  private static setPins(record: Record<string, unknown>, own: ReadonlySet<string>, current: string, version: string): Record<string, unknown> {
    const pinned: Record<string, unknown> = { ...record };
    for (const section of VersionSetter.DEPENDENCY_SECTIONS)
      if (Object.hasOwn(record, section))
        pinned[section] = Object.fromEntries(Object.entries(VersionSetter.asRecord(record[section])).map(([name, pin]) => [name, own.has(name) && pin === current ? version : pin]));
    return pinned;
  }

  private static parse(text: string, file: string): Record<string, unknown> {
    try {
      return VersionSetter.asRecord(JSON.parse(text));
    }
    catch (error) {
      throw new SetVersionException(`${file} isn't valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private static format(value: Readonly<Record<string, unknown>>): string {
    return `${JSON.stringify(value, null, VersionSetter.INDENT)}\n`;
  }

  private static asRecord(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : {};
  }
}
