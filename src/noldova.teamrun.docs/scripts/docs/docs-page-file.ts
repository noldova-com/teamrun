/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class DocsPageFile {
  public readonly name: string;
  public readonly title: string;
  public readonly text: string;

  public constructor(name: string, title: string, text: string) {
    this.name = name;
    this.title = title;
    this.text = text;
  }
}
