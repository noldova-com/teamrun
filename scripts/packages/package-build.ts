/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { availableParallelism } from "node:os";
import path from "node:path";
import type { Writable } from "node:stream";
import { fileURLToPath } from "node:url";

import { DependencySchedule } from "../ordering/dependency-schedule.ts";
import { SerialQueue } from "../ordering/serial-queue.ts";
import type { ProcessRunner } from "../processes/process-runner.ts";
import { ProcessException } from "../processes/process.exception.ts";
import { Git } from "../repository/git.ts";
import { NpmCommand } from "../toolchain/npm-command.ts";
import { ArchiveReader } from "./archive.reader.ts";
import { BuildLayout } from "./build-layout.ts";
import { BuildRecord } from "./build-record.ts";
import { ContentHash } from "./content-hash.ts";
import { ImportClosure } from "./import-closure.ts";
import { PackageBuilder } from "./package-builder.ts";
import { PackageCatalog } from "./package-catalog.ts";
import type { PackageManifest } from "./package-manifest.ts";
import { PackageVersions } from "./package-versions.ts";
import { PackageException } from "./package.exception.ts";
import { RootManifest } from "./root-manifest.ts";

export class PackageBuild {
  private static readonly ROOT_INPUTS: readonly string[] = ["package.json", "package-lock.json", "tsconfig-base.json"];
  private static readonly ANGULAR_FOLDER: string = "src";
  private static readonly ANGULAR_INPUTS: readonly string[] = ["package.json", "tsconfig.json"];
  private static readonly DEPENDENCY_FOLDER: string = "node_modules";
  private static readonly TOOL_FOLDERS: readonly string[] = [fileURLToPath(new URL(".", import.meta.url)), fileURLToPath(new URL("../toolchain/", import.meta.url))];
  private static readonly TESTS_FOLDER: string = "tests";
  private static readonly SCRIPTS_FOLDER: string = "scripts";
  private static readonly BUILD_SCRIPT: string = "build.ts";
  private static readonly PROJECT_FILE: string = "tsconfig.json";
  private static readonly STALE: string = "stale";
  private static readonly GIT_FOLDER: string = ".git";
  private static readonly COMMIT_ARGUMENTS: readonly string[] = ["rev-parse", "--verify", "--quiet", "HEAD"];
  private static readonly COMMIT_EXIT_CODES: readonly number[] = [0, 1];
  private static readonly STATUS_ARGUMENTS: readonly string[] = ["status", "--porcelain"];
  private static readonly PARALLEL_LIMIT: number = availableParallelism();

  private readonly layout: BuildLayout;
  private readonly catalog: PackageCatalog;
  private readonly closure: ImportClosure;
  private readonly runner: ProcessRunner;
  private readonly environment: NodeJS.ProcessEnv;

  public constructor(root: string, runner: ProcessRunner, environment: NodeJS.ProcessEnv) {
    this.layout = new BuildLayout(root);
    this.catalog = new PackageCatalog(root);
    this.closure = new ImportClosure(root);
    this.runner = runner;
    this.environment = environment;
  }

  public async buildAsync(output: Writable): Promise<readonly PackageManifest[]> {
    const packages = await this.catalog.listPackagesAsync();
    if (packages.length === 0)
      return packages;

    const versions = await this.readVersionsAsync();
    const archives = packages.map(t => this.layout.locateArchive(t, versions.version));
    const common = await this.hashCommonInputsAsync();
    const builder = this.createBuilder(versions);
    const archiveHashes = new Map<string, string>();
    const uninstalled: (readonly [PackageManifest, string, readonly string[]])[] = [];
    const steps = new SerialQueue();
    const dependenciesOf = (manifest: PackageManifest): readonly string[] => PackageBuild.collectDependencies(manifest, packages);
    await new DependencySchedule(packages, t => t.name, dependenciesOf, PackageBuild.PARALLEL_LIMIT).runAsync(async manifest => {
      const inputs = await this.hashSourceInputsAsync(builder, manifest, packages, common, archiveHashes, versions);
      const artifacts = this.listSourceArtifacts(manifest, packages, versions);
      const isCurrent = await steps.runAsync(async () => {
        if (await PackageBuild.isCurrentAsync(this.layout.locateRecord(manifest), inputs, artifacts)) {
          await (await PackageBuild.hashRecordAsync(inputs, artifacts)).writeAsync(this.layout.locateRecord(manifest));
          return true;
        }
        if (uninstalled.some(([built]) => dependenciesOf(manifest).includes(built.name)))
          await this.installBuiltAsync(builder, archives, uninstalled);
        return false;
      });
      if (!isCurrent) {
        await builder.compileSourceAsync(manifest);
        await steps.runAsync(async () => {
          await builder.packSourceAsync(manifest);
          uninstalled.push([manifest, inputs, artifacts]);
        });
      }
      archiveHashes.set(manifest.name, await ContentHash.ofFileAsync(this.layout.locateArchive(manifest, versions.version)));
      output.write(`${manifest.name}: ${isCurrent ? "reused" : "built"}\n`);
    }, t => new PackageException(`The dependencies of ${t.join(", ")} form a cycle.`));
    await this.installBuiltAsync(builder, archives, uninstalled);

    await this.hashCurrentAsync(packages, versions, common, builder);
    return packages;
  }

