/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import type PackageManifest from "../packages/package-manifest.ts";
import LockedPackage from "./locked-package.ts";
import PackageTarget from "./package-target.ts";
import PackagingException from "./packaging.exception.ts";

export default class ThirdPartyClosure {
  private static readonly LOCKFILE: string = "package-lock.json";
  private static readonly LOCKFILE_VERSION: number = 3;
  private static readonly ROOT: string = "";
  private static readonly FOLDER: string = "node_modules";
  private static readonly NESTED_FOLDER: string = `/${ThirdPartyClosure.FOLDER}/`;
  private static readonly NEGATION: string = "!";
  private static readonly PLATFORMS: ReadonlyMap<string, string> = new Map([[PackageTarget.WINDOWS, "win32"], [PackageTarget.MACOS, "darwin"], [PackageTarget.LINUX, "linux"]]);
  private static readonly LINUX_LIBRARY: string = "glibc";
  private static readonly ELECTRON: string = "electron";

  private readonly packages: Readonly<Record<string, unknown>>;
  private readonly target: PackageTarget;

  private constructor(packages: Readonly<Record<string, unknown>>, target: PackageTarget) {
    this.packages = packages;
    this.target = target;
  }

  public static async readAsync(root: string, target: PackageTarget): Promise<ThirdPartyClosure> {
    let lockfile: unknown;
    try {
      lockfile = JSON.parse(await readFile(path.join(root, ThirdPartyClosure.LOCKFILE), "utf8"));
    }
    catch (error) {
      throw new PackagingException(`The root ${ThirdPartyClosure.LOCKFILE} could not be read as JSON.`, { cause: error });
    }
    if (!ThirdPartyClosure.isRecord(lockfile) || lockfile["lockfileVersion"] !== ThirdPartyClosure.LOCKFILE_VERSION || !ThirdPartyClosure.isRecord(lockfile["packages"]))
      throw new PackagingException(`The root ${ThirdPartyClosure.LOCKFILE} must be a lockfile of version ${ThirdPartyClosure.LOCKFILE_VERSION} with its packages.`);
    return new ThirdPartyClosure(lockfile["packages"], target);
  }

  public collect(manifests: readonly PackageManifest[]): readonly LockedPackage[] {
    const found = new Map<string, LockedPackage>();
    for (const manifest of manifests)
      for (const name of manifest.externalDependencies.keys()) {
        if (this.resolve(ThirdPartyClosure.ROOT, name) === null)
          throw new PackagingException(`${manifest.directory}/package.json needs ${name}, which the root ${ThirdPartyClosure.LOCKFILE} does not lock; pin it in the root package.json and run npm install.`);
        this.visit(found, ThirdPartyClosure.ROOT, name, false);
      }

    const shipped = new Map<string, LockedPackage>();
    for (const locked of found.values()) {
      const other = shipped.get(locked.name);
      if (other === undefined)
        shipped.set(locked.name, locked);
      else if (other.version !== locked.version)
        throw new PackagingException(`The stage installs one version of each third-party package, but the shipped packages need ${other.id} at ${other.location} and ${locked.id} at ${locked.location}.`);
    }
    for (const locked of found.values()) {
      const entry = this.readEntry(locked.location);
      const optional = ThirdPartyClosure.readRecord(entry, "peerDependenciesMeta");
      const missing = Object.keys(ThirdPartyClosure.readRecord(entry, "peerDependencies"))
        .find(t => t !== ThirdPartyClosure.ELECTRON && !shipped.has(t) && ThirdPartyClosure.readRecord(optional, t)["optional"] !== true);
      if (missing !== undefined)
        throw new PackagingException(`${locked.id} at ${locked.location} needs the peer dependency ${missing}, which no shipped package brings and Electron does not provide, so it would fail at runtime.`);
    }
    return [...shipped.values()].sort((left, right) => left.name.localeCompare(right.name));
  }

  private static isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private static readRecord(entry: Readonly<Record<string, unknown>>, field: string): Readonly<Record<string, unknown>> {
    const value = entry[field];
    return ThirdPartyClosure.isRecord(value) ? value : {};
  }

  private static allows(list: unknown, value: string): boolean {
    if (!Array.isArray(list))
      return true;
    if (list.includes(`${ThirdPartyClosure.NEGATION}${value}`))
      return false;
    const required = list.filter(t => typeof t === "string" && !t.startsWith(ThirdPartyClosure.NEGATION));
    return required.length === 0 || required.includes(value);
  }

  private visit(found: Map<string, LockedPackage>, from: string, name: string, isOptional: boolean): void {
    const location = this.resolve(from, name);
    if (location === null) {
      if (isOptional)
        return;
      throw new PackagingException(`${from} needs ${name}, which ${ThirdPartyClosure.LOCKFILE} does not lock.`);
    }
    if (found.has(location))
      return;
    const entry = this.readEntry(location);
    if (!this.fits(entry)) {
      if (isOptional)
        return;
      throw new PackagingException(`${location} in ${ThirdPartyClosure.LOCKFILE} does not run on ${this.target.id}, yet a shipped package needs it.`);
    }

    found.set(location, new LockedPackage(location, entry));
    const optional = Object.keys(ThirdPartyClosure.readRecord(entry, "optionalDependencies"));
    for (const dependency of Object.keys(ThirdPartyClosure.readRecord(entry, "dependencies")).filter(t => !optional.includes(t)))
      this.visit(found, location, dependency, false);
    for (const dependency of optional)
      this.visit(found, location, dependency, true);
  }

  private resolve(from: string, name: string): string | null {
    const candidate = path.posix.join(from, ThirdPartyClosure.FOLDER, name);
    if (ThirdPartyClosure.isRecord(this.packages[candidate]))
      return candidate;
    if (from === ThirdPartyClosure.ROOT)
      return null;
    const parent = from.lastIndexOf(ThirdPartyClosure.NESTED_FOLDER);
    return this.resolve(parent < 0 ? ThirdPartyClosure.ROOT : from.slice(0, parent), name);
  }

  private readEntry(location: string): Readonly<Record<string, unknown>> {
    const entry = this.packages[location];
    return ThirdPartyClosure.isRecord(entry) ? entry : {};
  }

  private fits(entry: Readonly<Record<string, unknown>>): boolean {
    return ThirdPartyClosure.allows(entry["os"], String(ThirdPartyClosure.PLATFORMS.get(this.target.platform)))
      && ThirdPartyClosure.allows(entry["cpu"], this.target.architecture)
      && (this.target.platform !== PackageTarget.LINUX || ThirdPartyClosure.allows(entry["libc"], ThirdPartyClosure.LINUX_LIBRARY));
  }
}
