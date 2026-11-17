/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { MessageAttachment } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources.js";
import { HandoverHistory } from "./handover-history.js";
import type { HandoverSummary } from "./handover-summary.js";
import type { HandoverTurn } from "./handover-turn.js";

export class Handover {
  private static readonly separatorBytes: number = Buffer.byteLength(Resources.transcriptSeparator, Resources.utf8Encoding);

  public static budgetOf(windowTokens: number | null, reserved: readonly string[], attachments: readonly MessageAttachment[],
    maximum: number = Resources.handoverMaximumBytes): number {
    const window = windowTokens ?? Resources.handoverDefaultWindowTokens;
    const room = Math.max(Resources.handoverProviderRoomTokens, Math.floor(window / Resources.handoverProviderRoomShare));
    const files = attachments.reduce((sum, t) => sum + (t.isImage ? Resources.handoverImageTokens : Resources.handoverFileTokens), 0);
    const kept = reserved.reduce((sum, t) => sum + Handover.bytesOf(t), files);
    return Math.min(maximum, window - room - kept);
  }

  public static build(chatId: string, turns: readonly HandoverTurn[], budget: number, summary: HandoverSummary | null = null): string | null {
    return Handover.choose(chatId, turns, budget, summary)?.text ?? null;
  }

  public static choose(chatId: string, turns: readonly HandoverTurn[], budget: number, summary: HandoverSummary | null = null): HandoverHistory | null {
    const open = turns.flatMap((turn, index) => index === 0 || Object.isNull(summary) || turn.sequence > summary.through
      ? [{ index, size: Handover.bytesOf(turn.text + Resources.transcriptSeparator) }] : []);
    const whole = Object.isNull(summary) ? String.empty : Resources.formatHandoverSummary(summary.text);
    const all = new Set(open.map(t => t.index));
    const total = open.reduce((sum, t) => sum + t.size, Handover.bytesOf(whole) + (whole.length === 0 ? 0 : Handover.separatorBytes));
    if (Handover.sizeOf(total, Handover.leftOutOf(chatId, turns, all)) <= budget)
      return new HandoverHistory(Handover.compose(chatId, turns, all, whole), all, Handover.coveredOf(turns, all, whole.length === 0 ? null : summary));
    const kept = new Set<number>();
    if (Handover.sizeOf(0, Handover.leftOutOf(chatId, turns, kept)) > budget)
      return null;
    const [first, ...rest] = open;
    let used = 0;
    if (!Object.isUndefined(first) && Handover.fits(chatId, turns, kept, first.index, used + first.size, budget))
      used += first.size;
    const line = (): number => Handover.sizeOf(used, Handover.leftOutOf(chatId, turns, kept)) - used;
    const taken = whole.length === 0 ? String.empty : Handover.cutTo(whole, budget - used - line() - Handover.separatorBytes);
    used += taken.length === 0 ? 0 : Handover.bytesOf(taken) + Handover.separatorBytes;
    for (const turn of rest.reverse()) {
      if (!Handover.fits(chatId, turns, kept, turn.index, used + turn.size, budget))
        break;
      used += turn.size;
    }
    return new HandoverHistory(Handover.compose(chatId, turns, kept, taken), kept, Handover.coveredOf(turns, kept, taken.length === 0 ? null : summary));
  }

  public static carriedOf(turns: readonly HandoverTurn[], kept: ReadonlySet<number>, first: string | null, summary: HandoverSummary | null = null,
    covered: ReadonlySet<number> = new Set<number>()): string[] {
    if (kept.size === turns.length)
      return turns.length === 0 ? [] : [Handover.wholeOf(turns, () => true)];
    const line = Handover.summaryLineOf(turns, covered, summary);
    const told = (index: number): boolean => kept.has(index) || (line.length > 0 && covered.has(index));
    const whole = turns.some((_, index) => index > 0 && kept.has(index)) ? [Handover.wholeOf(turns, index => index > 0 && kept.has(index))] : [];
    const leftOut = Handover.rangesOf(turns, index => !told(index));
    return [...kept.has(0) ? [Resources.formatHandoverCarriedFirst(first)] : [], ...line, ...whole,
      ...leftOut.length === 0 ? [] : [Resources.formatHandoverCarriedLeftOut(leftOut)]];
  }

  public static cut(result: string, sequence: number): string {
    const size = Handover.bytesOf(result);
    if (size <= Resources.handoverResultBytes)
      return result;
    const [start, end] = Handover.endsOf(result, Resources.handoverResultBytes / 2);
    const left = size - Handover.bytesOf(start) - Handover.bytesOf(end);
    return [start, Resources.formatHandoverCut(left, sequence), end].join(Resources.lineSeparator);
  }

