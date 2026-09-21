/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import type { MessageAttachment, ProviderAccount, RequestedSettings } from "@noldova/teamrun-protocol";

import { Resources } from "../resources.js";

export class TurnRequest {
  public readonly account: ProviderAccount | null;
  public readonly workingDirectory: string;
  public readonly prompt: string;
  public readonly requested: RequestedSettings;
  public readonly resumeNativeSessionId: string | null;
  public readonly attachments: readonly MessageAttachment[];
  public readonly instructions: string | null;
  public readonly freshPrompt: string | null;

  public constructor(
    account: ProviderAccount | null,
    workingDirectory: string,
    prompt: string,
    requested: RequestedSettings,
    resumeNativeSessionId: string | null,
    attachments: readonly MessageAttachment[] = [],
    instructions: string | null = null,
    freshPrompt: string | null = null) {
    ArgumentException.throwIfNullOrWhitespace(workingDirectory, Resources.workingDirectoryParameterName);
    ArgumentException.throwIfNullOrWhitespace(prompt, Resources.promptParameterName);
    if (!Object.isNull(resumeNativeSessionId))
      ArgumentException.throwIfNullOrWhitespace(resumeNativeSessionId, Resources.resumeNativeSessionIdParameterName);
    if (!Object.isNull(instructions))
      ArgumentException.throwIfNullOrWhitespace(instructions, Resources.instructionsParameterName);
    if (!Object.isNull(freshPrompt))
      ArgumentException.throwIfNullOrWhitespace(freshPrompt, Resources.freshPromptParameterName);

    this.account = account;
    this.workingDirectory = workingDirectory;
    this.prompt = prompt;
    this.requested = requested;
    this.resumeNativeSessionId = resumeNativeSessionId;
    this.attachments = [...attachments];
    this.instructions = instructions;
    this.freshPrompt = freshPrompt;
  }
}
