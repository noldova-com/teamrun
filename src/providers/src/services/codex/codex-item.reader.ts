/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { JsonReader } from "@noldova/teamrun-foundation-json";
import { TurnDetail } from "@noldova/teamrun-core";
import { DetailKind } from "@noldova/teamrun-protocol";

import { Resources } from "../../resources.js";

export class CodexItemReader {
  public readStarted(item: JsonReader): TurnDetail | null {
    if (item.readNonBlankString(Resources.typeField) !== Resources.commandExecutionItemType)
      return null;

    const id = `${item.readNonBlankString(Resources.idField)}${Resources.requestIdSeparator}${Resources.startedSuffix}`;
    const text = `${Resources.runningPrefix}${item.readString(Resources.commandField)}`.slice(0, Resources.maximumSummaryLength);

    return new TurnDetail(DetailKind.Note, text, null, id);
  }

  public readCompleted(item: JsonReader): TurnDetail | null {
    const id = item.readNonBlankString(Resources.idField);
    switch (item.readNonBlankString(Resources.typeField)) {
      case Resources.agentMessageItemType:
        return CodexItemReader.readText(DetailKind.Text, item.readString(Resources.textField), id);
      case Resources.reasoningItemType:
        return CodexItemReader.readReasoning(item, id);
      case Resources.planItemType:
        return new TurnDetail(DetailKind.Text, `${Resources.planPrefix}${Resources.lineSeparator}${item.readString(Resources.textField)}`, null, id);
      case Resources.commandExecutionItemType:
        return CodexItemReader.readCommand(item, id);
      case Resources.fileChangeItemType:
        return CodexItemReader.readFileChange(item, id);
      case Resources.mcpToolCallItemType:
        return CodexItemReader.readMcpToolCall(item, id);
      case Resources.dynamicToolCallItemType:
        return CodexItemReader.readToolCall(item, id);
      case Resources.webSearchItemType:
        return new TurnDetail(DetailKind.Note, Resources.formatWebSearch(item.readString(Resources.queryField)), null, id);
      case Resources.contextCompactionItemType:
        return new TurnDetail(DetailKind.Note, Resources.contextCompacted, null, id);
      case Resources.userMessageItemType:
        return null;
      case Resources.imageGenerationItemType:
        return CodexItemReader.readImageGeneration(item, id);
      default:
        return CodexItemReader.readUnknown(item, id);
    }
  }

  private static readImageGeneration(item: JsonReader, id: string): TurnDetail {
    const status = item.readString(Resources.statusField);
    const savedPath = item.hasField(Resources.savedPathField) ? item.readNullableString(Resources.savedPathField) : null;
    const revisedPrompt = item.hasField(Resources.revisedPromptField) ? item.readNullableString(Resources.revisedPromptField) : null;
    const failure = item.hasField(Resources.failureField) ? item.readValue(Resources.failureField) : null;
    const result = item.hasField(Resources.resultField) ? item.readNullableString(Resources.resultField) : null;
    const mediaType = CodexItemReader.imageMediaTypeOf(result);
    const payload = {
      itemType: Resources.imageGenerationItemType, status, savedPath, revisedPrompt, failure,
      imageData: Object.isNull(mediaType) ? null : result, mediaType
    };

    return new TurnDetail(DetailKind.Note, Resources.formatGeneratedImage(status, savedPath), payload, id);
  }

  private static imageMediaTypeOf(result: string | null): string | null {
    if (Object.isNull(result) || result.length > Resources.maximumImageDataLength || !Resources.base64Pattern.test(result))
      return null;
    for (const [signature, mediaType] of Object.entries(Resources.imageSignatures))
      if (result.startsWith(signature))
        return mediaType;

    return null;
  }

  private static readUnknown(item: JsonReader, id: string): TurnDetail {
    const type = item.readNonBlankString(Resources.typeField);
    const json = item.toJson();
    const payload = JSON.stringify(json).length <= Resources.maximumItemJsonLength ? { itemType: type, item: json } : { itemType: type };

    return new TurnDetail(DetailKind.Note, Resources.formatUnknownItem(type), payload, id);
  }

  private static readText(kind: DetailKind, text: string, id: string): TurnDetail | null {
    return String.isNullOrWhitespace(text) ? null : new TurnDetail(kind, text, null, id);
  }

  private static readReasoning(item: JsonReader, id: string): TurnDetail | null {
    const summary = item.hasField(Resources.summaryField) ? item.readStringArray(Resources.summaryField) : [];
    return CodexItemReader.readText(DetailKind.Reasoning, summary.join(Resources.lineSeparator).slice(0, Resources.maximumReasoningLength), id);
  }

  private static readCommand(item: JsonReader, id: string): TurnDetail {
    const command = item.readString(Resources.commandField);
    const exitCode = item.hasField(Resources.exitCodeField) ? item.readNullableInteger(Resources.exitCodeField) : null;
    const status = item.readString(Resources.statusField);
    const cwd = item.hasField(Resources.cwdField) ? item.readValue(Resources.cwdField) : null;
    const output = item.hasField(Resources.aggregatedOutputField) ? item.readNullableString(Resources.aggregatedOutputField) ?? String.empty : String.empty;
    const shownOutput = output.length > Resources.maximumCommandOutputLength
      ? `${Resources.ellipsis}${output.slice(-Resources.maximumCommandOutputLength)}`
      : output;

    return new TurnDetail(DetailKind.Command, Resources.formatCommandStatus(command, shownOutput, exitCode), { command, cwd, exitCode, status }, id);
  }

  private static readFileChange(item: JsonReader, id: string): TurnDetail {
    const status = item.readString(Resources.statusField);
    const changes = item.readObjectArray(Resources.changesField);
    const files = changes.map(t => t.readString(Resources.pathField));
    const descriptions = changes.map(t => Resources.formatFileChange(CodexItemReader.describeKind(t), t.readString(Resources.pathField)));
    const described = changes.map(t => ({
      path: t.readString(Resources.pathField),
      kind: CodexItemReader.describeKind(t),
      diff: t.hasField(Resources.diffField) ? t.readNullableString(Resources.diffField) : null
    }));

    const text = Resources.formatFileChanges(status, descriptions.join(Resources.listSeparator));
    return new TurnDetail(DetailKind.FileChange, text, { files, status, changes: described }, id);
  }

  private static describeKind(change: JsonReader): string {
    const kind = change.hasField(Resources.kindField) ? change.readValue(Resources.kindField) : null;
    return Object.isString(kind) ? kind : JSON.stringify(kind);
  }

  private static readMcpToolCall(item: JsonReader, id: string): TurnDetail {
    const server = item.readString(Resources.serverField);
    const tool = item.readString(Resources.toolField);
    const status = item.readString(Resources.statusField);

    return new TurnDetail(DetailKind.Note, Resources.formatMcpToolCall(server, tool, status), { server, tool, status }, id);
  }

  private static readToolCall(item: JsonReader, id: string): TurnDetail {
    const tool = item.readString(Resources.toolField);
    const status = item.readString(Resources.statusField);

    return new TurnDetail(DetailKind.Note, Resources.formatToolCall(tool, status), { tool, status }, id);
  }
}
