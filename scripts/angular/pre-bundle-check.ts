/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import type { IParseDiagnostic } from "./interfaces/i-parse-diagnostic.ts";
import type { IPreBundleFile } from "./interfaces/i-pre-bundle-file.ts";
import type { IVitestLogger } from "./interfaces/i-vitest-logger.ts";
import type { IVitestPluginContext } from "./interfaces/i-vitest-plugin-context.ts";

export class PreBundleCheck {
  private static readonly NAME: string = "noldova-pre-bundle-check";
  private static readonly FOLDER: string = "deps";
  private static readonly SCRIPT: RegExp = /\.js$/u;
  private static readonly QUERY: string = "?";
  private static readonly VERSION: string = "v";
  private static readonly DIGEST: string = "sha256";
  private static readonly DIGEST_ENCODING: "hex" = "hex";
  private static readonly TEXT_ENCODING: BufferEncoding = "utf8";
  private static readonly INDENT: number = 2;
  private static readonly ERROR: string = "Error";

  private readonly parse: (file: string, code: string) => readonly IParseDiagnostic[];
  private readonly record: string;
  private readonly checks: Map<string, Promise<void>> = new Map();
  private readonly folders: Set<string> = new Set();
  private logger: IVitestLogger | null = null;

  public readonly name: string = PreBundleCheck.NAME;
  public readonly enforce: "pre" = "pre";
  public readonly configResolved: (config: { readonly cacheDir: string }) => void = config => {
    this.folders.add(path.resolve(config.cacheDir, PreBundleCheck.FOLDER));
  };
  public readonly configureVitest: (context: IVitestPluginContext) => void = context => {
    this.logger = context.vitest.logger;
  };
  public readonly transform: (code: string, id: string) => Promise<null> = async (_code, id) => {
    await this.checkAsync(id);
    return null;
  };

  public constructor(parse: (file: string, code: string) => readonly IParseDiagnostic[], record: string) {
    this.parse = parse;
    this.record = record;
  }

  private checkAsync(id: string): Promise<void> {
    const [file = id, query = ""] = id.split(PreBundleCheck.QUERY);
    const folder = [...this.folders].find(t => path.relative(t, path.dirname(path.resolve(file))) === "");
    if (Object.isUndefined(folder))
      return Promise.resolve();
    const key = `${folder}${PreBundleCheck.QUERY}${new URLSearchParams(query).get(PreBundleCheck.VERSION) ?? ""}`;
    const check = this.checks.get(key) ?? this.checkFolderAsync(folder);
    this.checks.set(key, check);
    return check;
  }

  private async checkFolderAsync(folder: string): Promise<void> {
    let files: readonly { readonly name: string; readonly bytes: Buffer }[];
    try {
      const entries = await readdir(folder, { withFileTypes: true });
      files = await Promise.all(entries.filter(t => t.isFile()).map(t => t.name).sort().map(async t => ({ name: t, bytes: await readFile(path.join(folder, t)) })));
    }
    catch (error) {
      this.logger?.log(`The pre-bundle check couldn't read ${folder}, so it lets its requests through: ${PreBundleCheck.describe(error)}`);
      return;
    }
    const recorded: IPreBundleFile[] = files.map(t => ({ file: t.name, size: t.bytes.length, sha256: createHash(PreBundleCheck.DIGEST).update(t.bytes).digest(PreBundleCheck.DIGEST_ENCODING) }));
    try {
      await mkdir(path.dirname(this.record), { recursive: true });
      await writeFile(this.record, `${JSON.stringify({ folder, files: recorded }, null, PreBundleCheck.INDENT)}\n`);
    }
    catch (error) {
      this.logger?.log(`The pre-bundle check couldn't keep its record ${this.record}: ${PreBundleCheck.describe(error)}`);
    }
    const scripts = files.filter(t => PreBundleCheck.SCRIPT.test(t.name));
    for (const file of scripts) {
      const error = this.parse(file.name, file.bytes.toString(PreBundleCheck.TEXT_ENCODING)).find(t => t.severity === PreBundleCheck.ERROR);
      if (!Object.isUndefined(error))
        throw new Error(`Vite's pre-bundled ${path.join(folder, file.name)} doesn't parse: ${error.message}. Each pre-bundled file's size and SHA-256, as the browser's first request for one found them, are in ${this.record}.`);
    }
    this.logger?.log(`The pre-bundle check read ${files.length} files in ${folder}, and its ${scripts.length} scripts parse.`);
  }

  private static describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
