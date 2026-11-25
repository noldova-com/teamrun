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

import "@noldova/context.core";

import { PackageNaming } from "../packages/package-naming.ts";
import { VersionRange } from "../packages/version-range.ts";
import type { RepositoryFiles } from "../repository/repository-files.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class DependencyPinCheck implements ICheck {
  private static readonly MANIFEST_NAME: string = "package.json";
  private static readonly LOCKFILE_NAME: string = "package-lock.json";
  private static readonly CONFIGURATION_NAME: string = ".npmrc";
  private static readonly SAVE_EXACT: string = "save-exact=true";
  private static readonly SECTIONS: readonly string[] = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies", "overrides"];
  private static readonly OVERRIDES: string = "overrides";
  private static readonly OVERRIDE_SELF: string = ".";
  private static readonly OWN_VERSION: string = "__VERSION__";
  private static readonly APP_FOLDER: string = "app/";
  private static readonly VERSION_FIELD: string = "version";
  private static readonly NO_VERSION: string = "";
  private static readonly EXACT_VERSION: RegExp = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
  private static readonly LINE_SEPARATOR: string = "\n";
  private static readonly SHIPPED_SECTION: string = "dependencies";
  private static readonly SHIPPED_SECTIONS: readonly string[] = ["dependencies", "peerDependencies"];
  private static readonly PEER_SECTION: string = "peerDependencies";
  private static readonly ANGULAR_CORE: string = "@angular/core";
  private static readonly ANGULAR_FOLDER: string = "src";
  private static readonly ANGULAR_MANIFEST: string = "src/package.json";
  private static readonly ROOT_FOLDER: string = "";
  private static readonly LOCKED_FOLDER: string = "node_modules/";
  private static readonly DECLARATION_NAME: string = "module.json";
  private static readonly DECLARATION_FOLDER: string = "src/";
  private static readonly DESKTOP_CORE_FIELD: string = "noldovaDesktop";
  private static readonly RANGE_FORM: string = ">=<lowest> <first refused>";

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
    const productVersion = DependencyPinCheck.readVersion(await this.readTextAsync(DependencyPinCheck.MANIFEST_NAME));
    for (const manifest of manifests) {
      const text = await this.readTextAsync(manifest);
      texts.set(manifest, text);
      const ownVersion = manifest.startsWith(DependencyPinCheck.APP_FOLDER) ? productVersion : DependencyPinCheck.OWN_VERSION;
      findings.push(...DependencyPinCheck.validate(manifest, text, ownVersion), ...DependencyPinCheck.validateShared(manifest, text));
    }
    const [pinFindings, compared] = await this.validateInstallPinsAsync(files, texts);
    findings.push(...pinFindings);
    const declarations = files.filter(t => t.startsWith(DependencyPinCheck.DECLARATION_FOLDER) && path.posix.basename(t) === DependencyPinCheck.DECLARATION_NAME);
    for (const declaration of declarations)
      findings.push(...DependencyPinCheck.validateDesktopCore(declaration, await this.readTextAsync(declaration), texts));
    const lockfiles = files.filter(t => path.posix.basename(t) === DependencyPinCheck.LOCKFILE_NAME);
    for (const lockfile of lockfiles)
      findings.push(...await this.validateConfigurationAsync(files, path.posix.join(path.posix.dirname(lockfile), DependencyPinCheck.CONFIGURATION_NAME)));

    for (const finding of findings)
      output.write(`${finding}\n`);
    output.write(`Checked the dependency versions of ${manifests.length} manifests, ${compared} shipped versions against their pins and locks, the npm configuration of ${lockfiles.length} lockfiles `
      + `and the Noldova Desktop range of ${declarations.length} module declarations.\n`);
    return findings.length === 0;
  }

  private static validate(file: string, text: string, ownVersion: string): readonly string[] {
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
      if (Object.isUndefined(entries))
        continue;
      if (!DependencyPinCheck.isRecord(entries)) {
        findings.push(`${file}: ${section} is not an object of names and versions.`);
        continue;
      }
      findings.push(...DependencyPinCheck.validateEntries(file, section, entries, section === DependencyPinCheck.OVERRIDES, section, ownVersion));
    }
    return findings;
  }

  private static validateShared(file: string, text: string): readonly string[] {
    const manifest = DependencyPinCheck.parse(text);
    if (!DependencyPinCheck.isPackage(file, manifest))
      return [];
    return Object.keys(DependencyPinCheck.readRecord(manifest, DependencyPinCheck.SHIPPED_SECTION)).filter(t => PackageNaming.isShared(t))
      .map(t => `${file}: dependencies ${t} is a package Noldova Desktop shares with every module; it goes in peerDependencies `
        + (PackageNaming.isDesktopCore(t) ? "at the module's noldovaDesktop range" : `as a range of the form ${DependencyPinCheck.RANGE_FORM}, from a tested version to the next minor below 1.0, or the next major from 1.0`)
        + ", since Noldova Desktop's build refuses an app whose module brings its own copy.");
  }

  private static validateDesktopCore(declaration: string, text: string, texts: ReadonlyMap<string, string>): readonly string[] {
    const named = DependencyPinCheck.parse(text);
    const field = DependencyPinCheck.isRecord(named) ? named[DependencyPinCheck.DESKTOP_CORE_FIELD] : undefined;
    const range = Object.isString(field) ? VersionRange.parse(field) : null;
    if (Object.isNull(range) || !range.isWritten)
      return [`${declaration}: ${DependencyPinCheck.DESKTOP_CORE_FIELD} is ${Object.isUndefined(field) ? "missing" : JSON.stringify(field)}; it names the Noldova Desktop versions the module `
        + `accepts as ${DependencyPinCheck.RANGE_FORM}, from the version it builds against to the next minor below 1.0, or the next major from 1.0.`];
    const noldovaDesktop = range.toString();
    return [...texts].flatMap(([file, manifestText]) => {
      const manifest = DependencyPinCheck.parse(manifestText);
      if (!DependencyPinCheck.isPackage(file, manifest))
        return [];
      return Object.entries(DependencyPinCheck.readRecord(manifest, DependencyPinCheck.PEER_SECTION)).filter(([name, version]) => PackageNaming.isDesktopCore(name) && version !== noldovaDesktop)
        .map(([name, version]) => `${file}: ${DependencyPinCheck.PEER_SECTION} ${name} is ${JSON.stringify(version)}; a peer on Noldova Desktop's packages takes ${declaration}'s `
          + `${DependencyPinCheck.DESKTOP_CORE_FIELD}, "${noldovaDesktop}".`);
    });
  }

  private static validateEntries(file: string, location: string, entries: Readonly<Record<string, unknown>>, isOverride: boolean, parent: string,
    ownVersion: string): readonly string[] {
    const findings: string[] = [];
    for (const [name, value] of Object.entries(entries)) {
      const dependency = isOverride && name === DependencyPinCheck.OVERRIDE_SELF ? parent : name;
      if (isOverride && DependencyPinCheck.isRecord(value))
        findings.push(...DependencyPinCheck.validateEntries(file, `${location} ${name}`, value, true, name, ownVersion));
      else if (!Object.isString(value))
        findings.push(`${file}: ${location} ${name} has no version string.`);
      else if (PackageNaming.isOwn(dependency)) {
        if (value !== ownVersion)
          findings.push(ownVersion === DependencyPinCheck.OWN_VERSION
            ? `${file}: ${location} ${name} is "${value}"; Noldova's own packages take "${DependencyPinCheck.OWN_VERSION}", which the build stamps.`
            : `${file}: ${location} ${name} is "${value}"; the app takes Noldova's own packages at the root package.json's version, "${ownVersion}", from this checkout's build.`);
      }
      else if (location === DependencyPinCheck.PEER_SECTION && PackageNaming.isShared(dependency) && !PackageNaming.isDesktopCore(dependency)) {
        if (VersionRange.parse(value)?.isWritten !== true)
          findings.push(`${file}: ${location} ${name} is "${value}", which is not a range of the form ${DependencyPinCheck.RANGE_FORM} `
            + "that ends at the next minor below 1.0, or the next major from 1.0; a peer on context's or the kit's packages takes one, from the version it builds "
            + "against, such as >=0.1.2 <0.2.0 or >=1.2.3 <2.0.0, so their release inside it reaches TeamRun with one pin change.");
      }
      else if (location === DependencyPinCheck.PEER_SECTION && PackageNaming.isShared(dependency)) {
        if (!DependencyPinCheck.EXACT_VERSION.test(value) && VersionRange.parse(value)?.isWritten !== true)
          findings.push(`${file}: ${location} ${name} is "${value}", which is neither an exact version nor a range of the form ${DependencyPinCheck.RANGE_FORM} `
            + "that ends at the next minor below 1.0, or the next major from 1.0; a peer on Noldova Desktop's packages takes one of the two, "
            + "such as 1.2.3, >=0.1.2 <0.2.0 or >=1.2.3 <2.0.0.");
      }
      else if (!DependencyPinCheck.EXACT_VERSION.test(value))
        findings.push(`${file}: ${location} ${name} is "${value}", which is not an exact version; an external dependency takes an exact version from the registry, such as 1.2.3, never a range, tag, alias, path, Git or URL source.`);
    }
    return findings;
  }

  private static readVersion(text: string): string {
    const manifest = DependencyPinCheck.parse(text);
    return DependencyPinCheck.isRecord(manifest) ? String(manifest[DependencyPinCheck.VERSION_FIELD]) : DependencyPinCheck.NO_VERSION;
  }

  private static parse(text: string | undefined): unknown {
    try {
      return Object.isUndefined(text) ? null : JSON.parse(text);
    }
    catch {
      return null;
    }
  }

  private static readRecord(value: unknown, field: string): Readonly<Record<string, unknown>> {
    const entries = DependencyPinCheck.isRecord(value) ? value[field] : undefined;
    return DependencyPinCheck.isRecord(entries) ? entries : {};
  }

  private static readShipped(file: string, text: string): readonly (readonly [string, string, string, string, string])[] {
    const manifest = DependencyPinCheck.parse(text);
    if (!DependencyPinCheck.isPackage(file, manifest))
      return [];
    const folder = Object.keys(DependencyPinCheck.readRecord(manifest, DependencyPinCheck.PEER_SECTION)).includes(DependencyPinCheck.ANGULAR_CORE)
      ? DependencyPinCheck.ANGULAR_FOLDER
      : DependencyPinCheck.ROOT_FOLDER;
    return DependencyPinCheck.SHIPPED_SECTIONS.flatMap(section => Object.entries(DependencyPinCheck.readRecord(manifest, section))
      .filter((t): t is [string, string] => !PackageNaming.isOwn(t[0]) && Object.isString(t[1]))
      .map(([name, version]) => [file, name, version, folder, section] satisfies readonly [string, string, string, string, string]));
  }

  private static isPackage(file: string, manifest: unknown): manifest is Readonly<Record<string, unknown>> {
    return file !== DependencyPinCheck.MANIFEST_NAME && file !== DependencyPinCheck.ANGULAR_MANIFEST && DependencyPinCheck.isRecord(manifest) && Object.isString(manifest["name"]) && PackageNaming.isOwn(manifest["name"]);
  }

  private static isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return Object.isObject(value) && !Array.isArray(value);
  }

  private async validateInstallPinsAsync(files: readonly string[], texts: ReadonlyMap<string, string>): Promise<readonly [readonly string[], number]> {
    const shipped = [...texts].filter(([file]) => file !== DependencyPinCheck.MANIFEST_NAME).flatMap(([file, text]) => DependencyPinCheck.readShipped(file, text));
    if (shipped.length === 0)
      return [[], 0];
    const findings: string[] = [];
    for (const folder of new Set(shipped.map(t => t[3]))) {
      const manifest = path.posix.join(folder, DependencyPinCheck.MANIFEST_NAME);
      const lockfile = DependencyPinCheck.LOCKFILE_NAME;
      const pins = DependencyPinCheck.readRecord(DependencyPinCheck.parse(texts.get(manifest)), DependencyPinCheck.SHIPPED_SECTION);
      const locked = files.includes(lockfile) ? DependencyPinCheck.readRecord(DependencyPinCheck.parse(await this.readTextAsync(lockfile)), "packages") : {};
      const isRoot = folder === DependencyPinCheck.ROOT_FOLDER;
      const pinning = isRoot ? `the root ${manifest}` : manifest;
      const locking = `the root ${lockfile}`;
      findings.push(...shipped.filter(t => t[3] === folder).flatMap(([file, name, version, , section]) => {
        const pin = pins[name];
        const range = VersionRange.parse(version);
        if (!Object.isNull(range) && Object.isString(pin) && !range.includes(pin))
          return [`${file}: ${section} ${name} is "${version}", but ${pinning} pins "${pin}", outside it; the range must include the version the build installs and tests against.`];
        if (!Object.isNull(range) && Object.isString(pin) && section === DependencyPinCheck.PEER_SECTION && PackageNaming.isShared(name) && !PackageNaming.isDesktopCore(name) && !range.startsAtOrJustBelow(pin))
          return [`${file}: ${section} ${name} is "${version}", but ${pinning} pins "${pin}"; a peer on context's or the kit's packages starts from the version the build installs `
            + "and tests against, or one below it, since a version further below is one no build of TeamRun has run on."];
        if (!Object.isString(pin) || (Object.isNull(range) && pin !== version)) {
          const pinned = Object.isString(pin) ? `pins "${pin}"` : "pins nothing";
          const source = !isRoot ? `the Angular project in ${folder}/, the root's workspace, installs it from ${locking}.`
            : section === DependencyPinCheck.PEER_SECTION ? "the build installs the root's copy beside the package, and its tests run against that version."
              : "packaging ships it from the root lockfile.";
          return [`${file}: ${section} ${name} is "${version}", but ${pinning} ${pinned}; it must pin the same version in its dependencies, since ${source}`];
        }
        const entry = locked[path.posix.join(folder, DependencyPinCheck.LOCKED_FOLDER, name)] ?? locked[`${DependencyPinCheck.LOCKED_FOLDER}${name}`];
        const lockedVersion = DependencyPinCheck.isRecord(entry) ? entry["version"] : undefined;
        return lockedVersion === pin ? [] : [`${file}: ${section} ${name} is "${version}", but ${locking} locks `
          + `${Object.isString(lockedVersion) ? `version ${lockedVersion}` : "no version"} of it; run npm install.`];
      }));
    }
    return [findings, shipped.length];
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
