/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IDocumentUpdate } from "@noldova/desktop.window";

export class UpdatedDocument {
  public readonly name: string;
  public readonly instance: string;
  public readonly update: IDocumentUpdate;

  public constructor(name: string, instance: string, update: IDocumentUpdate) {
    this.name = name;
    this.instance = instance;
    this.update = update;
  }
}
