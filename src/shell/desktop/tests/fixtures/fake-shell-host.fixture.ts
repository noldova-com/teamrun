/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IShellHost } from "@noldova/teamrun-shell-desktop";

export class FakeShellHost implements IShellHost {
  public readonly opened: string[] = [];
  public failure: string = "";
  public readonly links: string[] = [];
  public linkFailure: Error | null = null;

  public openPath(path: string): Promise<string> {
    this.opened.push(path);
    return Promise.resolve(this.failure);
  }

  public openExternal(url: string): Promise<void> {
    this.links.push(url);
    return Object.isNull(this.linkFailure) ? Promise.resolve() : Promise.reject(this.linkFailure);
  }
}
