/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { MessageAttachment, WaitingMessage } from "@noldova/teamrun.protocol";

/** A waiting message's edit: the message before and after it, and the files the edited message keeps. */
export class WaitingEdit {
  public readonly current: WaitingMessage;
  public readonly edited: WaitingMessage;
  public readonly kept: readonly MessageAttachment[];

  public constructor(current: WaitingMessage, edited: WaitingMessage, kept: readonly MessageAttachment[]) {
    this.current = current;
    this.edited = edited;
    this.kept = kept;
  }
}
