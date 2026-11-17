/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { CaptureRequest, CaptureResult, CompareRequest, CompareResult, DeleteFolderRequest, DeleteFolderResult, PreviewRequest, PreviewResult,
  ReadRequest, ReadResult, RestoreRequest, RestoreResult } from "@noldova/checkpoints.protocol";

export interface ICheckpointsService {
  captureAsync(request: CaptureRequest, signal?: AbortSignal): Promise<CaptureResult>;
  compareAsync(request: CompareRequest, signal?: AbortSignal): Promise<CompareResult>;
  readAsync(request: ReadRequest, signal?: AbortSignal): Promise<ReadResult>;
  previewRestoreAsync(request: PreviewRequest): Promise<PreviewResult>;
  restoreAsync(request: RestoreRequest): Promise<RestoreResult>;
  deleteFolderAsync(request: DeleteFolderRequest, signal?: AbortSignal): Promise<DeleteFolderResult>;
}
