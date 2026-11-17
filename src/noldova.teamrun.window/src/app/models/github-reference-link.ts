/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { HostReference, ReferenceKind } from "@noldova/git.hosting.protocol";

export class GitHubReferenceLink {
  public readonly reference: HostReference;
  public readonly kind: ReferenceKind;

  public constructor(reference: HostReference, kind: ReferenceKind) {
    this.reference = reference;
    this.kind = kind;
  }

  public get key(): string {
    return this.reference.text.toLowerCase();
  }
}
