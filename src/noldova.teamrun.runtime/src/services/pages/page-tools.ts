/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IToolDescriptor, ToolRisk } from "@noldova/desktop.runtime";
import type { JsonObject } from "@noldova/context.json";

import { PagesResources } from "./pages-resources.js";

export class PageTools {
  private static readonly DEADLINE: number = 30_000;
  private static readonly MAXIMUM_DEADLINE: number = 120_000;

  public static readonly show: IToolDescriptor = PageTools.descriptor(PagesResources.showPageTool, PagesResources.showPageTitle, PagesResources.showPageDescription, {
    [PagesResources.pathArgument]: PageTools.text(PagesResources.pathDescription),
    [PagesResources.titleArgument]: PageTools.title(PagesResources.pageTitleDescription),
    [PagesResources.pageIdArgument]: PageTools.text(PagesResources.showPageIdDescription),
    [PagesResources.baseVersionArgument]: { type: "integer", minimum: 1, description: PagesResources.showBaseVersionDescription }
  }, [PagesResources.pathArgument, PagesResources.titleArgument], false);

  public static readonly list: IToolDescriptor = PageTools.descriptor(PagesResources.listPagesTool, PagesResources.listPagesTitle, PagesResources.listPagesDescription,
    {}, [], true);

  public static readonly read: IToolDescriptor = PageTools.descriptor(PagesResources.readPageTool, PagesResources.readPageTitle, PagesResources.readPageDescription, {
    [PagesResources.pageIdArgument]: PageTools.text(PagesResources.pageIdDescription),
    [PagesResources.versionArgument]: { type: "integer", minimum: 1, description: PagesResources.versionDescription }
  }, [PagesResources.pageIdArgument], true);

  public static readonly edit: IToolDescriptor = PageTools.descriptor(PagesResources.editPageTool, PagesResources.editPageTitle, PagesResources.editPageDescription, {
    [PagesResources.pageIdArgument]: PageTools.text(PagesResources.pageIdDescription),
    [PagesResources.baseVersionArgument]: { type: "integer", minimum: 1, description: PagesResources.baseVersionDescription },
    [PagesResources.htmlArgument]: { type: "string", description: PagesResources.htmlDescription },
    [PagesResources.editsArgument]: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          [PagesResources.findArgument]: PageTools.text(PagesResources.findDescription),
          [PagesResources.replaceArgument]: { type: "string", description: PagesResources.replaceDescription }
        },
        required: [PagesResources.findArgument, PagesResources.replaceArgument],
        additionalProperties: false
      },
      description: PagesResources.editsDescription
    },
    [PagesResources.titleArgument]: PageTools.title(PagesResources.editTitleDescription)
  }, [PagesResources.pageIdArgument, PagesResources.baseVersionArgument], false);

  public static readonly all: readonly IToolDescriptor[] = [PageTools.show, PageTools.list, PageTools.read, PageTools.edit];

  private static descriptor(name: string, title: string, description: string, properties: JsonObject, required: readonly string[],
    isReadOnly: boolean): IToolDescriptor {
    return {
      name,
      title,
      description,
      inputSchema: { type: "object", properties, required: [...required], additionalProperties: false },
      hints: { isReadOnly, isDestructive: false, isOpenWorld: false },
      risk: { default: ToolRisk.Low, maximum: ToolRisk.Low },
      marksSending: !isReadOnly,
      deadline: { default: PageTools.DEADLINE, maximum: PageTools.MAXIMUM_DEADLINE },
      nextTool: PagesResources.listPagesTool
    };
  }

  private static title(description: string): JsonObject {
    return { type: "string", minLength: 1, maxLength: PagesResources.maximumTitleLength, description };
  }

  private static text(description: string): JsonObject {
    return { type: "string", minLength: 1, description };
  }
}
