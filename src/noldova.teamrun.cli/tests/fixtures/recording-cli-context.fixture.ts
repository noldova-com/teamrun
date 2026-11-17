/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Readable } from "node:stream";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import type { CliCommandResult, ICliCommandConsole, ICliCommandHandler, ICliPartContext } from "@noldova/desktop.cli";

import { CliPart } from "@noldova/teamrun.cli";

export class RecordingCliContext implements ICliPartContext {
  private static readonly CONSOLE: ICliCommandConsole = { writeLine: () => undefined, askAsync: () => Promise.resolve(null), onEvent: () => new DisposableStack() };

  public readonly moduleId: string = "teamrun";
  public readonly commands: Map<string, ICliCommandHandler> = new Map();
  public readonly answers: Map<string, (payload: JsonValue) => JsonValue> = new Map();
  public readonly requests: (readonly [method: string, payload: JsonValue])[] = [];
  public readonly signals: AbortSignal[] = [];

  public static async activateAsync(environment: Readonly<Record<string, string | undefined>> = {}, input: string | Readable = String.empty): Promise<RecordingCliContext> {
    const context = new RecordingCliContext();
    await new CliPart(environment, Object.isString(input) ? Readable.from([Buffer.from(input)]) : input).activateAsync(context);
    return context;
  }

  public get secrets(): ICliPartContext["secrets"] {
    throw new Error("The fixture keeps no secrets.");
  }

  public registerCommand(name: string, handler: ICliCommandHandler): void {
    this.commands.set(name, handler);
  }

  public requestAsync(method: string, payload: JsonValue, signal: AbortSignal): Promise<JsonValue> {
    this.requests.push([method, payload]);
    this.signals.push(signal);
    const answer = this.answers.get(method);
    return Object.isUndefined(answer) ? Promise.reject(new Error(`The fixture has no answer for ${method}.`)) : new Promise(resolve => resolve(answer(payload)));
  }

  public answer(method: string, reply: (payload: JsonValue) => JsonValue): this {
    this.answers.set(method, reply);
    return this;
  }

  public runAsync(name: string, values: Readonly<Record<string, JsonValue>> = {}, signal: AbortSignal = new AbortController().signal): Promise<CliCommandResult> {
    return this.commands.get(name)!.handleAsync(values, signal, RecordingCliContext.CONSOLE);
  }

  public payloadsOf(method: string): readonly JsonValue[] {
    return this.requests.filter(t => t[0] === method).map(t => t[1]);
  }
}
