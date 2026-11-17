/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type ITurnListener, TurnDetail } from "@noldova/teamrun.core";
import { DetailKind } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources.js";

export class AcpBackgroundReplies {
  private readonly listener: ITurnListener;
  private readonly contents: Map<string, { readonly text: string; readonly at: number }[]> = new Map();
  private readonly marks: Map<string, number> = new Map();
  private at: number = 0;

  public constructor(listener: ITurnListener) {
    this.listener = listener;
  }

  public static repliesOf(output: string): readonly string[] | null {
    const [header, ...turns] = output.split(Resources.copilotTurnPattern);
    const status = Resources.copilotAgentStatusPattern.exec(String(header))?.[1];
    return Object.isUndefined(status) || !Resources.copilotFinishedStatuses.includes(status) ? null : turns.map(t => t.trim()).filter(t => t.length > 0);
  }

  public noteText(contentId: string, text: string): void {
    const chunks = this.contents.get(contentId) ?? [];
    chunks.push({ text, at: ++this.at });
    this.contents.set(contentId, chunks);
  }

  public mark(toolCallId: string): void {
    if (!this.marks.has(toolCallId))
      this.marks.set(toolCallId, ++this.at);
  }

  public async takeAsync(spawnId: string, readId: string, replies: readonly string[]): Promise<readonly string[]> {
    const from = this.marks.get(spawnId) ?? Number.POSITIVE_INFINITY;
    const to = this.marks.get(readId) ?? 0;
    const taken: string[] = [];
    for (const reply of replies)
      if (await this.cutAsync(reply, from, to))
        taken.push(reply);
    return taken;
  }

  public clear(): void {
    this.contents.clear();
    this.marks.clear();
  }

  private async cutAsync(reply: string, from: number, to: number): Promise<boolean> {
    const runs = [...this.contents].flatMap(([id, chunks]) => AcpBackgroundReplies.runsOf(chunks, reply, from, to).map(([start, end]) => ({ id, chunks, start, end })));
    const [only] = runs;
    if (runs.length !== 1 || Object.isUndefined(only))
      return false;
    only.chunks.splice(only.start, only.end - only.start);
    await this.listener.onDetailAsync(new TurnDetail(DetailKind.Text, only.chunks.map(t => t.text).join(String.empty), null, only.id));
    return true;
  }

  private static runsOf(chunks: readonly { readonly text: string; readonly at: number }[], reply: string, from: number, to: number): [number, number][] {
    const runs: [number, number][] = [];
    chunks.forEach((first, start) => {
      if (first.at < from || String.isNullOrWhitespace(first.text))
        return;
      let text = String.empty;
      for (const [offset, chunk] of chunks.slice(start).entries()) {
        if (chunk.at > to || text.trimStart().length > reply.length)
          break;
        text += chunk.text;
        if (!String.isNullOrWhitespace(chunk.text) && text.trim() === reply)
          runs.push([start, start + offset + 1]);
      }
    });
    return runs;
  }
}
