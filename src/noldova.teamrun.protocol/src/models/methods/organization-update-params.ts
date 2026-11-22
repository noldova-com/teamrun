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
  public readonly name: string | undefined;
  public readonly folder: string | null | undefined;

  public constructor(organizationId: string, name: string | undefined, folder: string | null | undefined) {
    ArgumentException.throwIfNullOrWhitespace(organizationId, Resources.organizationIdField);
    if (Object.isUndefined(name) && Object.isUndefined(folder))
      throw new ArgumentException(Resources.emptyOrganizationUpdate, Resources.organizationIdField);
    if (!Object.isUndefined(name))
      Organization.validateName(name);
    if (!Object.isUndefined(folder))
      Organization.validateFolder(folder);

    this.organizationId = organizationId;
    this.name = name;
    this.folder = folder;
  }

  public static fromJson(value: unknown, path?: string): OrganizationUpdateParams {
    const reader = JsonReader.fromValue(value, path);
    return new OrganizationUpdateParams(reader.readNonBlankString(Resources.organizationIdField),
      reader.hasField(Resources.nameField) ? Organization.readName(reader) : undefined,
      reader.hasField(Resources.folderField) ? Organization.readFolder(reader) : undefined);
  }

  public applyTo(organization: Organization, updatedAt: string): Organization {
    return new Organization(organization.id, this.name ?? organization.name, Object.isUndefined(this.folder) ? organization.folder : this.folder,
      organization.order, organization.createdAt, updatedAt,
      organization.departments, organization.placements);
  }

  public toJson(): JsonObject {
    return {
      [Resources.organizationIdField]: this.organizationId,
      ...Object.isUndefined(this.name) ? {} : { [Resources.nameField]: this.name },
      ...Object.isUndefined(this.folder) ? {} : { [Resources.folderField]: this.folder }
    };
  }
}
