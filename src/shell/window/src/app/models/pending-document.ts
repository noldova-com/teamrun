/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class PendingDocument {
  public readonly moduleId: string;
  public readonly name: string;
  public readonly instance: string;
  public readonly title: string;
  public readonly isPreview: boolean;

  public constructor(moduleId: string, name: string, instance: string, title: string, isPreview: boolean) {
    this.moduleId = moduleId;
    this.name = name;
    this.instance = instance;
    this.title = title;
    this.isPreview = isPreview;
  }

  public kept(moduleId: string, name: string, instance: string): PendingDocument {
    const isSame = this.moduleId === moduleId && this.name === name && this.instance === instance;
    return isSame ? new PendingDocument(this.moduleId, this.name, this.instance, this.title, false) : this;
  }
}
