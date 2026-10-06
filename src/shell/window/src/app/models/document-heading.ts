/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../../resources";

export class DocumentHeading {
  public readonly title: string;
  public readonly breadcrumb: readonly string[];

  public constructor(title: string, breadcrumb: readonly string[] = []) {
    this.title = DocumentHeading.requireTitle(title);
    this.breadcrumb = DocumentHeading.requireBreadcrumb(breadcrumb);
  }

  public static requireTitle(title: string): string {
    ArgumentException.throwIfNullOrWhitespace(title, Resources.titleParameter);
    return title;
  }

  public static requireBreadcrumb(breadcrumb: readonly string[]): readonly string[] {
    if (breadcrumb.some(t => String.isNullOrWhitespace(t)))
      throw new ArgumentException(Resources.invalidBreadcrumb, Resources.breadcrumbParameter);
    return [...breadcrumb];
  }

  public get text(): string {
    return [...this.breadcrumb, this.title].join(Resources.breadcrumbSeparator);
  }

  public get windowTitle(): string {
    return Resources.formatWindowTitle(this.title);
  }

  public with(title: string | null, breadcrumb: readonly string[] | null): DocumentHeading {
    return new DocumentHeading(title ?? this.title, breadcrumb ?? this.breadcrumb);
  }
}
