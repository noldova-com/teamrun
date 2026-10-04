/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import "@noldova/teamrun-foundation-core";
import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader } from "@noldova/teamrun-foundation-json";

import { ProductFileException } from "../exceptions/product-file.exception.js";
import { Resources } from "../resources.js";

export class ProductInfo {
  private static loaded: ProductInfo | null = null;

  public readonly name: string;
  public readonly slug: string;
  public readonly applicationId: string;
  public readonly developmentApplicationId: string;
  public readonly dataFolder: string;
  public readonly windowsDeviceFolder: string;
  public readonly macosDeviceFolder: string;
  public readonly linuxDeviceFolder: string;
  public readonly dataDirectoryVariable: string;
  public readonly icons: string;
  public readonly version: string;
  public readonly build: string;

  private constructor(reader: JsonReader) {
    const folders = reader.readObject(Resources.deviceFoldersField);
    this.name = reader.readNonBlankString(Resources.nameParameterName);
    this.slug = reader.readNonBlankString(Resources.slugField);
    this.applicationId = reader.readNonBlankString(Resources.applicationIdField);
    this.developmentApplicationId = reader.readNonBlankString(Resources.developmentApplicationIdField);
    this.dataFolder = reader.readNonBlankString(Resources.dataFolderField);
    this.windowsDeviceFolder = folders.readNonBlankString(Resources.windowsField);
    this.macosDeviceFolder = folders.readNonBlankString(Resources.macosField);
    this.linuxDeviceFolder = folders.readNonBlankString(Resources.linuxField);
    this.dataDirectoryVariable = reader.readNonBlankString(Resources.dataDirectoryVariableField);
    this.icons = reader.readNonBlankString(Resources.iconsField);
    this.version = reader.readNonBlankString(Resources.versionField);
    this.build = reader.readNonBlankString(Resources.buildField);
  }

  public static get file(): string {
    return path.join(path.dirname(fileURLToPath(import.meta.url)), ...Resources.installRootSegments, ...Resources.productFileSegments);
  }

  public static get current(): ProductInfo {
    ProductInfo.loaded ??= ProductInfo.read(ProductInfo.file);
    return ProductInfo.loaded;
  }

  public static read(file: string): ProductInfo {
    try {
      return new ProductInfo(JsonReader.parse(readFileSync(file, Resources.utf8Encoding)));
    }
    catch (error) {
      throw new ProductFileException(Resources.formatProductFileUnreadable(file, String(error)), new ExceptionOptions(error));
    }
  }
}
