/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Interface, createInterface } from "node:readline";

import "@noldova/teamrun-foundation-core";

import type { IConsole } from "../../interfaces/i-console.js";
import { Resources } from "../../resources.js";

export class TerminalConsole implements IConsole, Disposable {
  private readonly output: NodeJS.WritableStream;
  private readonly errors: NodeJS.WritableStream;
  private readonly input: Interface;
  private readonly pendingLines: string[] = [];
  private readonly waiting: PromiseWithResolvers<string | null>[] = [];
  private ended: boolean = false;

  public constructor(input: NodeJS.ReadableStream, output: NodeJS.WritableStream, errors: NodeJS.WritableStream) {
    this.output = output;
    this.errors = errors;
    this.input = createInterface({ input, terminal: false });
    this.input.on(Resources.lineEvent, (line: string) => this.receive(line));
    this.input.on(Resources.closeEvent, () => this.end());
  }

  public write(line: string): void {
    this.output.write(`${line}${Resources.lineSeparator}`);
  }

  public writeError(line: string): void {
    this.errors.write(`${line}${Resources.lineSeparator}`);
  }

  public async ask(prompt: string, signal?: AbortSignal): Promise<string | null> {
    if (signal?.aborted)
      return null;
    this.output.write(prompt);
    const pending = this.pendingLines.shift();
    if (!Object.isUndefined(pending))
      return Promise.resolve(pending);
    if (this.ended)
      return Promise.resolve(null);

    const resolvers = Promise.withResolvers<string | null>();
    this.waiting.push(resolvers);
    const cancel = (): void => {
      const index = this.waiting.indexOf(resolvers);
      if (index >= 0)
        this.waiting.splice(index, 1);
      resolvers.resolve(null);
    };
    signal?.addEventListener(Resources.abortEvent, cancel, { once: true });
    try {
      return await resolvers.promise;
    }
    finally {
      signal?.removeEventListener(Resources.abortEvent, cancel);
    }
  }

  public [Symbol.dispose](): void {
    this.input.close();
  }

  private receive(line: string): void {
    const waiting = this.waiting.shift();
    if (Object.isUndefined(waiting))
      this.pendingLines.push(line);
    else
      waiting.resolve(line);
  }

  private end(): void {
    this.ended = true;
    for (const waiting of this.waiting)
      waiting.resolve(null);
    this.waiting.length = 0;
  }
}
