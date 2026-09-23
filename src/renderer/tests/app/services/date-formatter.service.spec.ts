/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { DateFormatter } from "../../../src/app/services/date-formatter.service";

describe("DateFormatter", () => {
  it("renders every token and keeps the rest", () => {
    const formatter = TestBed.inject(DateFormatter);
    const morning = new Date(2026, 8, 3, 9, 5, 7).toISOString();
    const evening = new Date(2026, 8, 10, 13, 5, 0).toISOString();
    const midnight = new Date(2026, 0, 1, 0, 30, 0).toISOString();

    expect(formatter.format(morning, "yyyy-MM-dd HH:mm:ss")).toBe("2026-09-03 09:05:07");
    expect(formatter.format(morning, "yy/M/d H:m")).toBe("26/9/3 9:m");
    expect(formatter.format(evening, "d MMM yyyy, HH:mm")).toBe("10 Sept 2026, 13:05");
    expect(formatter.format(evening, "MMMM d, yyyy, h:mm a")).toBe("September 10, 2026, 1:05 PM");
    expect(formatter.format(morning, "EEE EEEE hh:mm a")).toBe("Thu Thursday 09:05 AM");
    expect(formatter.format(midnight, "h:mm a")).toBe("12:30 AM");
    expect(formatter.format(evening, "'at' HH 'sharp'")).toBe("at 13 sharp");
    expect(formatter.format(evening, "'today at' h:mm a, 'day' d")).toBe("today at 1:05 PM, day 10");
  });
});
