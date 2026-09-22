/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IConsole } from "@noldova/teamrun-cli";

export class FakeConsole implements IConsole {
  public readonly lines: string[] = [];
  public readonly errors: string[] = [];
  public readonly prompts: string[] = [];
  public readonly answers: (string | null)[] = [];
  public onAsk: (() => void) | null = null;
  public onWrite: ((line: string) => void) | null = null;

  public get output(): string {
    return this.lines.join("\n");
  }

  public get lastLine(): string {
    return this.lines[this.lines.length - 1] ?? "";
  }

  public write(line: string): void {
    this.lines.push(line);
    if (this.onWrite !== null)
      this.onWrite(line);
  }

  public writeError(line: string): void {
    this.errors.push(line);
  }

  public ask(prompt: string): Promise<string | null> {
    this.prompts.push(prompt);
    if (this.onAsk !== null)
      this.onAsk();
    return Promise.resolve(this.answers.length === 0 ? null : this.answers.shift() ?? null);
  }
}
