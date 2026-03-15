import { VideoJobProcessorService } from '../video-job-processor.service';
import { VideoWorkerBridgeService } from '../video-worker-bridge.service';
import { VideoJobsService } from '../video-jobs.service';

describe('VideoJobProcessorService', () => {
  const getVideoJobForWorkerMock = jest.fn();
  const runMock = jest.fn();
  const applyInternalFailMock = jest.fn();

  const videoJobsService = {
    getVideoJobForWorker: getVideoJobForWorkerMock,
    applyInternalFail: applyInternalFailMock,
  } as unknown as VideoJobsService;

  const videoWorkerBridgeService = {
    run: runMock,
  } as unknown as VideoWorkerBridgeService;

  const service = new VideoJobProcessorService(
    videoJobsService,
    videoWorkerBridgeService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not dispatch when the job is missing', async () => {
    getVideoJobForWorkerMock.mockResolvedValue(null);

    await service.process({
      video_job_id: 'vjob_missing',
      document_id: 'doc_1',
      actor_id: 'user_1',
      request_id: 'req_1',
      attempt: 1,
    });

    expect(runMock).not.toHaveBeenCalled();
  });

  it('does not dispatch when the job is already completed', async () => {
    getVideoJobForWorkerMock.mockResolvedValue({
      id: 'vjob_1',
      status: 'completed',
    });

    await service.process({
      video_job_id: 'vjob_1',
      document_id: 'doc_1',
      actor_id: 'user_1',
      request_id: 'req_1',
      attempt: 1,
    });

    expect(runMock).not.toHaveBeenCalled();
  });

  it('dispatches active jobs to the python worker bridge', async () => {
    getVideoJobForWorkerMock.mockResolvedValue({
      id: 'vjob_2',
      status: 'processing',
      target_duration_sec: 60,
      voice: 'alloy',
      language: 'en',
    });
    runMock.mockResolvedValue(undefined);

    await service.process({
      video_job_id: 'vjob_2',
      document_id: 'doc_2',
      actor_id: 'user_2',
      request_id: 'req_2',
      attempt: 1,
    });

    expect(runMock).toHaveBeenCalledWith({
      video_job_id: 'vjob_2',
      document_id: 'doc_2',
      actor_id: 'user_2',
      request_id: 'req_2',
      attempt: 1,
      target_duration_sec: 60,
      voice: 'alloy',
      language: 'en',
    });
  });

  it('marks DLQ jobs as terminal failures with a stable error code', async () => {
    applyInternalFailMock.mockResolvedValue(undefined);

    await service.processDlq({
      video_job_id: 'vjob_dlq',
      document_id: 'doc_dlq',
      actor_id: 'user_dlq',
      request_id: 'req_dlq',
      attempt: 2,
    });

    expect(applyInternalFailMock).toHaveBeenCalledWith('vjob_dlq', {
      pipeline_stage: 'failed',
      error_code: 'VIDEO_JOB_RETRY_EXHAUSTED',
      error_message: 'Video job exhausted retry attempts',
    });
  });
});
