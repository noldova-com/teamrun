/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";
import { Organization } from "../organization.js";

export class OrganizationUpdateParams {
  public readonly organizationId: string;
  public readonly name: string;
  public readonly folder: string | null;

  public constructor(organizationId: string, name: string, folder: string | null) {
    ArgumentException.throwIfNullOrWhitespace(organizationId, Resources.organizationIdField);
    Organization.validateName(name);
    Organization.validateFolder(folder);

    this.organizationId = organizationId;
    this.name = name;
    this.folder = folder;
  }

  public static fromJson(value: unknown, path?: string): OrganizationUpdateParams {
    const reader = JsonReader.fromValue(value, path);
    return new OrganizationUpdateParams(reader.readNonBlankString(Resources.organizationIdField), Organization.readName(reader), Organization.readFolder(reader));
  }

  public applyTo(organization: Organization, updatedAt: string): Organization {
    return new Organization(organization.id, this.name, this.folder, organization.order, organization.createdAt, updatedAt,
      organization.departments, organization.placements);
  }

  public toJson(): JsonObject {
    return {
      [Resources.organizationIdField]: this.organizationId,
      [Resources.nameField]: this.name,
      [Resources.folderField]: this.folder
    };
  }
}
