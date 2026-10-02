/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class SenderInfo {
  public readonly frameUrl: string;
  public readonly isTopLevel: boolean;
  public readonly contentsId: number;

  public constructor(frameUrl: string, isTopLevel: boolean, contentsId: number) {
    this.frameUrl = frameUrl;
    this.isTopLevel = isTopLevel;
    this.contentsId = contentsId;
  }
}
