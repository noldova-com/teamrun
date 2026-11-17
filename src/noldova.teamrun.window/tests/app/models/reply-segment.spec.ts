/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DetailKind } from "@noldova/teamrun.protocol";

import { SampleData } from "../../fixtures/sample-data.fixture";
import { SegmentKind } from "../../../src/app/enums/segment-kind";
import { ActivityEntry } from "../../../src/app/models/activity-entry";
import { ReplySegment } from "../../../src/app/models/reply-segment";

describe("ReplySegment", () => {
  it("is a run of text, of activity, an image or a plan", () => {
    expect(Object.values(SegmentKind)).toEqual(["Text", "Activity", "Image", "Plan"]);
  });

  it("is keyed by its detail, else by its first step, else by -1", () => {
    const step = new ActivityEntry(SampleData.detail(4, DetailKind.Command, "> ls"), null);

    expect(new ReplySegment(SegmentKind.Text, SampleData.detail(2, DetailKind.Text, "Done."), []).key).toBe(2);
    expect(new ReplySegment(SegmentKind.Activity, null, [step]).key).toBe(4);
    expect(new ReplySegment(SegmentKind.Activity, null, []).key).toBe(-1);
  });
});
