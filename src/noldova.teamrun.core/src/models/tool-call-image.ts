/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ToolCallImage {
  public readonly data: string;
  public readonly mediaType: string;

  public constructor(data: string, mediaType: string) {
    this.data = data;
    this.mediaType = mediaType;
  }
}
