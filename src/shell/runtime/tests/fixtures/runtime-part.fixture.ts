/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IRuntimePart, IRuntimePartContext } from "@noldova/teamrun-shell-runtime";

export class RuntimePartFixture implements IRuntimePart {
  private readonly name: string;
  private readonly log: string[];
  private readonly activate: (context: IRuntimePartContext) => void;
  private readonly deactivationFailure: Error | null;

  public context: IRuntimePartContext | null = null;

  public constructor(name: string, log: string[], activate: (context: IRuntimePartContext) => void = () => undefined, deactivationFailure: Error | null = null) {
    this.name = name;
    this.log = log;
    this.activate = activate;
    this.deactivationFailure = deactivationFailure;
  }

  public async activateAsync(context: IRuntimePartContext): Promise<void> {
    this.log.push(`activate ${this.name}`);
    this.context = context;
    this.activate(context);
  }

  public async deactivateAsync(): Promise<void> {
    this.log.push(`deactivate ${this.name}`);
    if (this.deactivationFailure !== null)
      throw this.deactivationFailure;
  }
}
