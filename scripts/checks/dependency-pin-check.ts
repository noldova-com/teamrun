/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import type RepositoryFiles from "../repository/repository-files.ts";
import type ICheck from "./interfaces/i-check.ts";

export default class DependencyPinCheck implements ICheck {
  private static readonly MANIFEST_NAME: string = "package.json";
  private static readonly LOCKFILE_NAME: string = "package-lock.json";
  private static readonly CONFIGURATION_NAME: string = ".npmrc";
  private static readonly SAVE_EXACT: string = "save-exact=true";
  private static readonly SECTIONS: readonly string[] = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies", "overrides"];
  private static readonly OVERRIDES: string = "overrides";
  private static readonly OVERRIDE_SELF: string = ".";
  private static readonly OWN_PREFIX: string = "@noldova/teamrun-";
  private static readonly OWN_VERSION: string = "__VERSION__";
  private static readonly EXACT_VERSION: RegExp = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
  private static readonly LINE_SEPARATOR: string = "\n";
  private static readonly SHIPPED_SECTION: string = "dependencies";
  private static readonly LOCKED_FOLDER: string = "node_modules/";

  private readonly root: string;
  private readonly files: RepositoryFiles;

  public readonly title: string = "Dependency pins";

  public constructor(root: string, files: RepositoryFiles) {
    this.root = root;
    this.files = files;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const files = await this.files.listAsync();
    const manifests = files.filter(t => path.posix.basename(t) === DependencyPinCheck.MANIFEST_NAME);
    const findings: string[] = [];
    const texts = new Map<string, string>();
    for (const manifest of manifests) {
      const text = await this.readTextAsync(manifest);
      texts.set(manifest, text);
      findings.push(...DependencyPinCheck.validate(manifest, text));
    }
    findings.push(...await this.validateRootPinsAsync(files, texts));
    const lockfiles = files.filter(t => path.posix.basename(t) === DependencyPinCheck.LOCKFILE_NAME);
    for (const lockfile of lockfiles)
      findings.push(...await this.validateConfigurationAsync(files, path.posix.join(path.posix.dirname(lockfile), DependencyPinCheck.CONFIGURATION_NAME)));

    for (const finding of findings)
      output.write(`${finding}\n`);
    output.write(`Checked the dependency versions of ${manifests.length} manifests and the npm configuration of ${lockfiles.length} lockfiles.\n`);
    return findings.length === 0;
  }

  private static validate(file: string, text: string): readonly string[] {
    let manifest: unknown;
    try {
      manifest = JSON.parse(text);
    }
    catch {
      return [`${file}: could not be read as JSON.`];
    }
    if (!DependencyPinCheck.isRecord(manifest))
      return [`${file}: is not a JSON object.`];

    const findings: string[] = [];
    for (const section of DependencyPinCheck.SECTIONS) {
      const entries = manifest[section];
      if (entries === undefined)
        continue;
      if (!DependencyPinCheck.isRecord(entries)) {
        findings.push(`${file}: ${section} is not an object of names and versions.`);
        continue;
      }
      findings.push(...DependencyPinCheck.validateEntries(file, section, entries, section === DependencyPinCheck.OVERRIDES, section));
    }
    return findings;
  }

  private static validateEntries(file: string, location: string, entries: Readonly<Record<string, unknown>>, isOverride: boolean, parent: string): readonly string[] {
    const findings: string[] = [];
    for (const [name, value] of Object.entries(entries)) {
      const dependency = isOverride && name === DependencyPinCheck.OVERRIDE_SELF ? parent : name;
      if (isOverride && DependencyPinCheck.isRecord(value))
        findings.push(...DependencyPinCheck.validateEntries(file, `${location} ${name}`, value, true, name));
      else if (typeof value !== "string")
        findings.push(`${file}: ${location} ${name} has no version string.`);
      else if (dependency.startsWith(DependencyPinCheck.OWN_PREFIX)) {
        if (value !== DependencyPinCheck.OWN_VERSION)
          findings.push(`${file}: ${location} ${name} is "${value}"; TeamRun's own packages take "${DependencyPinCheck.OWN_VERSION}", which the build stamps.`);
      }
      else if (!DependencyPinCheck.EXACT_VERSION.test(value))
        findings.push(`${file}: ${location} ${name} is "${value}", which is not an exact version; an external dependency takes an exact version from the registry, such as 1.2.3, never a range, tag, alias, path, Git or URL source.`);
    }
    return findings;
  }

