/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { copyFile, cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Writable } from "node:stream";

import { PackageBuilder } from "../packages/package-builder.ts";
import { PackageException } from "../packages/package.exception.ts";
import type { ProcessRunner } from "../processes/process-runner.ts";
import { ProcessTimeoutException } from "../processes/process-timeout.exception.ts";
import { ProcessException } from "../processes/process.exception.ts";
import { JsonFields } from "../totals/json-fields.ts";
import { TotalsException } from "../totals/totals.exception.ts";

export class AngularPackageBuilder {
  private static readonly USAGE: string = "Usage: node <package>/scripts/build.ts <output folder>, or --inputs to list what the build copies from outside the package, run from the repository's root\n";
  private static readonly USAGE_EXIT_CODE: number = 2;
  private static readonly PROJECT_FOLDER: string = "src";
  private static readonly PROJECT_FILE: string = "tsconfig.json";
  private static readonly SOURCE_FOLDER: string = "src";
  private static readonly ENTRY_FOLDER: string = "api";
  private static readonly STYLES_FOLDER: string = "styles";
  private static readonly SCRIPT_EXTENSION: string = ".ts";
  private static readonly DECLARATIONS: string = ".d.ts";
  private static readonly STYLE_EXTENSION: string = ".css";
  private static readonly COMPILER_MANIFEST: readonly string[] = ["node_modules", "@angular", "compiler-cli", "package.json"];
  private static readonly COMMANDS_FIELD: string = "bin";
  private static readonly COMPILER_COMMAND: string = "ngc";
  private static readonly PROJECT_OPTION: string = "-p";
  private static readonly WORK_PREFIX: string = "noldova-angular-package-";
  private static readonly ENCODING: BufferEncoding = "utf8";
  private static readonly URL: RegExp = /url\(\s*(["']?)([^"')]+)\1\s*\)/g;
  private static readonly NOT_A_PATH: RegExp = /^(?:[a-z][a-z0-9+.-]*:|#|\/)/i;

  private readonly root: string;
  private readonly directory: string;
  private readonly runner: ProcessRunner;
  private readonly output: Writable;
  private readonly listing: Writable;
  private readonly shipped: readonly string[];
  private readonly compileTimeout: number;

  public constructor(
    root: string,
    directory: string,
    runner: ProcessRunner,
    output: Writable,
    listing: Writable,
    shipped: readonly string[] = [],
    compileTimeout: number = PackageBuilder.COMPILE_TIMEOUT) {
    this.root = root;
    this.directory = directory;
    this.runner = runner;
    this.output = output;
    this.listing = listing;
    this.shipped = shipped.map(t => path.join(root, ...t.split(path.posix.sep)));
    this.compileTimeout = compileTimeout;
  }

  public async runAsync(buildArguments: readonly string[]): Promise<number> {
    const [folder, ...others] = buildArguments;
    if (folder === undefined || others.length > 0) {
      this.output.write(AngularPackageBuilder.USAGE);
      return AngularPackageBuilder.USAGE_EXIT_CODE;
    }

    try {
      if (folder === PackageBuilder.INPUTS_OPTION)
        this.listing.write((await this.listInputsAsync()).map(t => `${this.describe(t)}\n`).join(""));
      else
        await this.buildAsync(path.resolve(folder));
      return 0;
    }
    catch (error) {
      if (!(error instanceof PackageException || error instanceof ProcessException || error instanceof TotalsException))
        throw error;
      this.output.write(`${error.message}\n`);
      return 1;
    }
  }

  public async buildAsync(output: string): Promise<void> {
    await this.compileAsync(output);
    await this.copyDeclarationsAsync(output);
    const copied = new Map<string, string>();
    await this.copyStylesAsync(output, copied);
    await this.copyShippedAsync(output, copied);
  }

  private async compileAsync(output: string): Promise<void> {
    const project = path.join(this.root, AngularPackageBuilder.PROJECT_FOLDER);
    const source = path.join(this.directory, AngularPackageBuilder.SOURCE_FOLDER);
    const entries = path.join(source, AngularPackageBuilder.ENTRY_FOLDER);
    const files = existsSync(entries)
      ? (await readdir(entries)).filter(t => t.endsWith(AngularPackageBuilder.SCRIPT_EXTENSION) && !t.endsWith(AngularPackageBuilder.DECLARATIONS)).sort().map(t => path.join(entries, t))
      : [];
    if (files.length === 0)
      throw new PackageException(`${this.describe(entries)} has no entry files to compile.`);

    const work = await mkdtemp(path.join(os.tmpdir(), AngularPackageBuilder.WORK_PREFIX));
    try {
      const configuration = path.join(work, AngularPackageBuilder.PROJECT_FILE);
      await writeFile(configuration, `${JSON.stringify({
        extends: path.join(project, AngularPackageBuilder.PROJECT_FILE),
        compilerOptions: { rootDir: source, outDir: output, declaration: false, sourceMap: true, types: [] },
        angularCompilerOptions: { compilationMode: "partial" },
        files
      }, null, 2)}\n`, AngularPackageBuilder.ENCODING);
      const compiler = await this.locateCompilerAsync();
      const result = await this.runner.captureAsync(process.execPath, [compiler, AngularPackageBuilder.PROJECT_OPTION, configuration], project, this.compileTimeout)
        .catch((error: unknown) => {
          if (error instanceof ProcessTimeoutException)
            throw new PackageException(`Compiling ${this.describe(source)} with the Angular compiler did not finish within ${this.compileTimeout} ms.`, { cause: error });
          throw error;
        });
      if (!result.isSuccessful)
        throw new PackageException(`Compiling ${this.describe(source)} with the Angular compiler failed with exit code ${result.exitCode}:\n${result.text}`);
    }
    finally {
      await rm(work, { recursive: true, force: true });
    }
  }

  private async copyDeclarationsAsync(output: string): Promise<void> {
    const entries = path.join(this.directory, AngularPackageBuilder.SOURCE_FOLDER, AngularPackageBuilder.ENTRY_FOLDER);
    const declarations = (await readdir(entries)).filter(t => t.endsWith(AngularPackageBuilder.DECLARATIONS)).sort();
    if (declarations.length === 0)
      throw new PackageException(`${this.describe(entries)} has no declarations to ship.`);
    await mkdir(path.join(output, AngularPackageBuilder.ENTRY_FOLDER), { recursive: true });
    for (const file of declarations)
      await copyFile(path.join(entries, file), path.join(output, AngularPackageBuilder.ENTRY_FOLDER, file));
  }

  private async locateCompilerAsync(): Promise<string> {
    const manifest = path.join(this.root, ...AngularPackageBuilder.COMPILER_MANIFEST);
    if (!existsSync(manifest))
      throw new ProcessException(`The Angular project in ${AngularPackageBuilder.PROJECT_FOLDER}/ has no Angular compiler to run; npm ci in the root installs one.`);
    const command = JsonFields.parse(await readFile(manifest, AngularPackageBuilder.ENCODING), this.describe(manifest))
      .object(AngularPackageBuilder.COMMANDS_FIELD)
      .text(AngularPackageBuilder.COMPILER_COMMAND);
    return path.join(path.dirname(manifest), command);
  }

  private async listInputsAsync(): Promise<readonly string[]> {
    const folders = new Set<string>(this.shipped);
    for (const file of (await this.listStyleFilesAsync()).filter(t => t.endsWith(AngularPackageBuilder.STYLE_EXTENSION)))
      for (const referenced of this.locateOutside(file, await readFile(file, AngularPackageBuilder.ENCODING)).values())
        if (existsSync(referenced))
          folders.add(path.dirname(referenced));
    return [...folders].sort();
  }

  private async copyStylesAsync(output: string, copied: Map<string, string>): Promise<void> {
    for (const file of await this.listStyleFilesAsync()) {
      const target = path.join(output, AngularPackageBuilder.STYLES_FOLDER, path.relative(this.stylesFolder, file));
      await mkdir(path.dirname(target), { recursive: true });
      if (!file.endsWith(AngularPackageBuilder.STYLE_EXTENSION)) {
        await copyFile(file, target);
        continue;
      }

      const text = await readFile(file, AngularPackageBuilder.ENCODING);
      const rewritten = new Map<string, string>();
      for (const [reference, referenced] of this.locateOutside(file, text)) {
        if (!existsSync(referenced))
          throw new PackageException(`${this.describe(file)} refers to ${reference}, which does not exist.`);
        const folder = path.dirname(referenced);
        const copy = await this.copyFolderAsync(folder, output, copied, `${this.describe(file)} refers to`);
        rewritten.set(reference, path.relative(path.dirname(target), path.join(copy, path.basename(referenced))).split(path.sep).join(path.posix.sep));
      }
      await writeFile(target, text.replace(AngularPackageBuilder.URL, (whole, quote: string, reference: string) => {
        const replacement = rewritten.get(reference);
        return replacement === undefined ? whole : `url(${quote}${replacement}${quote})`;
      }), AngularPackageBuilder.ENCODING);
    }
  }

  private async copyShippedAsync(output: string, copied: Map<string, string>): Promise<void> {
    for (const folder of this.shipped) {
      if (!existsSync(folder))
        throw new PackageException(`The package ships ${this.describe(folder)}, which does not exist.`);
      await this.copyFolderAsync(folder, output, copied, "The package ships");
    }
  }

  private async copyFolderAsync(folder: string, output: string, copied: Map<string, string>, subject: string): Promise<string> {
    const copy = path.join(output, path.basename(folder));
    const earlier = copied.get(copy);
    if (earlier !== undefined && earlier !== folder)
      throw new PackageException(`${subject} ${this.describe(folder)}, and the package already takes ${this.describe(earlier)} as ${path.basename(folder)}/.`);
    if (earlier === undefined) {
      await cp(folder, copy, { recursive: true });
      copied.set(copy, folder);
    }
    return copy;
  }

  private get stylesFolder(): string {
    return path.join(this.directory, AngularPackageBuilder.SOURCE_FOLDER, AngularPackageBuilder.STYLES_FOLDER);
  }

  private async listStyleFilesAsync(): Promise<readonly string[]> {
    const styles = this.stylesFolder;
    if (!existsSync(styles))
      return [];

    const files: string[] = [];
    for (const entry of (await readdir(styles, { recursive: true })).sort()) {
      const file = path.join(styles, entry);
      if ((await stat(file)).isFile())
        files.push(file);
    }
    return files;
  }

  private locateOutside(file: string, text: string): ReadonlyMap<string, string> {
    const references = new Map<string, string>();
    for (const match of text.matchAll(AngularPackageBuilder.URL)) {
      const reference = String(match[2]);
      if (AngularPackageBuilder.NOT_A_PATH.test(reference))
        continue;
      const referenced = path.resolve(path.dirname(file), reference);
      if (path.relative(this.stylesFolder, referenced).startsWith(".."))
        references.set(reference, referenced);
    }
    return references;
  }

  private describe(file: string): string {
    return path.relative(this.root, file).split(path.sep).join(path.posix.sep);
  }
}
