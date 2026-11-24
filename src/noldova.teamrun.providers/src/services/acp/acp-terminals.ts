/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { randomUUID } from "node:crypto";
import { isAbsolute } from "node:path";
import type { JsonReader, JsonValue } from "@noldova/context.json";
import { type ITimer, type ITurnListener, TaskEnd, TaskStart } from "@noldova/teamrun.core";
import { BackgroundTaskStatus } from "@noldova/teamrun.protocol";

import { AcpRequestException } from "../../exceptions/acp-request.exception.js";
import type { IAcpTerminal } from "../../interfaces/i-acp-terminal.js";
import type { IAcpTerminalExit } from "../../interfaces/i-acp-terminal-exit.js";
import type { IProcessStarter } from "../../interfaces/i-process-starter.js";
import type { IProcessTree } from "../../interfaces/i-process-tree.js";
import type { ProcessCommand } from "../../models/process-command.js";
import type { ProcessOrigin } from "../../models/process-origin.js";
import { Resources } from "../../resources.js";
import { FailureDescriber } from "../failure-describer.js";
import { SavedImageFile } from "../saved-image-file.js";
import { AcpCommandLine } from "./acp-command-line.js";

export class AcpTerminals {
  private readonly listener: ITurnListener;
  private readonly providerName: string;
  private readonly starter: IProcessStarter;
  private readonly timer: ITimer;
  private readonly directory: string;
  private readonly environment: () => NodeJS.ProcessEnv;
  private readonly origin: ProcessOrigin | null;
  private readonly tree: IProcessTree;
  private readonly platform: string;
  private readonly terminals: Map<string, IAcpTerminal> = new Map();
  private sessionId: string | null = null;
  private settle: (() => void) | null = null;
  private fail: ((error: unknown) => void) | null = null;
  private events: Promise<void> = Promise.resolve();
  private queued: number = 0;

  public constructor(listener: ITurnListener, providerName: string, starter: IProcessStarter, timer: ITimer, directory: string,
    environment: () => NodeJS.ProcessEnv, origin: ProcessOrigin | null, tree: IProcessTree, platform: string) {
    this.listener = listener;
    this.providerName = providerName;
    this.starter = starter;
    this.timer = timer;
    this.directory = directory;
    this.environment = environment;
    this.origin = origin;
    this.tree = tree;
    this.platform = platform;
  }

  public get isIdle(): boolean {
    return this.queued === 0 && ![...this.terminals.values()].some(t => Object.isNull(t.exit));
  }

  public handles(method: string): boolean {
    return Resources.acpTerminalMethods.includes(method);
  }

  public begin(sessionId: string, settle: () => void, fail: (error: unknown) => void): void {
    this.sessionId = sessionId;
    this.settle = settle;
    this.fail = fail;
  }

  public async request(method: string, params: JsonReader): Promise<JsonValue> {
    if (Object.isNull(this.sessionId) || params.readNonBlankString(Resources.sessionIdField) !== this.sessionId)
      throw new AcpRequestException(Resources.acpTerminalOtherSession, Resources.acpInvalidParamsCode);
    if (method === Resources.acpTerminalCreate)
      return this.create(params);
    const terminalId = params.readNonBlankString(Resources.acpTerminalIdField);
    const terminal = this.terminals.get(terminalId);
    if (Object.isUndefined(terminal) || terminal.released)
      throw new AcpRequestException(Resources.formatAcpTerminalUnknown(terminalId), Resources.acpInvalidParamsCode);
    if (method === Resources.acpTerminalOutput)
      return {
        [Resources.outputField]: terminal.output, [Resources.acpTruncatedField]: terminal.truncated,
        ...(Object.isNull(terminal.exit) ? {} : { [Resources.acpExitStatusField]: AcpTerminals.exitOf(terminal.exit) })
      };
    if (method === Resources.acpTerminalWaitForExit)
      return AcpTerminals.exitOf(await terminal.exited);
    if (method === Resources.acpTerminalRelease) {
      terminal.released = true;
      if (!terminal.isTask || !Object.isNull(terminal.exit))
        this.terminals.delete(terminalId);
    }
    await this.kill(terminal);
    return {};
  }