  public async listCopiesAsync(): Promise<readonly (readonly [string, string, string])[]> {
    const packages = await this.catalog.listPackagesAsync();
    if (packages.length === 0)
      return [];
    const builder = this.createBuilder(await this.readVersionsAsync());
    const copies: (readonly [string, string, string])[] = [];
    for (const manifest of packages)
      for (const [source, entry] of await builder.listCopiesAsync(manifest))
        copies.push([path.relative(this.layout.root, source).split(path.sep).join(path.posix.sep), manifest.name, entry]);
    return copies;
  }

  public async readArchivesAsync(): Promise<ReadonlyMap<string, ReadonlyMap<string, Buffer>>> {
    const packages = await this.catalog.listPackagesAsync();
    const versions = await this.readVersionsAsync();
    const reader = new ArchiveReader();
    const archives = new Map<string, ReadonlyMap<string, Buffer>>();
    for (const manifest of packages)
      archives.set(manifest.name, await reader.readAsync(this.layout.locateArchive(manifest, versions.version)));
    return archives;
  }

  public async compileTestsReportedAsync(output: Writable): Promise<boolean> {
    try {
      await this.compileTestsAsync(output);
      return true;
    }
    catch (error) {
      if (!(error instanceof PackageException || error instanceof ProcessException))
        throw error;
      output.write(`${error.message}\n`);
      return false;
    }
  }

  public async requireCurrentAsync(): Promise<void> {
    const packages = await this.catalog.listPackagesAsync();
    if (packages.length === 0)
      return;

    const versions = await this.readVersionsAsync();
    await this.hashCurrentAsync(packages, versions, await this.hashCommonInputsAsync(), this.createBuilder(versions));
  }

  public async compileTestsAsync(output: Writable): Promise<void> {
    const packages = await this.catalog.listPackagesAsync();
    if (packages.length === 0)
      return;

    const versions = await this.readVersionsAsync();
    const common = await this.hashCommonInputsAsync();
    const builder = this.createBuilder(versions);
    const installed = await this.hashCurrentAsync(packages, versions, common, builder);
    for (const manifest of this.listTested(packages)) {
      const inputs = await this.hashTestInputsAsync(manifest, common, installed);
      const artifacts = [this.layout.locateTestOutput(manifest)];
      const isCurrent = await PackageBuild.isCurrentAsync(this.layout.locateTestRecord(manifest), inputs, artifacts);
      if (!isCurrent)
        await builder.compileTestsAsync(manifest);
      await (await PackageBuild.hashRecordAsync(inputs, artifacts)).writeAsync(this.layout.locateTestRecord(manifest));
      output.write(`${manifest.name} tests: ${isCurrent ? "reused" : "compiled"}\n`);
    }
  }

  private static collectDependencies(manifest: PackageManifest, packages: readonly PackageManifest[]): readonly string[] {
    const direct = packages.filter(t => manifest.dependencies.includes(t.name));
    return [...new Set(direct.flatMap(t => [t.name, ...PackageBuild.collectDependencies(t, packages)]))].sort();
  }

  private static hashInstalled(packages: readonly PackageManifest[], archiveHashes: ReadonlyMap<string, string>): string {
    return ContentHash.ofParts(packages.map(t => `${t.name} ${archiveHashes.get(t.name)}`));
  }

  private static async isCurrentAsync(recordFile: string, inputs: string, artifacts: readonly string[]): Promise<boolean> {
    return artifacts.every(t => existsSync(t)) && await (await PackageBuild.hashRecordAsync(inputs, artifacts)).isRecordedAsync(recordFile);
  }

  private static async hashRecordAsync(inputs: string, artifacts: readonly string[]): Promise<BuildRecord> {
    const outputs: string[] = [];
    for (const artifact of artifacts)
      outputs.push(await PackageBuild.hashPathAsync(artifact));
    return new BuildRecord(inputs, outputs);
  }

  private static async hashPathAsync(item: string): Promise<string> {
    return (await stat(item)).isDirectory() ? await ContentHash.ofTreeAsync(item) : await ContentHash.ofFileAsync(item);
  }

