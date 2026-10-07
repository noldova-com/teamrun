/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import LicenseExpression from "./license-expression.ts";
import type LockedPackage from "./locked-package.ts";
import PackagingException from "./packaging.exception.ts";
import TarArchive from "./tar-archive.ts";

export default class ThirdPartyPackage {
  private static readonly DOWNLOAD_LIMIT: number = 120_000;
  private static readonly MANIFEST_FILE: string = "package.json";
  private static readonly LICENSE_FILE: RegExp = /^(?:(?:licen[cs]e|copying|unlicense)(?:[-_][a-z0-9+-]+(?:\.\d+)*)?|[a-z0-9+-]+(?:\.\d+)*[-_]licen[cs]e)(?:\.(?:md|txt|markdown))?$/i;
  private static readonly LICENSE_SEPARATOR: string = "\n\n";
  private static readonly TARBALL_EXTENSION: string = ".tgz";
  private static readonly REVIEWED_EXTENSION: string = ".txt";

  public readonly locked: LockedPackage;
  public readonly file: string;
  public readonly license: LicenseExpression;
  public readonly licenseText: string;

  private constructor(locked: LockedPackage, file: string, license: LicenseExpression, licenseText: string) {
    this.locked = locked;
    this.file = file;
    this.license = license;
    this.licenseText = licenseText;
  }

  public static async prepareAsync(locked: LockedPackage, folder: string, reviewedLicenses: string): Promise<ThirdPartyPackage> {
    const file = path.join(folder, locked.fileName);
    const kept = existsSync(file) ? await readFile(file) : null;
    const data = kept !== null && locked.matches(kept) ? kept : await ThirdPartyPackage.downloadAsync(locked);
    await mkdir(folder, { recursive: true });
    await writeFile(file, data);

    const archive = TarArchive.fromGzip(data);
    const manifest = ThirdPartyPackage.readManifest(locked, archive);
    if (manifest["name"] !== locked.name || manifest["version"] !== locked.version)
      throw new PackagingException(`The tarball of ${locked.id} from ${locked.resolved} holds ${String(manifest["name"])}@${String(manifest["version"])} instead, so it cannot ship.`);
    const license = new LicenseExpression(locked.id, manifest["license"]);
    const texts = [...archive.topLevelFiles].filter(([name]) => ThirdPartyPackage.LICENSE_FILE.test(name)).sort(([left], [right]) => left.localeCompare(right))
      .map(([, content]) => content.toString("utf8").trim());
    const licenseText = texts.length > 0 ? texts.join(ThirdPartyPackage.LICENSE_SEPARATOR) : await ThirdPartyPackage.readReviewedAsync(locked, reviewedLicenses);
    return new ThirdPartyPackage(locked, file, license, licenseText);
  }

  public formatNotice(): string {
    return `${this.locked.id}\nLicense: ${this.license.describe()}\n\n${this.licenseText}\n`;
  }

  private static readManifest(locked: LockedPackage, archive: TarArchive): Readonly<Record<string, unknown>> {
    const text = archive.topLevelFiles.get(ThirdPartyPackage.MANIFEST_FILE)?.toString("utf8");
    if (text === undefined)
      throw new PackagingException(`The tarball of ${locked.id} from ${locked.resolved} has no package.json, so it cannot ship.`);
    let manifest: unknown;
    try {
      manifest = JSON.parse(text);
    }
    catch (error) {
      throw new PackagingException(`The package.json in the tarball of ${locked.id} could not be read as JSON, so it cannot ship.`, { cause: error });
    }
    if (!ThirdPartyPackage.isRecord(manifest))
      throw new PackagingException(`The package.json in the tarball of ${locked.id} is not a JSON object, so it cannot ship.`);
    return manifest;
  }

  private static isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private static async readReviewedAsync(locked: LockedPackage, reviewedLicenses: string): Promise<string> {
    const file = path.join(reviewedLicenses, `${path.basename(locked.fileName, ThirdPartyPackage.TARBALL_EXTENSION)}${ThirdPartyPackage.REVIEWED_EXTENSION}`);
    if (!existsSync(file))
      throw new PackagingException(`${locked.id} has no license file in its tarball, such as LICENSE, LICENCE or COPYING, and ${file} holds no reviewed license text for it, so its license cannot ship.`);
    return (await readFile(file, "utf8")).trim();
  }

  private static async downloadAsync(locked: LockedPackage): Promise<Buffer> {
    let response: Response;
    try {
      response = await fetch(locked.resolved, { signal: AbortSignal.timeout(ThirdPartyPackage.DOWNLOAD_LIMIT) });
    }
    catch (error) {
      throw new PackagingException(`${locked.id} could not be downloaded from ${locked.resolved}: ${String(error)}`, { cause: error });
    }
    if (!response.ok)
      throw new PackagingException(`${locked.id} could not be downloaded from ${locked.resolved}: HTTP ${response.status}.`);
    const data = Buffer.from(await response.arrayBuffer());
    if (!locked.matches(data))
      throw new PackagingException(`The tarball of ${locked.id} from ${locked.resolved} does not match the SHA-512 integrity in package-lock.json, so it cannot ship.`);
    return data;
  }
}
