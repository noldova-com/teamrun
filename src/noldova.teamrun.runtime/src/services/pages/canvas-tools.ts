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

export class CanvasTools {
  private static readonly DEADLINE: number = 30_000;
  private static readonly MAXIMUM_DEADLINE: number = 120_000;

  public static readonly create: IToolDescriptor = CanvasTools.descriptor(PagesResources.createCanvasTool, PagesResources.createCanvasTitle,
    PagesResources.createCanvasDescription, {
      [PagesResources.titleArgument]: CanvasTools.title(PagesResources.canvasTitleDescription),
      [PagesResources.pageNamesArgument]: {
        type: "array", minItems: 1, maxItems: PagesResources.maximumCanvasPages, items: CanvasTools.title(PagesResources.pageNameDescription),
        description: PagesResources.pageNamesDescription
      }
    }, [PagesResources.titleArgument], false);

  public static readonly read: IToolDescriptor = CanvasTools.descriptor(PagesResources.readCanvasTool, PagesResources.readCanvasTitle,
    PagesResources.readCanvasDescription, {
      [PagesResources.canvasIdArgument]: CanvasTools.text(PagesResources.canvasIdDescription),
      [PagesResources.versionArgument]: CanvasTools.version(PagesResources.canvasVersionDescription)
    }, [PagesResources.canvasIdArgument], true);

  public static readonly addArtboard: IToolDescriptor = CanvasTools.descriptor(PagesResources.addArtboardTool, PagesResources.addArtboardTitle,
    PagesResources.addArtboardDescription, {
      [PagesResources.canvasIdArgument]: CanvasTools.text(PagesResources.canvasIdDescription),
      [PagesResources.baseVersionArgument]: CanvasTools.version(PagesResources.canvasBaseVersionDescription),
      [PagesResources.pathArgument]: CanvasTools.text(PagesResources.artboardPathDescription),
      [PagesResources.titleArgument]: CanvasTools.title(PagesResources.artboardTitleDescription),
      [PagesResources.canvasPageArgument]: CanvasTools.title(PagesResources.canvasPageDescription),
      ...CanvasTools.place()
    }, [PagesResources.canvasIdArgument, PagesResources.baseVersionArgument, PagesResources.pathArgument, PagesResources.titleArgument], false);

  public static readonly reviseArtboard: IToolDescriptor = CanvasTools.descriptor(PagesResources.reviseArtboardTool, PagesResources.reviseArtboardTitle,
    PagesResources.reviseArtboardDescription, {
      [PagesResources.canvasIdArgument]: CanvasTools.text(PagesResources.canvasIdDescription),
      [PagesResources.baseVersionArgument]: CanvasTools.version(PagesResources.canvasBaseVersionDescription),
      [PagesResources.artboardIdArgument]: CanvasTools.text(PagesResources.artboardIdDescription),
      [PagesResources.pathArgument]: CanvasTools.text(PagesResources.artboardPathDescription),
      [PagesResources.htmlArgument]: { type: "string", description: PagesResources.htmlDescription },
      [PagesResources.editsArgument]: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          properties: {
            [PagesResources.findArgument]: CanvasTools.text(PagesResources.findDescription),
            [PagesResources.replaceArgument]: { type: "string", description: PagesResources.replaceDescription }
          },
          required: [PagesResources.findArgument, PagesResources.replaceArgument],
          additionalProperties: false
        },
        description: PagesResources.editsDescription
      },
      [PagesResources.titleArgument]: CanvasTools.title(PagesResources.reviseTitleDescription)
    }, [PagesResources.canvasIdArgument, PagesResources.baseVersionArgument, PagesResources.artboardIdArgument], false);

  public static readonly arrange: IToolDescriptor = CanvasTools.descriptor(PagesResources.arrangeCanvasTool, PagesResources.arrangeCanvasTitle,
    PagesResources.arrangeCanvasDescription, {
      [PagesResources.canvasIdArgument]: CanvasTools.text(PagesResources.canvasIdDescription),
      [PagesResources.baseVersionArgument]: CanvasTools.version(PagesResources.canvasBaseVersionDescription),
      [PagesResources.artboardsArgument]: {
        type: "array",
        maxItems: PagesResources.maximumArtboards,
        items: {
          type: "object",
          properties: {
            [PagesResources.idArgument]: CanvasTools.text(PagesResources.artboardIdDescription),
            ...CanvasTools.place(),
            [PagesResources.canvasPageArgument]: CanvasTools.title(PagesResources.canvasPageDescription),
            [PagesResources.titleArgument]: CanvasTools.title(PagesResources.artboardTitleDescription),
            [PagesResources.lockedArgument]: { type: "boolean", description: PagesResources.lockedDescription },
            [PagesResources.hiddenArgument]: { type: "boolean", description: PagesResources.hiddenDescription },
            [PagesResources.groupArgument]: { type: ["string", "null"], minLength: 1, maxLength: PagesResources.maximumTitleLength, description: PagesResources.groupDescription },
            [PagesResources.removeArgument]: { type: "boolean", description: PagesResources.removeDescription }
          },
          required: [PagesResources.idArgument],
          additionalProperties: false
        },
        description: PagesResources.arrangeArtboardsDescription
      },
      [PagesResources.pageNamesArgument]: {
        type: "array",
        minItems: 1,
        maxItems: PagesResources.maximumCanvasPages,
        items: {
          type: "object",
          properties: {
            [PagesResources.idArgument]: CanvasTools.title(PagesResources.canvasPageIdDescription),
            [PagesResources.nameArgument]: CanvasTools.title(PagesResources.pageNameDescription)
          },
          required: [PagesResources.nameArgument],
          additionalProperties: false
        },
        description: PagesResources.arrangePagesDescription
      }
    }, [PagesResources.canvasIdArgument, PagesResources.baseVersionArgument], false);

  public static readonly all: readonly IToolDescriptor[] = [CanvasTools.create, CanvasTools.read, CanvasTools.addArtboard, CanvasTools.reviseArtboard,
    CanvasTools.arrange];

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
      deadline: { default: CanvasTools.DEADLINE, maximum: CanvasTools.MAXIMUM_DEADLINE },
      nextTool: PagesResources.readCanvasTool
    };
  }

  private static place(): JsonObject {
    return {
      [PagesResources.xArgument]: { type: "number", description: PagesResources.xDescription },
      [PagesResources.yArgument]: { type: "number", description: PagesResources.yDescription },
      [PagesResources.widthArgument]: { type: "number", exclusiveMinimum: 0, description: PagesResources.widthDescription },
      [PagesResources.heightArgument]: { type: "number", exclusiveMinimum: 0, description: PagesResources.heightDescription }
    };
  }

  private static version(description: string): JsonObject {
    return { type: "integer", minimum: 1, description };
  }

  private static title(description: string): JsonObject {
    return { type: "string", minLength: 1, maxLength: PagesResources.maximumTitleLength, description };
  }

  private static text(description: string): JsonObject {
    return { type: "string", minLength: 1, description };
  }
}