  public async noteAsync(method: string, params: JsonReader): Promise<void> {
    if (method !== Resources.acpSessionUpdate || !params.hasField(Resources.acpUpdateField) || params.readValue(Resources.sessionIdField) !== this.sessionId)
      return;
    const update = params.readObject(Resources.acpUpdateField);
    const kind = update.readOptionalString(Resources.acpSessionUpdateField);
    if (kind !== Resources.acpToolCall && kind !== Resources.acpToolUpdate || !Resources.acpEndedToolStatuses.includes(update.readOptionalString(Resources.statusField) ?? String.empty)
      || !update.hasField(Resources.contentField))
      return;
    for (const content of update.readObjectArray(Resources.contentField))
      if (content.readOptionalString(Resources.typeField) === Resources.acpTerminalType)
        await this.followAsync(content.readNonBlankString(Resources.acpTerminalIdField));
  }

  public async followRunningAsync(): Promise<void> {
    for (const terminalId of [...this.terminals.keys()])
      await this.followAsync(terminalId);
  }

  public async stopAll(): Promise<void> {
    await Promise.all([...this.terminals.values()].map(t => this.kill(t).catch(() => undefined)));
  }

  public endAll(): void {
    for (const terminal of this.terminals.values())
      void this.kill(terminal).catch(() => undefined);
  }

  private create(params: JsonReader): JsonValue {
    const executable = params.readNonBlankString(Resources.commandField);
    const fields = params.toJson();
    const args = Object.isNullOrUndefined(fields[Resources.acpArgsField]) ? [] : params.readStringArray(Resources.acpArgsField);
    const cwd = params.hasField(Resources.cwdField) ? params.readNullableString(Resources.cwdField) : null;
    const directory = cwd ?? this.directory;
    if (!isAbsolute(directory) || !SavedImageFile.isInside(this.directory, directory))
      throw new AcpRequestException(Resources.formatAcpTerminalOutside(this.providerName, directory), Resources.acpInvalidParamsCode);
    const variables = Object.isNullOrUndefined(fields[Resources.acpEnvField]) ? {}
      : Object.fromEntries(params.readObjectArray(Resources.acpEnvField).map(t => [t.readNonBlankString(Resources.nameField), t.readString(Resources.acpValueField)]));
    const asked = fields[Resources.acpOutputByteLimitField];
    const limit = Object.isNumber(asked) && Number.isSafeInteger(asked) && asked >= 0 ? Math.min(asked, Resources.acpTerminalOutputLimit)
      : Resources.acpTerminalOutputLimit;
    const environment = this.environment();
    const command = this.commandOf(environment, executable, args);
    const launched = this.timer.now();
    const started = this.starter.start(command, { ...environment, ...variables }, directory);
    const exited = Promise.withResolvers<IAcpTerminalExit>();
    const terminalId = `${Resources.acpTerminalIdPrefix}${randomUUID()}`;
    const terminal: IAcpTerminal = {
      command: [executable, ...args].join(Resources.acpTerminalCommandSeparator), process: started, launched, startedBy: null,
      limit, exited: exited.promise, output: String.empty, truncated: false, exit: null, isTask: false, stopping: false, released: false
    };
    this.terminals.set(terminalId, terminal);
    started.once(Resources.spawnEvent, () => { terminal.startedBy = this.timer.now(); });
    const write = (text: string): void => this.write(terminalId, terminal, text);
    started.stdout.setEncoding(Resources.utf8Encoding).on(Resources.dataEvent, write);
    started.stderr.setEncoding(Resources.utf8Encoding).on(Resources.dataEvent, write);
    started.on(Resources.errorEvent, (error: Error) => write(`${error.message}${Resources.lineSeparator}`));
    started.once(Resources.closeEvent, (code: number | null, signal: NodeJS.Signals | null) => {
      const exit = { exitCode: Object.isNull(terminal.startedBy) ? null : code, signal };
      terminal.exit = exit;
      exited.resolve(exit);
      this.ended(terminalId, terminal, exit.exitCode);
    });
    return { [Resources.acpTerminalIdField]: terminalId };
  }

