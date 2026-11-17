/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Readable } from "node:stream";

import type { Exception } from "@noldova/context.exceptions";
import type { ICliPart, ICliPartContext } from "@noldova/desktop.cli";

/**
 * The base of every exception the command-line package throws, which its callers catch as one.
 */
export declare abstract class CliException extends Exception {
  /**
   * Initializes the exception.
   * @param message What went wrong.
   */
  protected constructor(message: string);
}

/**
 * A TeamRun command got an answer from the runtime part it cannot read.
 */
export declare class CliPartException extends CliException {
  /**
   * The exception's name, `"CliPartException"`, which the class sets itself so that it stays
   * the same in a minified build.
   */
  public override readonly name: string;
  /**
   * The runtime part's method, by its qualified name, that answered with something other than a list.
   */
  public readonly method: string;

  /**
   * Initializes the exception, with its message naming the method.
   * @param method The runtime part's method, by its qualified name, that answered with something other than a list.
   */
  public constructor(method: string);
}

/**
 * TeamRun's command-line part: its commands, each run as `<app command> teamrun <name>`, which
 * reach the runtime part through its methods.
 */
export declare class CliPart implements ICliPart {
  /**
   * Initializes the part.
   * @param environment The process's variables, `process.env` by default; `send` run from a teammate's process reads its chat and teammate
   * from them, and sends as that teammate.
   * @param input The process's standard input, `process.stdin` by default, which `send` reads its message from when the message is `-` alone, refusing a terminal.
   */
  public constructor(environment?: Readonly<Record<string, string | undefined>>, input?: Readable);

  /**
   * Registers the commands `cli.json` declares.
   * @param context The part's context.
   */
  public activateAsync(context: ICliPartContext): Promise<void>;

  /**
   * Ends the part; it holds nothing to release.
   */
  public deactivateAsync(): Promise<void>;
}
