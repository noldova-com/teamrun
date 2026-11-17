/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Page } from "./page.js";
import { PageResources } from "./page-resources.js";
import { PageVersion } from "./page-version.js";

export class PageView {
  public readonly page: Page;
  public readonly versions: readonly PageVersion[];
  public readonly version: number;
  public readonly shown: PageVersion;
  public readonly address: string;
  public readonly file: string;

  public constructor(page: Page, versions: readonly PageVersion[], version: number, address: string, file: string) {
    const shown = versions.find(t => t.version === version);
    if (shown === undefined)
      throw new ArgumentOutOfRangeException(PageResources.versionField, version);
    ArgumentException.throwIfNullOrWhitespace(address, PageResources.addressField);
    ArgumentException.throwIfNullOrWhitespace(file, PageResources.fileField);

    this.page = page;
    this.versions = versions;
    this.version = version;
    this.shown = shown;
    this.address = address;
    this.file = file;
  }

  public static fromJson(value: unknown, path?: string): PageView {
    const reader = JsonReader.fromValue(value, path);
    const page = reader.readObject(PageResources.pageField);
    return new PageView(Page.fromJson(page.toJson(), page.path), reader.readObjectArray(PageResources.versionsField).map(t => PageVersion.fromJson(t.toJson(), t.path)),
      reader.readInteger(PageResources.versionField), reader.readNonBlankString(PageResources.addressField), reader.readNonBlankString(PageResources.fileField));
  }

  public toJson(): JsonObject {
    return {
      [PageResources.pageField]: this.page.toJson(),
      [PageResources.versionsField]: this.versions.map(t => t.toJson()),
      [PageResources.versionField]: this.version,
      [PageResources.addressField]: this.address,
      [PageResources.fileField]: this.file
    };
  }
}
