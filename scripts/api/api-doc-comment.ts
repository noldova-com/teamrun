/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ApiException from "./api.exception.ts";

export default class ApiDocComment {
  private static readonly LINE_PREFIX: RegExp = /^\s*\/?\*+\/?\s?/;
  private static readonly CLOSING: RegExp = /\s*\*\/\s*$/;
  private static readonly TAG: RegExp = /^@(\w+)/;
  private static readonly EXAMPLE_TAG: string = "example";
  private static readonly FENCE_OPEN: string = "```ts";
  private static readonly FENCE_CLOSE: string = "```";

  private readonly lines: readonly string[];

  public constructor(text: string) {
    this.lines = text.trim().replace(ApiDocComment.CLOSING, "").split(/\r?\n/).map(t => t.replace(ApiDocComment.LINE_PREFIX, ""));
  }

  public readExamples(owner: string): readonly string[] {
    const examples: string[] = [];
    let next = 0;
    for (const [index, line] of this.lines.entries()) {
      if (index < next || ApiDocComment.TAG.exec(line)?.[1] !== ApiDocComment.EXAMPLE_TAG)
        continue;
      if (this.lines[index + 1]?.trim() !== ApiDocComment.FENCE_OPEN)
        throw new ApiException(`An @example of ${owner} must start with a ${ApiDocComment.FENCE_OPEN} code block on its next line.`);
      const end = this.lines.findIndex((t, position) => position > index + 1 && t.trim() === ApiDocComment.FENCE_CLOSE);
      if (end < 0)
        throw new ApiException(`An @example of ${owner} has no closing ${ApiDocComment.FENCE_CLOSE}.`);
      examples.push(`${this.lines.slice(index + 2, end).join("\n")}\n`);
      next = end + 1;
    }
    return examples;
  }
}
