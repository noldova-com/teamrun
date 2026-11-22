/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IDocumentOptions } from "@noldova/desktop.window";

export class OpenedDocument {
  public readonly name: string;
  public readonly instance: string;
  public readonly title: string;
  public readonly options: IDocumentOptions | undefined;

  public constructor(name: string, instance: string, title: string, options: IDocumentOptions | undefined) {
    this.name = name;
    this.instance = instance;
    this.title = title;
    this.options = options;
  }
}
