/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";

import PackagingException from "./packaging.exception.ts";

export default class LockedPackage {
  private static readonly FOLDER: string = "node_modules/";
  private static readonly SCHEMES: readonly string[] = ["https:", "http:"];
  private static readonly HASH_ALGORITHM: string = "sha512";
  private static readonly INTEGRITY_PREFIX: string = `${LockedPackage.HASH_ALGORITHM}-`;
  private static readonly INTEGRITY_SEPARATOR: RegExp = /\s+/;
  private static readonly SCOPE_SEPARATOR: string = "/";
  private static readonly FILE_SCOPE_SEPARATOR: string = "+";
  private static readonly FILE_EXTENSION: string = ".tgz";
  private static readonly NAME: RegExp = /^(?:@[a-z0-9~-][a-z0-9._~-]*\/)?[A-Za-z0-9~-][A-Za-z0-9._~-]*$/;
  private static readonly VERSION: RegExp = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.+-]+)?$/;

  public readonly location: string;
  public readonly name: string;
  public readonly version: string;
  public readonly resolved: string;
  public readonly sha512: string;

  public constructor(location: string, entry: Readonly<Record<string, unknown>>) {
    const name = location.slice(location.lastIndexOf(LockedPackage.FOLDER) + LockedPackage.FOLDER.length);
    const { version, resolved, integrity } = entry;
    if (!LockedPackage.NAME.test(name) || typeof version !== "string" || !LockedPackage.VERSION.test(version))
      throw new PackagingException(`${location} in package-lock.json has no valid package name and version.`);
    if (entry["inBundle"] === true)
      throw new PackagingException(`${name}@${version} at ${location} in package-lock.json is bundled inside its parent's tarball; bundled dependencies are not supported, so it cannot ship.`);
    if (entry["name"] !== undefined && entry["name"] !== name)
      throw new PackagingException(`${location} in package-lock.json installs ${String(entry["name"])} under the alias ${name}; aliases are not supported, so it cannot ship.`);
    if (typeof resolved !== "string" || !URL.canParse(resolved) || !LockedPackage.SCHEMES.includes(new URL(resolved).protocol))
      throw new PackagingException(`${name}@${version} at ${location} in package-lock.json is not resolved to a registry tarball, so it cannot ship.`);
    const sha512 = typeof integrity === "string"
      ? integrity.split(LockedPackage.INTEGRITY_SEPARATOR).find(t => t.startsWith(LockedPackage.INTEGRITY_PREFIX))?.slice(LockedPackage.INTEGRITY_PREFIX.length)
      : undefined;
    if (sha512 === undefined)
      throw new PackagingException(`${name}@${version} at ${location} in package-lock.json has no SHA-512 integrity, so its tarball cannot be verified.`);

    this.location = location;
    this.name = name;
    this.version = version;
    this.resolved = resolved;
    this.sha512 = sha512;
  }

  public get id(): string {
    return `${this.name}@${this.version}`;
  }

  public get fileName(): string {
    return `${this.name.split(LockedPackage.SCOPE_SEPARATOR).join(LockedPackage.FILE_SCOPE_SEPARATOR)}-${this.version}${LockedPackage.FILE_EXTENSION}`;
  }

  public matches(data: Buffer): boolean {
    return createHash(LockedPackage.HASH_ALGORITHM).update(data).digest("base64") === this.sha512;
  }
}
