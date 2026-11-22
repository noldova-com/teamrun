/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";
import { Organization } from "../organization.js";

export class OrganizationCreateParams {
  public readonly name: string;
  public readonly folder: string | null;

  public constructor(name: string, folder: string | null) {
    Organization.validateName(name);
    Organization.validateFolder(folder);

    this.name = name;
    this.folder = folder;
  }

  public static fromJson(value: unknown, path?: string): OrganizationCreateParams {
    const reader = JsonReader.fromValue(value, path);
    return new OrganizationCreateParams(Organization.readName(reader), Organization.readFolder(reader));
  }

  public toJson(): JsonObject {
    return {
      [Resources.nameField]: this.name,
      [Resources.folderField]: this.folder
    };
  }
}
