importScripts("constants.js", "storage.js");

(function () {
  "use strict";

  const { MESSAGES, isJobLikeUrl } = globalThis.WdiaConstants;
  const storage = globalThis.WdiaStorage;

  function sendAsyncResponse(promise, sendResponse) {
    promise
      .then((payload) => sendResponse({ ok: true, payload }))
      .catch((error) => {
        console.error("Where did I apply? background error:", error);
        sendResponse({ ok: false, error: error.message || "Unknown error" });
      });
    return true;
  }

  function isSavableJob(job) {
    return Boolean(
      job &&
        job.jobLink &&
        !globalThis.WdiaConstants.isNonJobUrl(job.jobLink) &&
        (job.roleName || job.companyName || isJobLikeUrl(job.jobLink))
    );
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) {
      return false;
    }

    switch (message.type) {
      case MESSAGES.GET_CURRENT_JOB:
        return sendAsyncResponse(storage.getJobByUrl(message.jobLink), sendResponse);

      case MESSAGES.GET_JOBS:
        return sendAsyncResponse(storage.getAllJobs(), sendResponse);

      case MESSAGES.SAVE_JOB:
        if (!isSavableJob(message.job)) {
          sendResponse({ ok: false, error: "Missing job data." });
          return false;
        }
        return sendAsyncResponse(storage.upsertJob(message.job), sendResponse);

      case MESSAGES.DELETE_JOB:
        return sendAsyncResponse(storage.deleteJob(message.jobLink), sendResponse);

      case MESSAGES.UPDATE_JOB_STATUS:
        return sendAsyncResponse(
          storage.updateJobStatus(message.jobLink, message.status),
          sendResponse
        );

      case MESSAGES.AUTO_APPLIED_DETECTED:
        if (!isSavableJob(message.job)) {
          sendResponse({ ok: false, error: "Ignored auto-apply detection without job context." });
          return false;
        }
        return sendAsyncResponse(storage.upsertJob(message.job, { forceApplied: true }), sendResponse);

      default:
        return false;
    }
  });
})();
