/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class InstallCancelCase<TInstaller> {
  public readonly step: string;
  public readonly controller: AbortController;
  public readonly installer: TInstaller;
  public readonly progress: () => void;

  public constructor(step: string, controller: AbortController, installer: TInstaller, progress: () => void) {
    this.step = step;
    this.controller = controller;
    this.installer = installer;
    this.progress = progress;
  }
}
