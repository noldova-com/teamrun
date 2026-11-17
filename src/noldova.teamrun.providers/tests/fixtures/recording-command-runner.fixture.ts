/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { realpathSync } from "node:fs";
import { homedir, tmpdir } from "node:os";

import { type CommandResult, CommandRunner, NodeProcessStarter, ProcessTerminator, type ProcessCommand } from "@noldova/teamrun.providers";

export class RecordingCommandRunner extends CommandRunner {
  private static readonly placeholders: readonly (readonly [string, string])[] = [[process.execPath, "<node>"], [tmpdir(), "<temp>"], [homedir(), "<home>"]];
  private static readonly userFolder: RegExp = /(\b[a-z]:[\\/]+users[\\/]+|\/users\/|\/home\/)[^\\/\s"']+/giu;

  public readonly runs: string[] = [];

  public constructor() {
    super(new NodeProcessStarter(new ProcessTerminator(process.platform)));
  }

  public override async run(command: ProcessCommand, environment: NodeJS.ProcessEnv, timeoutMilliseconds: number | null,
    cancel: AbortSignal | null = null): Promise<CommandResult> {
    const name = RecordingCommandRunner.redact([command.executable, ...command.arguments].join(" "));
    try {
      const result = await super.run(command, environment, timeoutMilliseconds, cancel);
      const stdout = RecordingCommandRunner.redact(result.stdout.slice(0, 200));
      const stderr = RecordingCommandRunner.redact(result.stderr.slice(0, 1_000));
      this.runs.push(`${name}: exit ${result.exitCode}, signal ${result.signal}, timed out ${result.timedOut}, stdout ${JSON.stringify(stdout)}, stderr ${JSON.stringify(stderr)}`);
      return result;
    }
    catch (error) {
      this.runs.push(`${name}: threw ${RecordingCommandRunner.redact(String(error))}`);
      throw error;
    }
  }

  public static redact(text: string): string {
    let redacted = text;
    for (const [path, placeholder] of RecordingCommandRunner.placeholders)
      for (const form of RecordingCommandRunner.formsOf(path))
        redacted = redacted.replaceAll(form, placeholder);
    return redacted.replace(RecordingCommandRunner.userFolder, "$1<user>");
  }

  private static formsOf(path: string): readonly string[] {
    return [...new Set([path, realpathSync.native(path)].flatMap(t => [t, t.replaceAll("\\", "/")]))].sort((a, b) => b.length - a.length);
  }
}
