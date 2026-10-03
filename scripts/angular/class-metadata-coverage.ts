/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type IVitestPlugin from "./interfaces/vitest-plugin.ts";
import type IVitestPluginContext from "./interfaces/vitest-plugin-context.ts";
import MarkedModule from "./marked-module.ts";

export default class ClassMetadataCoverage implements IVitestPlugin {
  private static readonly NAME: string = "teamrun-class-metadata-coverage";
  private static readonly LINE_BREAK: string = "\n";
  private static readonly OPENING: string = "(() => {";
  private static readonly CLOSING: string = "})();";
  private static readonly CALL: RegExp = /^[\t ]+\(typeof ngDevMode === "undefined" \|\| ngDevMode\) && i\d+\.(?:ɵ|\\u0275)setClassMetadata\(([A-Za-z_$][\w$]*), /u;
  private static readonly HINT: string = " /* v8 ignore next */";

  private readonly ignored: Map<string, readonly string[]> = new Map();

  public readonly name: string = ClassMetadataCoverage.NAME;
  public readonly enforce: "post" = "post";
  public readonly transform: (code: string, id: string) => MarkedModule | null = (code, id) => this.mark(code, id);
  public readonly configureVitest: (context: IVitestPluginContext) => void = context => context.vitest.onClose(() => context.vitest.logger.log(this.summary));

  public get summary(): string {
    const calls = [...this.ignored.values()].flat();
    return `Coverage ignores ${calls.length} compiler-generated class-metadata calls for ${new Set(calls).size} classes, which run only in development mode.`;
  }

  private mark(code: string, id: string): MarkedModule | null {
    const lines = code.split(ClassMetadataCoverage.LINE_BREAK);
    const classes: string[] = [];
    for (let index = 1; index < lines.length; index++) {
      const name = this.classAt(lines, index);
      if (name === null)
        continue;
      lines[index - 1] += ClassMetadataCoverage.HINT;
      classes.push(name);
    }
    if (classes.length === 0) {
      this.ignored.delete(id);
      return null;
    }
    this.ignored.set(id, classes);
    return new MarkedModule(lines.join(ClassMetadataCoverage.LINE_BREAK));
  }

  private classAt(lines: readonly string[], index: number): string | null {
    if (lines[index] !== ClassMetadataCoverage.OPENING)
      return null;
    const name = ClassMetadataCoverage.CALL.exec(lines[index + 1] ?? "")?.[1];
    if (name === undefined || !lines.slice(index + 2).includes(ClassMetadataCoverage.CLOSING))
      return null;
    return name;
  }
}