  public static bytesOf(text: string): number {
    return Buffer.byteLength(text, Resources.utf8Encoding);
  }

  private static fits(chatId: string, turns: readonly HandoverTurn[], kept: Set<number>, index: number, used: number, budget: number): boolean {
    kept.add(index);
    if (Handover.sizeOf(used, Handover.leftOutOf(chatId, turns, kept)) <= budget)
      return true;
    kept.delete(index);
    return false;
  }

  private static compose(chatId: string, turns: readonly HandoverTurn[], kept: ReadonlySet<number>, summary: string): string {
    const texts = turns.flatMap((turn, index) => kept.has(index) ? [turn.text] : []);
    const at = kept.has(0) ? 1 : 0;
    const line = Handover.leftOutOf(chatId, turns, kept);
    return [...texts.slice(0, at), ...summary.length === 0 ? [] : [summary], ...texts.slice(at), ...line.length === 0 ? [] : [line]]
      .join(Resources.transcriptSeparator);
  }

  private static cutTo(text: string, bytes: number): string {
    const size = Handover.bytesOf(text);
    if (size <= bytes)
      return text;
    const marker = Resources.formatHandoverSummaryCut(size);
    const half = Math.floor((bytes - Handover.bytesOf(marker) - 2 * Handover.bytesOf(Resources.lineSeparator)) / 2);
    if (half <= 0)
      return String.empty;
    const [start, end] = Handover.endsOf(text, half);
    return [start, Resources.formatHandoverSummaryCut(size - Handover.bytesOf(start) - Handover.bytesOf(end)), end].join(Resources.lineSeparator);
  }

  private static endsOf(text: string, half: number): readonly [string, string] {
    const characters = [...text];
    const start = characters.slice(0, Handover.countOf(characters, half)).join(String.empty);
    const end = characters.slice(characters.length - Handover.countOf(characters.toReversed(), half)).join(String.empty);
    return [start, end];
  }

  private static sizeOf(used: number, line: string): number {
    return line.length > 0 ? used + Handover.bytesOf(line) : Math.max(0, used - Handover.bytesOf(Resources.transcriptSeparator));
  }

  private static countOf(characters: readonly string[], bytes: number): number {
    let taken = 0;
    let count = 0;
    for (const character of characters) {
      taken += Handover.bytesOf(character);
      if (taken > bytes)
        break;
      count++;
    }
    return count;
  }

  private static summaryLineOf(turns: readonly HandoverTurn[], covered: ReadonlySet<number>, summary: HandoverSummary | null): string[] {
    const bounds = Handover.rangesOf(turns, index => covered.has(index)).flat();
    return Object.isNull(summary) || Object.isNull(summary.author) || bounds.length === 0 ? []
      : [Resources.formatHandoverCarriedSummary(summary.author, summary.isCompaction, Math.min(...bounds), Math.max(...bounds))];
  }

  private static coveredOf(turns: readonly HandoverTurn[], kept: ReadonlySet<number>, summary: HandoverSummary | null): ReadonlySet<number> {
    return new Set(Object.isNull(summary) || Object.isNull(summary.author) ? []
      : turns.flatMap((turn, index) => !kept.has(index) && turn.sequence <= summary.through ? [index] : []));
  }

  private static leftOutOf(chatId: string, turns: readonly HandoverTurn[], kept: ReadonlySet<number>): string {
    const ranges = Handover.rangesOf(turns, index => !kept.has(index)).map(([from, to]) => from === to ? `${from}` : Resources.formatHandoverRange(from, to));
    return ranges.length === 0 ? String.empty : Resources.formatHandoverLeftOut(ranges, chatId);
  }

  private static wholeOf(turns: readonly HandoverTurn[], carried: (index: number) => boolean): string {
    const chosen = turns.filter((_, index) => carried(index));
    return Resources.formatHandoverCarriedWhole(Handover.rangesOf(turns, carried), chosen.some(t => t.tools), chosen.filter(t => t.cut).map(t => t.sequence));
  }

  private static rangesOf(turns: readonly HandoverTurn[], chosen: (index: number) => boolean): (readonly [number, number])[] {
    const ranges: (readonly [number, number])[] = [];
    let from: number | null = null;
    for (const [index, turn] of turns.entries()) {
      if (!chosen(index))
        continue;
      from ??= turn.sequence;
      if (index === turns.length - 1 || !chosen(index + 1)) {
        ranges.push([from, turn.sequence]);
        from = null;
      }
    }
    return ranges;
  }
}