  private commandOf(environment: NodeJS.ProcessEnv, executable: string, args: readonly string[]): ProcessCommand {
    try {
      const command = AcpCommandLine.of(this.platform, environment, {}, executable, args).inOwnGroup();
      return Object.isNull(this.origin) ? command : command.withOrigin(this.origin);
    }
    catch (error) {
      throw new AcpRequestException(FailureDescriber.describe(error), Resources.acpInvalidParamsCode);
    }
  }

  private followAsync(terminalId: string): Promise<void> {
    const terminal = this.terminals.get(terminalId);
    if (Object.isUndefined(terminal) || terminal.isTask || !Object.isNull(terminal.exit))
      return Promise.resolve();
    terminal.isTask = true;
    const output = terminal.output;
    return this.enqueue(async () => {
      await this.listener.onTaskStartedAsync(new TaskStart(terminalId, terminal.command, () => this.kill(terminal)));
      if (output.length > 0)
        this.listener.onTaskOutput(terminalId, output);
    });
  }

  private enqueue(work: () => Promise<void> | void): Promise<void> {
    this.queued++;
    const done = this.events.then(work).finally(() => this.queued--);
    this.events = done.then(() => undefined, () => undefined);
    return done;
  }

  private report(work: () => Promise<void> | void): void {
    this.enqueue(work).then(() => this.settle?.(), (error: unknown) => this.fail?.(error));
  }

  private async kill(terminal: IAcpTerminal): Promise<void> {
    if (!Object.isNull(terminal.exit))
      return;
    terminal.stopping = true;
    const processId = terminal.process.pid;
    const startedBy = terminal.startedBy;
    if (!Object.isUndefined(processId) && !Object.isNull(startedBy) && await this.tree.endOwnTree(processId, startedBy))
      return;
    if (!Object.isUndefined(processId))
      await this.tree.endLeftovers(processId, terminal.launched, this.timer.now());
    await terminal.process.stopAsync();
  }

  private write(terminalId: string, terminal: IAcpTerminal, text: string): void {
    const kept = AcpTerminals.lastBytesOf(`${terminal.output}${text}`, terminal.limit);
    terminal.truncated ||= kept.length < terminal.output.length + text.length;
    terminal.output = kept;
    if (terminal.isTask && this.queued > 0)
      this.report(() => this.listener.onTaskOutput(terminalId, text));
    else if (terminal.isTask)
      this.listener.onTaskOutput(terminalId, text);
  }

  private ended(terminalId: string, terminal: IAcpTerminal, exitCode: number | null): void {
    if (terminal.released)
      this.terminals.delete(terminalId);
    const status = terminal.stopping ? BackgroundTaskStatus.Stopped : exitCode === 0 ? BackgroundTaskStatus.Completed : BackgroundTaskStatus.Failed;
    const isTask = terminal.isTask;
    this.report(async () => {
      if (isTask)
        await this.listener.onTaskEndedAsync(new TaskEnd(terminalId, status, exitCode));
    });
  }

  private static exitOf(exit: IAcpTerminalExit): JsonValue {
    return { [Resources.exitCodeField]: exit.exitCode, [Resources.acpSignalField]: exit.signal };
  }

  private static lastBytesOf(text: string, limit: number): string {
    const bytes = Buffer.from(text, Resources.utf8Encoding);
    if (bytes.length <= limit)
      return text;
    let start = bytes.length - limit;
    while (start < bytes.length && (bytes.readUInt8(start) & Resources.utf8ContinuationMask) === Resources.utf8ContinuationBits)
      start++;
    return bytes.subarray(start).toString(Resources.utf8Encoding);
  }
}
