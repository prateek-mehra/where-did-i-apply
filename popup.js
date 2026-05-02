(function () {
  "use strict";

  const constants = globalThis.WdiaConstants;
  const { MESSAGES, cleanText, normalizeUrl } = constants;

  const fields = {
    roleName: document.getElementById("roleName"),
    companyName: document.getElementById("companyName"),
    jobLink: document.getElementById("jobLink"),
    location: document.getElementById("location"),
    jobType: document.getElementById("jobType"),
    yoe: document.getElementById("yoe"),
    status: document.getElementById("status")
  };

  const jobForm = document.getElementById("jobForm");
  const pageState = document.getElementById("pageState");
  const ignoreButton = document.getElementById("ignoreButton");
  const deleteButton = document.getElementById("deleteButton");
  const refreshButton = document.getElementById("refreshButton");
  const savedJobsLink = document.getElementById("savedJobsLink");

  let activeTab = null;
  let savedJobs = {};
  let currentSource = "popup";

  function sendRuntimeMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!response || !response.ok) {
          reject(new Error((response && response.error) || "Request failed."));
          return;
        }

        resolve(response.payload);
      });
    });
  }

  function sendTabMessage(tabId, message) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve(response);
      });
    });
  }

  function getActiveTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs[0] || null);
      });
    });
  }

  function readForm() {
    return {
      roleName: cleanText(fields.roleName.value),
      companyName: cleanText(fields.companyName.value),
      jobLink: cleanText(fields.jobLink.value),
      location: cleanText(fields.location.value) || "NA",
      jobType: fields.jobType.value || "NA",
      yoe: cleanText(fields.yoe.value) || "NA",
      status: fields.status.value || "Pending",
      source: currentSource || "popup"
    };
  }

  function fillForm(job) {
    currentSource = job.source || "popup";
    fields.roleName.value = job.roleName || "";
    fields.companyName.value = job.companyName || "";
    fields.jobLink.value = job.jobLink || (activeTab && activeTab.url) || "";
    fields.location.value = job.location || "NA";
    fields.jobType.value = constants.JOB_TYPES.includes(job.jobType) ? job.jobType : "NA";
    fields.yoe.value = job.yoe || "NA";
    fields.status.value = constants.STATUSES.includes(job.status) ? job.status : "Pending";
    updateDeleteVisibility();
  }

  function currentSavedJob() {
    const key = normalizeUrl(fields.jobLink.value);
    return savedJobs[key] || null;
  }

  function updateDeleteVisibility() {
    deleteButton.hidden = !currentSavedJob();
  }

  async function loadSavedJobs() {
    savedJobs = await sendRuntimeMessage({ type: MESSAGES.GET_JOBS });
    updateDeleteVisibility();
  }

  async function detectCurrentJob() {
    activeTab = await getActiveTab();

    if (!activeTab || !activeTab.id || !activeTab.url) {
      pageState.textContent = "No active tab found.";
      return;
    }

    fields.jobLink.value = activeTab.url;

    try {
      const response = await sendTabMessage(activeTab.id, { type: MESSAGES.GET_EXTRACTED_JOB });
      const detectedJob = response && response.job;
      const savedJob = savedJobs[normalizeUrl(activeTab.url)];

      fillForm(savedJob || detectedJob || { jobLink: activeTab.url, status: "Pending" });
      pageState.textContent = detectedJob && detectedJob.isJobPage
        ? `Detected via ${detectedJob.source}.`
        : "No strong job-page signal. You can still save manually.";
    } catch (error) {
      const savedJob = savedJobs[normalizeUrl(activeTab.url)];
      fillForm(savedJob || { jobLink: activeTab.url, status: "Pending", location: "NA", jobType: "NA", yoe: "NA" });
      pageState.textContent = "Detection unavailable on this page.";
    }
  }

  async function saveCurrentJob() {
    const job = readForm();

    if (!job.jobLink) {
      pageState.textContent = "Add a job link before saving.";
      return;
    }

    const saved = await sendRuntimeMessage({ type: MESSAGES.SAVE_JOB, job });
    pageState.textContent = saved.status === "Applied" ? "Saved as applied." : "Saved as pending.";
    await loadSavedJobs();
    fillForm(saved);
  }

  async function deleteCurrentJob() {
    const job = readForm();

    if (!job.jobLink) {
      return;
    }

    await sendRuntimeMessage({ type: MESSAGES.DELETE_JOB, jobLink: job.jobLink });
    pageState.textContent = "Deleted saved job.";
    await loadSavedJobs();
    fields.status.value = "Pending";
  }

  async function ignoreCurrentJob() {
    const job = readForm();

    if (!job.jobLink) {
      pageState.textContent = "No job link to ignore.";
      return;
    }

    await sendRuntimeMessage({ type: MESSAGES.IGNORE_JOB, jobLink: job.jobLink });
    pageState.textContent = "Ignored for this page.";
    window.setTimeout(() => window.close(), 250);
  }

  jobForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveCurrentJob().catch((error) => {
      pageState.textContent = error.message;
    });
  });

  ignoreButton.addEventListener("click", () => {
    ignoreCurrentJob().catch((error) => {
      pageState.textContent = error.message;
    });
  });

  deleteButton.addEventListener("click", () => {
    deleteCurrentJob().catch((error) => {
      pageState.textContent = error.message;
    });
  });

  refreshButton.addEventListener("click", () => {
    pageState.textContent = "Refreshing detection...";
    detectCurrentJob().catch((error) => {
      pageState.textContent = error.message;
    });
  });

  savedJobsLink.addEventListener("click", (event) => {
    event.preventDefault();
    sendRuntimeMessage({ type: MESSAGES.OPEN_SAVED_JOBS }).catch((error) => {
      pageState.textContent = error.message;
    });
  });

  fields.jobLink.addEventListener("input", updateDeleteVisibility);

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      savedJobsLink.href = chrome.runtime.getURL("saved-jobs.html");
      await loadSavedJobs();
      await detectCurrentJob();
    } catch (error) {
      pageState.textContent = error.message;
    }
  });
})();
