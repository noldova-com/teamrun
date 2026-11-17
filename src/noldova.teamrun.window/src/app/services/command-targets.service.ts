/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IWindowPartContext } from "@noldova/desktop.window";

export class CommandTargetsService {
  private static readonly targets: WeakMap<IWindowPartContext, CommandTargetsService> = new WeakMap();

  private readonly composers: Map<string, {
    readonly focus: () => void;
    readonly isFresh: () => boolean;
    readonly openSettings: () => void;
    readonly isTyping: () => boolean;
  }> = new Map();
  private rowMover: { readonly canMove: () => boolean; readonly move: (step: number) => void } | null = null;
  private pendingFocus: string | null = null;
  private starting: Promise<unknown> = Promise.resolve();

  public static of(context: IWindowPartContext): CommandTargetsService {
    const found = CommandTargetsService.targets.get(context);
    if (!Object.isUndefined(found))
      return found;
    const targets = new CommandTargetsService();
    CommandTargetsService.targets.set(context, targets);
    return targets;
  }

  public provideComposer(conversationId: string, focus: () => void, isFresh: () => boolean = () => false, openSettings: () => void = () => undefined,
    isTyping: () => boolean = () => false): () => void {
    const composer = { focus, isFresh, openSettings, isTyping };
    this.composers.set(conversationId, composer);
    if (this.pendingFocus === conversationId) {
      this.pendingFocus = null;
      requestAnimationFrame(() => focus());
    }
    return () => {
      if (this.composers.get(conversationId) === composer)
        this.composers.delete(conversationId);
    };
  }

  public isFresh(conversationId: string): boolean {
    return this.composers.get(conversationId)?.isFresh() ?? true;
  }

  public isTypingInAnyChat(): boolean {
    return [...this.composers.values()].some(t => t.isTyping());
  }

  public startOneAtATime<T>(start: () => Promise<T>): Promise<T> {
    const started = this.starting.then(start);
    this.starting = started.catch(() => undefined);
    return started;
  }

  public canFocusComposer(conversationId: string): boolean {
    return this.composers.has(conversationId);
  }

  public focusComposer(conversationId: string): void {
    const composer = this.composers.get(conversationId);
    if (Object.isUndefined(composer))
      this.pendingFocus = conversationId;
    else
      composer.focus();
  }

  public openComposerSettings(conversationId: string): void {
    this.composers.get(conversationId)?.openSettings();
  }

  public provideRowMover(canMove: () => boolean, move: (step: number) => void): () => void {
    const mover = { canMove, move };
    this.rowMover = mover;
    return () => {
      if (this.rowMover === mover)
        this.rowMover = null;
    };
  }

  public canMoveRow(): boolean {
    return !Object.isNull(this.rowMover) && this.rowMover.canMove();
  }

  public moveRow(step: number): void {
    this.rowMover?.move(step);
  }
}
