/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Options, type Query, type SDKUserMessage, type SpawnedProcess, type SpawnOptions, query } from "@anthropic-ai/claude-agent-sdk";

import "@noldova/context.core";

import type { IClaudeQuery } from "../../interfaces/i-claude-query.js";
import type { IClaudeQueryFactory } from "../../interfaces/i-claude-query-factory.js";
import type { IProcessStarter } from "../../interfaces/i-process-starter.js";
import { ProcessCommand } from "../../models/process-command.js";
import type { ProcessOrigin } from "../../models/process-origin.js";
import { Resources } from "../../resources.js";

export class AgentSdkQueryFactory implements IClaudeQueryFactory {
  private readonly starter: IProcessStarter;

  public constructor(starter: IProcessStarter) {
    this.starter = starter;
  }

  public start(prompt: string | AsyncIterable<SDKUserMessage>, options: Options, origin: ProcessOrigin): IClaudeQuery {
    return query({ prompt, options: { ...options, spawnClaudeCodeProcess: t => this.spawn(t, options.stderr, origin) } }) as Query & Pick<IClaudeQuery, "getSettings">;
  }

  private spawn(options: SpawnOptions, stderr: ((data: string) => void) | undefined, origin: ProcessOrigin): SpawnedProcess {
    const child = this.starter.start(new ProcessCommand(options.command, options.args, origin), options.env, options.cwd ?? null);
    child.stderr.setEncoding(Resources.utf8Encoding);
    child.stderr.on(Resources.dataEvent, (chunk: string) => stderr?.(chunk));

    return child;
  }
}
