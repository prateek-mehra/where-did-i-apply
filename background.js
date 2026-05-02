importScripts("constants.js", "storage.js");

(function () {
  "use strict";

  const { MESSAGES, isJobLikeUrl } = globalThis.WdiaConstants;
  const storage = globalThis.WdiaStorage;
  const autoOpenedTabs = new Map();

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

  async function openJobDetailsPopup(job, sender) {
    const tab = sender && sender.tab;

    if (!tab || !tab.id || !job || !job.jobLink || !job.isJobPage) {
      return false;
    }

    if (await storage.isIgnoredJob(job.jobLink)) {
      return false;
    }

    const normalizedJobLink = globalThis.WdiaConstants.normalizeUrl(job.jobLink);
    const lastOpened = autoOpenedTabs.get(tab.id);

    if (lastOpened === normalizedJobLink) {
      return false;
    }

    autoOpenedTabs.set(tab.id, normalizedJobLink);
    await chrome.action.setPopup({ tabId: tab.id, popup: "popup.html" });

    if (chrome.action.openPopup) {
      await chrome.action.openPopup({ windowId: tab.windowId });
      return true;
    }

    return false;
  }

  function openSavedJobsTab() {
    return new Promise((resolve) => {
      chrome.tabs.create({ url: chrome.runtime.getURL("saved-jobs.html") }, resolve);
    });
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

      case MESSAGES.IGNORE_JOB:
        return sendAsyncResponse(storage.ignoreJob(message.jobLink), sendResponse);

      case MESSAGES.JOB_PAGE_CONFIDENT:
        return sendAsyncResponse(openJobDetailsPopup(message.job, sender), sendResponse);

      case MESSAGES.OPEN_SAVED_JOBS:
        return sendAsyncResponse(openSavedJobsTab(), sendResponse);

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
