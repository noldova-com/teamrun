/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DocsGroup } from "../enums/docs-group";

export class DocsPage {
  public readonly title: string;
  public readonly path: string;
  public readonly group: DocsGroup;
  public readonly file: string;
  public readonly text: string;

  public constructor(title: string, path: string, group: DocsGroup, file: string, text: string) {
    this.title = title;
    this.path = path;
    this.group = group;
    this.file = file;
    this.text = text;
  }

  public get link(): string {
    return `/${this.path}`;
  }
}
