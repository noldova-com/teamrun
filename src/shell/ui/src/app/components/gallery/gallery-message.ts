/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class GalleryMessage {
  public readonly key: string;
  public readonly heading: string;
  public readonly text: string;
  public readonly code: string | null;

  public constructor(key: string, heading: string, text: string, code: string | null) {
    this.key = key;
    this.heading = heading;
    this.text = text;
    this.code = code;
  }

  public withText(text: string): GalleryMessage {
    return new GalleryMessage(this.key, this.heading, text, this.code);
  }
}
