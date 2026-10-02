/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";
import { fileURLToPath } from "node:url";

import type ProcessRunner from "../processes/process-runner.ts";
import NpmCommand from "../toolchain/npm-command.ts";
import BuildLayout from "./build-layout.ts";
import BuildRecord from "./build-record.ts";
import ContentHash from "./content-hash.ts";
import PackageBuilder from "./package-builder.ts";
import PackageCatalog from "./package-catalog.ts";
import type PackageManifest from "./package-manifest.ts";
import PackageException from "./package.exception.ts";
import RootManifest from "./root-manifest.ts";

export default class PackageBuild {
  private static readonly ROOT_INPUTS: readonly string[] = ["package.json", "package-lock.json", "tsconfig.base.json"];
  private static readonly TOOL_FOLDERS: readonly string[] = [fileURLToPath(new URL(".", import.meta.url)), fileURLToPath(new URL("../toolchain/", import.meta.url))];
  private static readonly MANIFEST_FILE: string = "package.json";
  private static readonly SOURCE_FOLDER: string = "src";
  private static readonly TESTS_FOLDER: string = "tests";
  private static readonly PROJECT_FILE: string = "tsconfig.json";
  private static readonly STALE: string = "stale";

  private readonly layout: BuildLayout;
  private readonly catalog: PackageCatalog;
  private readonly runner: ProcessRunner;
  private readonly environment: NodeJS.ProcessEnv;

  public constructor(root: string, runner: ProcessRunner, environment: NodeJS.ProcessEnv) {
    this.layout = new BuildLayout(root);
    this.catalog = new PackageCatalog(root);
    this.runner = runner;
    this.environment = environment;
  }

  public async buildAsync(output: Writable): Promise<readonly PackageManifest[]> {
    const packages = await this.catalog.listPackagesAsync();
    if (packages.length === 0)
      return packages;

    const rootManifest = await RootManifest.readAsync(this.layout.root);
    const version = rootManifest.productVersion;
    const builder = new PackageBuilder(this.layout, rootManifest, this.runner, new NpmCommand(this.runner, this.environment));
    const archives = packages.map(t => this.layout.locateArchive(t, version));
    const common = await this.hashCommonInputsAsync();
    const archiveHashes = new Map<string, string>();
    for (const manifest of packages) {
      const inputs = await this.hashSourceInputsAsync(manifest, packages, common, archiveHashes);
      const artifacts = this.listSourceArtifacts(manifest, version);
      const isCurrent = await PackageBuild.isCurrentAsync(this.layout.locateRecord(manifest), inputs, artifacts);
      if (!isCurrent)
        await builder.buildSourceAsync(manifest, archives);
      await (await PackageBuild.hashRecordAsync(inputs, artifacts)).writeAsync(this.layout.locateRecord(manifest));
      archiveHashes.set(manifest.name, await ContentHash.ofFileAsync(this.layout.locateArchive(manifest, version)));
      output.write(`${manifest.name}: ${isCurrent ? "reused" : "built"}\n`);
    }

    const installed = PackageBuild.hashInstalled(archiveHashes);
    for (const manifest of this.listTested(packages)) {
      const inputs = await this.hashTestInputsAsync(manifest, common, installed);
      const artifacts = [this.layout.locateTestOutput(manifest)];
      const isCurrent = await PackageBuild.isCurrentAsync(this.layout.locateTestRecord(manifest), inputs, artifacts);
      if (!isCurrent)
        await builder.compileTestsAsync(manifest);
      await (await PackageBuild.hashRecordAsync(inputs, artifacts)).writeAsync(this.layout.locateTestRecord(manifest));
      output.write(`${manifest.name} tests: ${isCurrent ? "reused" : "compiled"}\n`);
    }

    await this.requireCurrentAsync();
    return packages;
  }

