/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import type { IWindowPartContext } from "@noldova/desktop.window";
import { MethodName, OrganizationCreateParams, OrganizationIdParams, OrganizationUpdateParams } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";

export class OrganizationActions {
  public static create(context: IWindowPartContext, name: string): Promise<void> {
    return OrganizationActions.request(context, MethodName.OrganizationCreate, () => new OrganizationCreateParams(name, null).toJson());
  }

  public static rename(context: IWindowPartContext, organizationId: string, name: string): Promise<void> {
    return OrganizationActions.request(context, MethodName.OrganizationUpdate, () => new OrganizationUpdateParams(organizationId, name, undefined).toJson());
  }

  public static setFolder(context: IWindowPartContext, organizationId: string, folder: string | null): Promise<void> {
    return OrganizationActions.request(context, MethodName.OrganizationUpdate, () => new OrganizationUpdateParams(organizationId, undefined, folder).toJson());
  }

  public static remove(context: IWindowPartContext, organizationId: string): Promise<void> {
    return OrganizationActions.request(context, MethodName.OrganizationDelete, () => new OrganizationIdParams(organizationId).toJson());
  }

  private static async request(context: IWindowPartContext, method: MethodName, parametersOf: () => JsonValue): Promise<void> {
    try {
      await context.requestAsync(Resources.formatQualifiedName(method), parametersOf());
    }
    catch (error) {
      context.log(Resources.formatOrganizationActionFailed(String(error)));
    }
  }
}
