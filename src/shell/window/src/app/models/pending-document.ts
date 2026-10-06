/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DocumentHeading } from "./document-heading";

export class PendingDocument {
  public readonly moduleId: string;
  public readonly name: string;
  public readonly instance: string;
  public readonly heading: DocumentHeading;
  public readonly isPreview: boolean;

  public constructor(moduleId: string, name: string, instance: string, heading: DocumentHeading, isPreview: boolean) {
    this.moduleId = moduleId;
    this.name = name;
    this.instance = instance;
    this.heading = heading;
    this.isPreview = isPreview;
  }

  public kept(moduleId: string, name: string, instance: string): PendingDocument {
    return this.isFor(moduleId, name, instance) ? new PendingDocument(this.moduleId, this.name, this.instance, this.heading, false) : this;
  }

  public updated(moduleId: string, name: string, instance: string, title: string | null, breadcrumb: readonly string[] | null): PendingDocument {
    return this.isFor(moduleId, name, instance) ? new PendingDocument(this.moduleId, this.name, this.instance, this.heading.with(title, breadcrumb), this.isPreview) : this;
  }

  private isFor(moduleId: string, name: string, instance: string): boolean {
    return this.moduleId === moduleId && this.name === name && this.instance === instance;
  }
}
