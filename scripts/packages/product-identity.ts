/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import PackageException from "./package.exception.ts";

export default class ProductIdentity {
  private static readonly FILE_NAME: string = "package.json";
  private static readonly SETTINGS: string = "teamrun";
  private static readonly SECTION: string = "product";
  private static readonly APPLICATION_ID: RegExp = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9-]*)+$/;
  private static readonly SLUG: RegExp = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
  private static readonly VARIABLE: RegExp = /^[A-Z][A-Z0-9_]*$/;
  private static readonly UNSAFE_NAME: RegExp = /["\\\n\r]/;
  private static readonly UNSAFE_SEGMENT: RegExp = /[\\:*?"<>|]/;
  private static readonly SEPARATOR: string = "/";
  private static readonly CHECKOUT_HASH_ALGORITHM: string = "sha256";
  private static readonly CHECKOUT_HASH_LENGTH: number = 8;

  public readonly name: string;
  public readonly publisher: string;
  public readonly slug: string;
  public readonly applicationId: string;
  public readonly developmentApplicationId: string;
  public readonly dataFolder: string;
  public readonly windowsDeviceFolder: string;
  public readonly macosDeviceFolder: string;
  public readonly linuxDeviceFolder: string;
  public readonly dataDirectoryVariable: string;
  public readonly icons: string;

  public constructor(
    name: string,
    publisher: string,
    slug: string,
    applicationId: string,
    developmentApplicationId: string,
    dataFolder: string,
    deviceFolders: readonly [windows: string, macos: string, linux: string],
    dataDirectoryVariable: string,
    icons: string) {
    const [windows, macos, linux] = deviceFolders;
    ProductIdentity.require(name.trim().length > 0 && !ProductIdentity.UNSAFE_NAME.test(name), "name", "a name without quotes, backslashes or line breaks");
    ProductIdentity.require(publisher.trim().length > 0 && !ProductIdentity.UNSAFE_NAME.test(publisher), "publisher", "a name without quotes, backslashes or line breaks");
    ProductIdentity.require(ProductIdentity.SLUG.test(slug), "slug", "lowercase kebab-case");
    ProductIdentity.require(ProductIdentity.APPLICATION_ID.test(applicationId), "applicationId", "a lowercase reverse-DNS ID");
    ProductIdentity.require(ProductIdentity.APPLICATION_ID.test(developmentApplicationId) && developmentApplicationId !== applicationId,
      "developmentApplicationId", "a lowercase reverse-DNS ID other than applicationId");
    for (const [field, folder] of [["dataFolder", dataFolder], ["deviceFolders.windows", windows], ["deviceFolders.macos", macos], ["deviceFolders.linux", linux], ["icons", icons]] as const)
      ProductIdentity.require(ProductIdentity.isRelativeFolder(folder), field, "a relative folder whose segments are separated by /");
    ProductIdentity.require(ProductIdentity.VARIABLE.test(dataDirectoryVariable), "dataDirectoryVariable", "an uppercase environment variable name");

    this.name = name;
    this.publisher = publisher;
    this.slug = slug;
    this.applicationId = applicationId;
    this.developmentApplicationId = developmentApplicationId;
    this.dataFolder = dataFolder;
    this.windowsDeviceFolder = windows;
    this.macosDeviceFolder = macos;
    this.linuxDeviceFolder = linux;
    this.dataDirectoryVariable = dataDirectoryVariable;
    this.icons = icons;
  }

  public static async readAsync(root: string): Promise<ProductIdentity> {
    let manifest: unknown;
    try {
      manifest = JSON.parse(await readFile(path.join(root, ProductIdentity.FILE_NAME), "utf8"));
    }
    catch (error) {
      throw new PackageException(ProductIdentity.formatMissing(), { cause: error });
    }
    return ProductIdentity.fromManifest(manifest);
  }

  public static fromManifest(manifest: unknown): ProductIdentity {
    const product = ProductIdentity.readRecord(ProductIdentity.readRecord(manifest, ProductIdentity.SETTINGS), ProductIdentity.SECTION);
    if (product === null)
      throw new PackageException(ProductIdentity.formatMissing());
    const folders = ProductIdentity.readRecord(product, "deviceFolders");
    return new ProductIdentity(
      ProductIdentity.readText(product, "name"),
      ProductIdentity.readText(product, "publisher"),
      ProductIdentity.readText(product, "slug"),
      ProductIdentity.readText(product, "applicationId"),
      ProductIdentity.readText(product, "developmentApplicationId"),
      ProductIdentity.readText(product, "dataFolder"),
      [ProductIdentity.readText(folders, "windows"), ProductIdentity.readText(folders, "macos"), ProductIdentity.readText(folders, "linux")],
      ProductIdentity.readText(product, "dataDirectoryVariable"),
      ProductIdentity.readText(product, "icons"));
  }

  public get placeholders(): ReadonlyMap<string, string> {
    return new Map([
      ["__PRODUCT_NAME__", this.name],
      ["__PRODUCT_SLUG__", this.slug],
      ["__APPLICATION_ID__", this.applicationId],
      ["__DEVELOPMENT_APPLICATION_ID__", this.developmentApplicationId],
      ["__DATA_FOLDER__", this.dataFolder],
      ["__WINDOWS_DEVICE_FOLDER__", this.windowsDeviceFolder],
      ["__MACOS_DEVICE_FOLDER__", this.macosDeviceFolder],
      ["__LINUX_DEVICE_FOLDER__", this.linuxDeviceFolder],
      ["__DATA_DIRECTORY_VARIABLE__", this.dataDirectoryVariable],
      ["__ICONS_FOLDER__", this.icons]
    ]);
  }

  public get literals(): readonly string[] {
    return [...new Set([
      this.name,
      this.applicationId,
      this.developmentApplicationId,
      this.dataFolder,
      this.windowsDeviceFolder,
      this.macosDeviceFolder,
      this.linuxDeviceFolder,
      this.dataDirectoryVariable,
      this.icons
    ])];
  }

  public formatDevelopmentApplicationId(checkout: string): string {
    const hash = createHash(ProductIdentity.CHECKOUT_HASH_ALGORITHM).update(path.resolve(checkout)).digest("hex").slice(0, ProductIdentity.CHECKOUT_HASH_LENGTH);
    return `${this.developmentApplicationId}.${hash}`;
  }

  private static isRelativeFolder(folder: string): boolean {
    return folder.split(ProductIdentity.SEPARATOR).every(t => t.length > 0 && t !== "." && t !== ".." && !ProductIdentity.UNSAFE_SEGMENT.test(t));
  }

  private static readRecord(value: unknown, field: string): Readonly<Record<string, unknown>> | null {
    if (typeof value !== "object" || value === null)
      return null;
    const child: unknown = Reflect.get(value, field);
    return typeof child === "object" && child !== null && !Array.isArray(child) ? { ...child } : null;
  }

  private static readText(record: Readonly<Record<string, unknown>> | null, field: string): string {
    const value = record?.[field];
    return typeof value === "string" ? value : "";
  }

  private static require(isValid: boolean, field: string, expected: string): void {
    if (!isValid)
      throw new PackageException(`The root ${ProductIdentity.FILE_NAME}'s ${ProductIdentity.SETTINGS}.${ProductIdentity.SECTION}.${field} must be ${expected}.`);
  }

  private static formatMissing(): string {
    return `The root ${ProductIdentity.FILE_NAME} must declare ${ProductIdentity.SETTINGS}.${ProductIdentity.SECTION}.`;
  }
}