  private async hashCurrentAsync(packages: readonly PackageManifest[], versions: PackageVersions, common: string, builder: PackageBuilder): Promise<string> {
    const archiveHashes = new Map<string, string>();
    const stale: string[] = [];
    for (const manifest of packages) {
      const inputs = await this.hashSourceInputsAsync(builder, manifest, packages, common, archiveHashes, versions);
      const isCurrent = await PackageBuild.isCurrentAsync(this.layout.locateRecord(manifest), inputs, this.listSourceArtifacts(manifest, packages, versions));
      if (!isCurrent)
        stale.push(manifest.name);
      archiveHashes.set(manifest.name, isCurrent ? await ContentHash.ofFileAsync(this.layout.locateArchive(manifest, versions.version)) : PackageBuild.STALE);
    }
    if (stale.length > 0)
      throw new PackageException(`The built artifacts of ${stale.join(", ")} are missing or stale; run npm run build.`);
    return PackageBuild.hashInstalled(packages, archiveHashes);
  }

  private async readVersionsAsync(): Promise<PackageVersions> {
    const manifest = await RootManifest.readAsync(this.layout.root);
    return new PackageVersions(manifest.productVersion, manifest.protocolVersion, await this.readCommitAsync());
  }

  private async readCommitAsync(): Promise<string | null> {
    if (!existsSync(path.join(this.layout.root, PackageBuild.GIT_FOLDER)))
      return null;
    const git = new Git(this.layout.root, this.runner);
    if ((await git.readOutputAsync(PackageBuild.STATUS_ARGUMENTS)).length > 0)
      return null;
    const commit = (await git.readOutputAsync(PackageBuild.COMMIT_ARGUMENTS, PackageBuild.COMMIT_EXIT_CODES)).trim();
    return commit.length > 0 ? commit : null;
  }

  private async installBuiltAsync(builder: PackageBuilder, archives: readonly string[], uninstalled: (readonly [PackageManifest, string, readonly string[]])[]): Promise<void> {
    if (uninstalled.length === 0)
      return;
    await builder.installAsync(uninstalled.map(([manifest]) => manifest.name).join(", "), this.layout.root, archives);
    for (const [manifest, inputs, artifacts] of uninstalled.splice(0))
      await (await PackageBuild.hashRecordAsync(inputs, artifacts)).writeAsync(this.layout.locateRecord(manifest));
  }

  private createBuilder(versions: PackageVersions): PackageBuilder {
    return new PackageBuilder(this.layout, versions, this.runner, new NpmCommand(this.runner, this.environment));
  }

  private listSourceArtifacts(manifest: PackageManifest, packages: readonly PackageManifest[], versions: PackageVersions): readonly string[] {
    const artifacts = [this.layout.locateArchive(manifest, versions.version), this.layout.locateInstalled(manifest)];
    if (!manifest.isAngular)
      return artifacts;
    return [...artifacts, ...PackageBuild.collectDependencies(manifest, packages)
      .map(t => path.join(this.layout.root, PackageBuild.DEPENDENCY_FOLDER, ...t.split("/")))];
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

  private async hashAngularInputsAsync(): Promise<string> {
    const parts: string[] = [];
    for (const file of PackageBuild.ANGULAR_INPUTS)
      parts.push(await ContentHash.ofFileAsync(path.join(this.layout.root, PackageBuild.ANGULAR_FOLDER, file)));
    return ContentHash.ofParts(parts);
  }

  private async hashPackageSourceAsync(builder: PackageBuilder, manifest: PackageManifest): Promise<string> {
    const parts: string[] = [];
    for (const input of await builder.listInputsAsync(manifest))
      parts.push(path.relative(this.layout.root, input).split(path.sep).join(path.posix.sep), await PackageBuild.hashPathAsync(input));
    const script = this.layout.locateSource(manifest, PackageBuild.SCRIPTS_FOLDER, PackageBuild.BUILD_SCRIPT);
    if (existsSync(script))
      parts.push(await this.closure.hashAsync(script));
    return ContentHash.ofParts(parts);
  }

  private async hashSourceInputsAsync(
    builder: PackageBuilder,
    manifest: PackageManifest,
    packages: readonly PackageManifest[],
    common: string,
    archiveHashes: ReadonlyMap<string, string>,
    versions: PackageVersions): Promise<string> {
    const dependencies = PackageBuild.collectDependencies(manifest, packages).map(t => `${t} ${archiveHashes.get(t)}`);
    const workspace = manifest.isAngular ? [await this.hashAngularInputsAsync()] : [];
    return ContentHash.ofParts([common, versions.version, versions.commit ?? "", versions.protocolVersion, await this.hashPackageSourceAsync(builder, manifest), ...workspace, ...dependencies]);
  }

  private async hashTestInputsAsync(manifest: PackageManifest, common: string, installed: string): Promise<string> {
    return ContentHash.ofParts([common, await ContentHash.ofTreeAsync(this.layout.locateSource(manifest, PackageBuild.TESTS_FOLDER)), installed]);
  }
}