  private static parse(text: string | undefined): unknown {
    try {
      return text === undefined ? null : JSON.parse(text);
    }
    catch {
      return null;
    }
  }

  private static readRecord(value: unknown, field: string): Readonly<Record<string, unknown>> {
    const entries = DependencyPinCheck.isRecord(value) ? value[field] : undefined;
    return DependencyPinCheck.isRecord(entries) ? entries : {};
  }

  private static readShipped(file: string, text: string): readonly (readonly [string, string, string])[] {
    const manifest = DependencyPinCheck.parse(text);
    if (!DependencyPinCheck.isRecord(manifest) || typeof manifest["name"] !== "string" || !manifest["name"].startsWith(DependencyPinCheck.OWN_PREFIX))
      return [];
    return Object.entries(DependencyPinCheck.readRecord(manifest, DependencyPinCheck.SHIPPED_SECTION))
      .filter((t): t is [string, string] => !t[0].startsWith(DependencyPinCheck.OWN_PREFIX) && typeof t[1] === "string")
      .map(([name, version]) => [file, name, version] satisfies readonly [string, string, string]);
  }

  private static isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private async validateRootPinsAsync(files: readonly string[], texts: ReadonlyMap<string, string>): Promise<readonly string[]> {
    const shipped = [...texts].filter(([file]) => file !== DependencyPinCheck.MANIFEST_NAME).flatMap(([file, text]) => DependencyPinCheck.readShipped(file, text));
    if (shipped.length === 0)
      return [];
    const pins = DependencyPinCheck.readRecord(DependencyPinCheck.parse(texts.get(DependencyPinCheck.MANIFEST_NAME)), DependencyPinCheck.SHIPPED_SECTION);
    const locked = files.includes(DependencyPinCheck.LOCKFILE_NAME)
      ? DependencyPinCheck.readRecord(DependencyPinCheck.parse(await this.readTextAsync(DependencyPinCheck.LOCKFILE_NAME)), "packages")
      : {};
    return shipped.flatMap(([file, name, version]) => {
      if (pins[name] !== version)
        return [`${file}: dependencies ${name} is "${version}", so the root ${DependencyPinCheck.MANIFEST_NAME} must pin it to the same version in its dependencies; `
          + "packaging ships it from the root lockfile."];
      const entry = locked[`${DependencyPinCheck.LOCKED_FOLDER}${name}`];
      const lockedVersion = DependencyPinCheck.isRecord(entry) ? entry["version"] : undefined;
      return lockedVersion === version ? [] : [`${file}: dependencies ${name} is "${version}", but the root ${DependencyPinCheck.LOCKFILE_NAME} locks `
        + `${typeof lockedVersion === "string" ? `version ${lockedVersion}` : "no version"} of it; run npm install.`];
    });
  }

  private async validateConfigurationAsync(files: readonly string[], file: string): Promise<readonly string[]> {
    if (!files.includes(file))
      return [`${file}: is missing; a folder with a lockfile keeps "${DependencyPinCheck.SAVE_EXACT}" there, so npm saves exact versions.`];
    const lines = (await this.readTextAsync(file)).split(DependencyPinCheck.LINE_SEPARATOR).map(t => t.trim());
    return lines.includes(DependencyPinCheck.SAVE_EXACT) ? [] : [`${file}: lacks the line "${DependencyPinCheck.SAVE_EXACT}", which makes npm save exact versions.`];
  }

  private async readTextAsync(file: string): Promise<string> {
    return await readFile(path.join(this.root, file), "utf8");
  }
}
