/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import type { ICodeDigest } from "./interfaces/i-code-digest.ts";
import type { ISpecTransform } from "./interfaces/i-spec-transform.ts";
import type { ISpecTransformPlugin } from "./interfaces/i-spec-transform-plugin.ts";
import type { IVitestLogger } from "./interfaces/i-vitest-logger.ts";

export class SpecTransformCheck {
  private static readonly NAME: string = "noldova-spec-transform-check";
  private static readonly SPEC: RegExp = /\.spec\.ts$/u;
  private static readonly QUERY: string = "?";
  private static readonly IMPORT: RegExp = /(?:\bfrom|\bimport)\s*["'](\.{1,2}\/[^"'\n]*)["']/gu;
  private static readonly DIGEST: string = "sha256";
  private static readonly DIGEST_ENCODING: "hex" = "hex";
  private static readonly TEXT_ENCODING: BufferEncoding = "utf8";
  private static readonly RECORD: string = "record.json";
  private static readonly SERVED: string = ".served.js";
  private static readonly TRANSFORMED: string = ".transformed.js";
  private static readonly INDENT: number = 2;

  private readonly folder: string;
  private readonly servedCode: Map<string, string> = new Map();
  private readonly transforms: Map<string, ISpecTransform> = new Map();
  private logger: IVitestLogger | null = null;

  public readonly served: ISpecTransformPlugin = {
    name: `${SpecTransformCheck.NAME}-served`,
    enforce: "pre",
    transform: (code, id) => this.serve(code, id)
  };
  public readonly transformed: ISpecTransformPlugin = {
    name: `${SpecTransformCheck.NAME}-transformed`,
    enforce: "post",
    transform: (code, id) => this.compareAsync(code, id),
    configureVitest: context => {
      this.logger = context.vitest.logger;
      context.vitest.onClose(() => this.closeAsync());
    }
  };

  public constructor(folder: string) {
    this.folder = folder;
  }

  public get plugins(): readonly ISpecTransformPlugin[] {
    return [this.served, this.transformed];
  }

  private serve(code: string, id: string): null {
    if (SpecTransformCheck.SPEC.test(SpecTransformCheck.fileOf(id)))
      this.servedCode.set(id, code);
    return null;
  }

  private async compareAsync(code: string, id: string): Promise<null> {
    const served = this.servedCode.get(id);
    if (Object.isUndefined(served))
      return null;
    this.servedCode.delete(id);
    const file = SpecTransformCheck.fileOf(id);
    const transform: ISpecTransform = { file, served: SpecTransformCheck.digest(served), transformed: SpecTransformCheck.digest(code) };
    this.transforms.set(file, transform);
    const before = new Set(SpecTransformCheck.importsOf(served));
    const changed = SpecTransformCheck.importsOf(code).filter(t => !before.has(t));
    if (changed.length === 0)
      return null;
    const kept = await this.keepAsync(file, served, code);
    throw new Error(`Vite's transforms changed the imports of ${file}: after them it imports ${changed.map(t => JSON.stringify(t)).join(", ")}, which the code Angular's builder served doesn't. `
      + `The served code's SHA-256 is ${transform.served.sha256} (${transform.served.size} bytes), and the transformed code's is ${transform.transformed.sha256} `
      + `(${transform.transformed.size} bytes)${kept ? `; both are in ${this.folder}` : ""}.`);
  }

  private async keepAsync(file: string, served: string, transformed: string): Promise<boolean> {
    try {
      await mkdir(this.folder, { recursive: true });
      await writeFile(path.join(this.folder, `${path.basename(file)}${SpecTransformCheck.SERVED}`), served);
      await writeFile(path.join(this.folder, `${path.basename(file)}${SpecTransformCheck.TRANSFORMED}`), transformed);
      return true;
    }
    catch (error) {
      this.logger?.log(`The spec transform check couldn't keep the two codes of ${file} in ${this.folder}: ${SpecTransformCheck.describe(error)}`);
      return false;
    }
  }

  private async closeAsync(): Promise<void> {
    const transforms = [...this.transforms.values()].sort((a, b) => a.file.localeCompare(b.file));
    try {
      await mkdir(this.folder, { recursive: true });
      await writeFile(path.join(this.folder, SpecTransformCheck.RECORD), `${JSON.stringify(transforms, null, SpecTransformCheck.INDENT)}\n`);
    }
    catch (error) {
      this.logger?.log(`The spec transform check couldn't keep its record in ${this.folder}: ${SpecTransformCheck.describe(error)}`);
    }
    this.logger?.log(`The spec transform check compared the imports of ${transforms.length} spec files before and after Vite's transforms.`);
  }

  private static fileOf(id: string): string {
    return id.split(SpecTransformCheck.QUERY)[0] ?? id;
  }

  private static importsOf(code: string): readonly string[] {
    return [...code.matchAll(SpecTransformCheck.IMPORT)].map(t => t[1] ?? "");
  }

  private static digest(code: string): ICodeDigest {
    const bytes = Buffer.from(code, SpecTransformCheck.TEXT_ENCODING);
    return { size: bytes.length, sha256: createHash(SpecTransformCheck.DIGEST).update(bytes).digest(SpecTransformCheck.DIGEST_ENCODING) };
  }

  private static describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
