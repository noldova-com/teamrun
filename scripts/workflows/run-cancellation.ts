/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type IPullRequestComment from "./interfaces/pull-request-comment.ts";

export default class RunCancellation implements IPullRequestComment {
  public static readonly KIND: string = "cancelled";

  private static readonly FILE_LIMIT: number = 20;
  private static readonly NAME_LIMIT: number = 200;
  private static readonly SHORTENED: string = "…";
  private static readonly FENCE: string = "`";
  private static readonly SHORTEST_FENCE: number = 3;
  private static readonly BACKTICKS: RegExp = /`+/gu;
  private static readonly CONTROL: RegExp = /[\u0000-\u001f\u007f]/gu;

  public readonly kind: string = RunCancellation.KIND;
  public readonly text: string;

  public constructor(defaultBranch: string, files: readonly string[] | null, runs: number) {
    const conflict = `\`${defaultBranch}\` moved, and this pull request now conflicts with it`;
    const cancelled = `${RunCancellation.countRuns(runs)} of **Build and test** ${runs === 1 ? "was" : "were"} cancelled, `
      + `because ${runs === 1 ? "it tests" : "they test"} a revision that has to be merged again. `
      + `Merge or rebase \`${defaultBranch}\` into the branch, resolve the conflicts and push; the push starts a new run.`;
    this.text = files === null || files.length === 0
      ? `${conflict}. ${cancelled}`
      : `${conflict} in these files:\n\n${RunCancellation.listFiles(files)}\n\n${cancelled}`;
  }

  public static countRuns(runs: number): string {
    return runs === 1 ? "1 run" : `${runs} runs`;
  }

  private static listFiles(files: readonly string[]): string {
    const shown = files.slice(0, RunCancellation.FILE_LIMIT).map(t => RunCancellation.show(t));
    const longest = Math.max(0, ...shown.flatMap(t => t.match(RunCancellation.BACKTICKS) ?? []).map(t => t.length));
    const fence = RunCancellation.FENCE.repeat(Math.max(RunCancellation.SHORTEST_FENCE, longest + 1));
    const more = files.length - shown.length;
    return `${fence}\n${shown.join("\n")}\n${fence}${more > 0 ? `\n\nAnd ${more} more.` : ""}`;
  }

  private static show(file: string): string {
    const visible = file.replace(RunCancellation.CONTROL, t => `\\x${t.charCodeAt(0).toString(16).padStart(2, "0")}`);
    return visible.length > RunCancellation.NAME_LIMIT ? `${visible.slice(0, RunCancellation.NAME_LIMIT - 1)}${RunCancellation.SHORTENED}` : visible;
  }
}
