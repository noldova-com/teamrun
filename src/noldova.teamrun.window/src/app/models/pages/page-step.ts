/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import { Page } from "@noldova/teamrun.protocol";

import { ChatPagesResources } from "../../services/pages/chat-pages-resources";

export class PageStep {
  public readonly tool: string;
  public readonly input: JsonObject | null;
  public readonly result: string;
  private readonly labels: { readonly running: string; readonly done: string; readonly failed: string };

  private constructor(tool: string, input: JsonObject | null, result: string, labels: { readonly running: string; readonly done: string; readonly failed: string }) {
    this.tool = tool;
    this.input = input;
    this.result = result;
    this.labels = labels;
  }

  public static of(payload: JsonValue, text: string, result: string | null): PageStep | null {
    const fields = PageStep.objectOf(payload);
    const tool = fields?.[ChatPagesResources.toolField];
    const name = Object.isString(tool) ? ChatPagesResources.toolNameEnd.exec(tool)?.[1] ?? String.empty : String.empty;
    const labels = ChatPagesResources.stepLabels.get(name);
    if (Object.isUndefined(labels) || Object.isNull(fields))
      return null;
    const input = PageStep.objectOf(fields[ChatPagesResources.inputField] ?? fields[ChatPagesResources.argumentsField] ?? null);
    const firstLine = text.indexOf(ChatPagesResources.lineSeparator);
    return new PageStep(name, input, result ?? PageStep.acpResultOf(fields) ?? (firstLine < 0 ? String.empty : text.slice(firstLine + 1)), labels);
  }

  public get page(): Page | null {
    if (this.tool !== ChatPagesResources.showPageTool && this.tool !== ChatPagesResources.editPageTool)
      return null;
    try {
      return Page.fromJson(this.value());
    }
    catch {
      return null;
    }
  }

  public get pageId(): string | null {
    const id = this.page?.id ?? (this.tool === ChatPagesResources.editPageTool ? this.input?.[ChatPagesResources.pageIdArgument] : null);
    return Object.isString(id) && !String.isNullOrWhitespace(id) ? id : null;
  }

  public title(isRunning: boolean, isFailed: boolean): string {
    const labels = this.labels;
    if (isRunning) {
      const title = this.input?.[ChatPagesResources.titleArgument];
      return ChatPagesResources.canvasTitledTools.includes(this.tool) && Object.isString(title)
        ? ChatPagesResources.formatStepTitle(labels.running, title) : labels.running;
    }
    if (isFailed)
      return ChatPagesResources.formatStepFailure(labels.failed, PageStep.firstLineOf(this.result));
    const detail = this.detail();
    return Object.isNull(detail) ? labels.done : ChatPagesResources.formatStepTitle(labels.done, detail);
  }

  private detail(): string | null {
    const value = this.value();
    switch (this.tool) {
      case ChatPagesResources.listPagesTool: {
        const pages = PageStep.fieldOf(value, ChatPagesResources.pagesField);
        return Array.isArray(pages) ? ChatPagesResources.formatPageCount(pages.length) : null;
      }
      case ChatPagesResources.readPageTool: {
        const title = PageStep.fieldOf(PageStep.fieldOf(value, ChatPagesResources.pageField), ChatPagesResources.titleField);
        const version = PageStep.fieldOf(value, ChatPagesResources.versionField);
        return Object.isString(title) && Number.isInteger(version) ? ChatPagesResources.formatReadDetail(title, Number(version)) : null;
      }
      case ChatPagesResources.createCanvasTool:
      case ChatPagesResources.readCanvasTool: {
        const title = PageStep.fieldOf(PageStep.fieldOf(value, ChatPagesResources.canvasField), ChatPagesResources.titleField);
        return Object.isString(title) ? title : null;
      }
      case ChatPagesResources.addArtboardTool: {
        const title = PageStep.fieldOf(PageStep.fieldOf(value, ChatPagesResources.artboardField), ChatPagesResources.titleField);
        return Object.isString(title) ? title : null;
      }
      case ChatPagesResources.reviseArtboardTool: {
        const artboard = PageStep.fieldOf(value, ChatPagesResources.artboardField);
        const title = PageStep.fieldOf(artboard, ChatPagesResources.titleField);
        const version = PageStep.fieldOf(artboard, ChatPagesResources.pageVersionField);
        return Object.isString(title) && Number.isInteger(version)
          ? ChatPagesResources.formatStepTitle(title, ChatPagesResources.formatVersion(Number(version))) : null;
      }
      case ChatPagesResources.arrangeCanvasTool: {
        const artboards = this.input?.[ChatPagesResources.artboardsArgument];
        const parts = [
          ...(Array.isArray(artboards) && artboards.length > 0 ? [ChatPagesResources.formatArtboardCount(artboards.length)] : []),
          ...(Object.isUndefined(this.input?.[ChatPagesResources.canvasPagesArgument]) ? [] : [ChatPagesResources.canvasPagesLabel])
        ];
        return parts.length === 0 ? null : parts.join(ChatPagesResources.arrangeJoiner);
      }
      case ChatPagesResources.editPageTool: {
        const base = this.input?.[ChatPagesResources.baseVersionArgument];
        const version = this.page?.version;
        return Number.isInteger(base) && !Object.isUndefined(version) ? ChatPagesResources.formatEditDetail(Number(base), version) : null;
      }
      default: {
        const path = this.input?.[ChatPagesResources.pathArgument] ?? this.page?.path;
        return Object.isString(path) ? ChatPagesResources.fileNamePattern.exec(path)?.[0] ?? null : null;
      }
    }
  }

  private value(): unknown {
    try {
      const value: unknown = JSON.parse(this.result);
      const content = Array.isArray(value) ? value.map(t => PageStep.textOf(t)).find(t => !Object.isNull(t)) ?? null : null;
      return Object.isNull(content) ? value : JSON.parse(content);
    }
    catch {
      return null;
    }
  }

  private static acpResultOf(fields: JsonObject): string | null {
    const content = fields[ChatPagesResources.contentField];
    const texts = Array.isArray(content) ? content.flatMap(t => {
      const text = PageStep.textOf(PageStep.fieldOf(t, ChatPagesResources.contentField));
      return Object.isNull(text) ? [] : [text];
    }) : [];
    return texts.length === 0 ? null : texts.join(ChatPagesResources.lineSeparator);
  }

  private static firstLineOf(text: string): string {
    return text.split(ChatPagesResources.lineSeparator).find(t => !String.isNullOrWhitespace(t))?.trim() ?? String.empty;
  }

  private static textOf(value: unknown): string | null {
    const text = PageStep.fieldOf(value, ChatPagesResources.textField);
    return Object.isString(text) ? text : null;
  }

  private static fieldOf(value: unknown, name: string): unknown {
    return Object.isObject(value) && !Array.isArray(value) ? Reflect.get(value, name) : undefined;
  }

  private static objectOf(value: JsonValue): JsonObject | null {
    return PageStep.isJsonObject(value) ? value : null;
  }

  private static isJsonObject(value: JsonValue): value is JsonObject {
    return Object.isObject(value) && !Array.isArray(value);
  }
}
