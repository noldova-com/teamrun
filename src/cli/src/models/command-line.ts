/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { UsageException } from "../exceptions/usage.exception.js";
import { Resources } from "../resources.js";

export class CommandLine {
  public readonly command: string | null;
  public readonly positionals: readonly string[];
  private readonly options: ReadonlyMap<string, string | true>;

  public constructor(command: string | null, positionals: readonly string[], options: ReadonlyMap<string, string | true>) {
    this.command = command;
    this.positionals = [...positionals];
    this.options = new Map(options);
  }

  public static parse(args: readonly string[]): CommandLine {
    const positionals: string[] = [];
    const options = new Map<string, string | true>();
    let index = 0;
    while (index < args.length) {
      const argument = String(args[index]);
      if (!argument.startsWith(Resources.optionPrefix)) {
        positionals.push(argument);
        index += 1;
        continue;
      }
      const name = argument.slice(Resources.optionPrefix.length);
      const next = args[index + 1];
      if (Object.isUndefined(next) || next.startsWith(Resources.optionPrefix)) {
        options.set(name, true);
        index += 1;
      }
      else {
        options.set(name, next);
        index += 2;
      }
    }

    return new CommandLine(positionals[0] ?? null, positionals.slice(1), options);
  }

  public hasFlag(name: string): boolean {
    return this.options.has(name);
  }

  public option(name: string): string | null {
    const value = this.options.get(name);
    return Object.isString(value) ? value : null;
  }

  public requireOption(name: string): string {
    const value = this.option(name);
    if (Object.isNull(value))
      throw new UsageException(Resources.formatMissingOption(name));

    return value;
  }

  public positional(index: number): string | null {
    return this.positionals[index] ?? null;
  }

  public requirePositional(index: number, name: string): string {
    const value = this.positional(index);
    if (Object.isNull(value))
      throw new UsageException(Resources.formatMissingArgument(name));

    return value;
  }
}
