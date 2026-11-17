/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import "@noldova/context.core";
import type { SubAgent } from "@noldova/teamrun.protocol";

import type { MessageFocus } from "./message-focus";

export class SubAgentCard {
  public readonly focus: MessageFocus;
  public readonly agent: SubAgent;
  public readonly startedAt: number;
  public readonly author: string;
  public readonly initials: string | null;
  public readonly color: number | null;
  public readonly isAuthorUnavailable: boolean;
  public readonly model: string | null;
  public readonly stopRefusal: string | null;

  public constructor(focus: MessageFocus, agent: SubAgent, startedAt: number, author: string, initials: string | null, color: number | null,
    isAuthorUnavailable: boolean, model: string | null, stopRefusal: string | null) {
    this.focus = focus;
    this.agent = agent;
    this.startedAt = startedAt;
    this.author = author;
    this.initials = initials;
    this.color = color;
    this.isAuthorUnavailable = isAuthorUnavailable;
    this.model = model;
    this.stopRefusal = stopRefusal;
  }

  public get key(): string {
    return `${this.focus.messageId}:${this.focus.step}`;
  }

  public shows(focus: MessageFocus | null): boolean {
    return !Object.isNull(focus) && focus.messageId === this.focus.messageId && focus.step === this.focus.step;
  }
}