  public async requireCurrentAsync(): Promise<void> {
    const packages = await this.catalog.listPackagesAsync();
    if (packages.length === 0)
      return;

    const version = (await RootManifest.readAsync(this.layout.root)).productVersion;
    const common = await this.hashCommonInputsAsync();
    const archiveHashes = new Map<string, string>();
    const stale: string[] = [];
    for (const manifest of packages) {
      const inputs = await this.hashSourceInputsAsync(manifest, packages, common, archiveHashes);
      const isCurrent = await PackageBuild.isCurrentAsync(this.layout.locateRecord(manifest), inputs, this.listSourceArtifacts(manifest, version));
      if (!isCurrent)
        stale.push(manifest.name);
      archiveHashes.set(manifest.name, isCurrent ? await ContentHash.ofFileAsync(this.layout.locateArchive(manifest, version)) : PackageBuild.STALE);
    }

    const installed = PackageBuild.hashInstalled(archiveHashes);
    for (const manifest of this.listTested(packages)) {
      const inputs = await this.hashTestInputsAsync(manifest, common, installed);
      if (!await PackageBuild.isCurrentAsync(this.layout.locateTestRecord(manifest), inputs, [this.layout.locateTestOutput(manifest)]))
        stale.push(`${manifest.name} tests`);
    }
    if (stale.length > 0)
      throw new PackageException(`The built artifacts of ${stale.join(", ")} are missing or stale; run npm run build.`);
  }

  private static collectDependencies(manifest: PackageManifest, packages: readonly PackageManifest[]): readonly string[] {
    const direct = packages.filter(t => manifest.dependencies.includes(t.name));
    return [...new Set(direct.flatMap(t => [t.name, ...PackageBuild.collectDependencies(t, packages)]))].sort();
  }

  private static hashInstalled(archiveHashes: ReadonlyMap<string, string>): string {
    return ContentHash.ofParts([...archiveHashes].map(([name, hash]) => `${name} ${hash}`));
  }

  private static async isCurrentAsync(recordFile: string, inputs: string, artifacts: readonly string[]): Promise<boolean> {
    return artifacts.every(t => existsSync(t)) && await (await PackageBuild.hashRecordAsync(inputs, artifacts)).isRecordedAsync(recordFile);
  }

  private static async hashRecordAsync(inputs: string, artifacts: readonly string[]): Promise<BuildRecord> {
    const outputs: string[] = [];
    for (const artifact of artifacts)
      outputs.push((await stat(artifact)).isDirectory() ? await ContentHash.ofTreeAsync(artifact) : await ContentHash.ofFileAsync(artifact));
    return new BuildRecord(inputs, outputs);
  }

  private listSourceArtifacts(manifest: PackageManifest, version: string): readonly string[] {
    return [this.layout.locateArchive(manifest, version), this.layout.locateInstalled(manifest)];
  }

  private listTested(packages: readonly PackageManifest[]): readonly PackageManifest[] {
    return packages.filter(t => existsSync(this.layout.locateSource(t, PackageBuild.TESTS_FOLDER, PackageBuild.PROJECT_FILE)));
  }

  private async hashCommonInputsAsync(): Promise<string> {
    const parts: string[] = [];
    for (const folder of PackageBuild.TOOL_FOLDERS)
      parts.push(await ContentHash.ofTreeAsync(folder));
    for (const file of PackageBuild.ROOT_INPUTS)
      parts.push(await ContentHash.ofFileAsync(path.join(this.layout.root, file)));
    return ContentHash.ofParts(parts);
  }

  private async hashSourceInputsAsync(
    manifest: PackageManifest,
    packages: readonly PackageManifest[],
    common: string,
    archiveHashes: ReadonlyMap<string, string>): Promise<string> {
    const dependencies = PackageBuild.collectDependencies(manifest, packages).map(t => `${t} ${archiveHashes.get(t)}`);
    return ContentHash.ofParts([
      common,
      await ContentHash.ofFileAsync(this.layout.locateSource(manifest, PackageBuild.MANIFEST_FILE)),
      await ContentHash.ofTreeAsync(this.layout.locateSource(manifest, PackageBuild.SOURCE_FOLDER)),
      ...dependencies
    ]);
  }

  private async hashTestInputsAsync(manifest: PackageManifest, common: string, installed: string): Promise<string> {
    return ContentHash.ofParts([common, await ContentHash.ofTreeAsync(this.layout.locateSource(manifest, PackageBuild.TESTS_FOLDER)), installed]);
  }
}
