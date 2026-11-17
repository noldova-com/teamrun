/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { TimeFormatService } from "../../../src/app/services/time-format.service";
import { FakeWindowPartContext } from "../../fixtures/fake-window-part-context.fixture";

describe("TimeFormatService", () => {
  const at = new Date(2026, 9, 22, 13, 5).getTime();
  let context: FakeWindowPartContext;

  beforeEach(() => {
    context = new FakeWindowPartContext();
  });

  afterEach(() => {
    TimeFormatService.release(context);
  });

  it("writes times in Noldova Desktop's 12-hour defaults until a window part registers, then in its formats, as a 24-hour setting and a change back to 12-hour", () => {
    const times = TestBed.inject(TimeFormatService);
    const shown = computed(() => [times.time(at), times.dateTime(at)]);
    const before = shown();
    context.changeSetting("desktop.timeFormat", "HH:mm");
    context.changeSetting("desktop.dateTimeFormat", "d MMM yyyy, HH:mm");
    TimeFormatService.register(context);
    const twentyFourHour = shown();
    context.changeSetting("desktop.timeFormat", "h:mm:ss a");
    context.changeSetting("desktop.dateTimeFormat", "MMM d, yyyy, h:mm a");

    expect([before, twentyFourHour, shown()]).toEqual([["1:05 PM", "Oct 22, 2026, 1:05 PM"], ["13:05", "22 Oct 2026, 13:05"], ["1:05:00 PM", "Oct 22, 2026, 1:05 PM"]]);
    expect(context.watchedSettings).toEqual(["desktop.timeFormat", "desktop.dateTimeFormat"]);
  });

  it("writes a short date, and a short date and time, in the date-and-time format's order without its year or weekday", () => {
    const times = TestBed.inject(TimeFormatService);
    const short = (pattern: string): readonly string[] => {
      context.changeSetting("desktop.dateTimeFormat", pattern);
      return [times.shortDateTime(at), times.shortDate(at)];
    };
    const before = [times.shortDateTime(at), times.shortDate(at)];
    TimeFormatService.register(context);

    expect([before, short("d MMM yyyy, HH:mm"), short("yyyy-MM-dd HH:mm"), short("EEE, dd/MM/yy 'at' HH:mm"), short("HH:mm, d MMMM yyyy"), short("HH:mm")]).toEqual([
      ["Oct 22, 1:05 PM", "Oct 22"], ["22 Oct, 13:05", "22 Oct"], ["10-22 13:05", "10-22"], ["22/10 at 13:05", "22/10"], ["13:05, 22 October", "22 October"],
      ["13:05", "22 Oct"]]);
  });

  it("keeps the defaults for a blank or missing format, and goes back to them and stops listening once released", () => {
    const times = TestBed.inject(TimeFormatService);
    context.changeSetting("desktop.timeFormat", " ");
    TimeFormatService.register(context);
    const blank = [times.time(at), times.dateTime(at)];
    context.changeSetting("desktop.dateTimeFormat", 12);
    const missing = times.dateTime(at);
    context.changeSetting("desktop.timeFormat", "HH:mm");
    TimeFormatService.release(context);
    context.changeSetting("desktop.timeFormat", "HH:mm:ss");

    expect([blank, missing, times.time(at)]).toEqual([["1:05 PM", "Oct 22, 2026, 1:05 PM"], "Oct 22, 2026, 1:05 PM", "1:05 PM"]);
    expect(context.watchedSettings).toEqual([]);
  });
});
