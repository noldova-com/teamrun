/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Signal, type WritableSignal, signal } from "@angular/core";

import "@noldova/context.core";
import type { HostReference } from "@noldova/git.hosting.protocol";
import type { LinkReference } from "@noldova/ui.components.angular";

export class GitHubReferenceRead {
  private readonly shown: WritableSignal<LinkReference | null>;
  private attempt: number = 0;

  public readonly reference: HostReference;
  public readonly pending: LinkReference;

  public constructor(reference: HostReference, pending: LinkReference, isShown: boolean) {
    this.reference = reference;
    this.pending = pending;
    this.shown = signal(isShown ? pending : null);
  }

  public get item(): Signal<LinkReference | null> {
    return this.shown.asReadonly();
  }

  public start(): number {
    if (Object.isNull(this.shown()))
      this.shown.set(this.pending);
    return ++this.attempt;
  }

  public stop(): void {
    this.attempt++;
    this.shown.set(null);
  }

  public show(attempt: number, item: LinkReference | null): boolean {
    if (attempt !== this.attempt)
      return false;
    this.shown.set(item);
    return true;
  }
}
