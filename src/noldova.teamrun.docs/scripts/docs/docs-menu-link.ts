/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class DocsMenuLink {
  public readonly link: string;
  public readonly title: string;

  public constructor(link: string, title: string) {
    this.link = link;
    this.title = title;
  }
}
