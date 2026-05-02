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
    status: document.getElementById("status")
  };

  const pageState = document.getElementById("pageState");
  const saveButton = document.getElementById("saveButton");
  const deleteButton = document.getElementById("deleteButton");
  const refreshButton = document.getElementById("refreshButton");
  const jobsList = document.getElementById("jobsList");
  const jobCount = document.getElementById("jobCount");
  const jobItemTemplate = document.getElementById("jobItemTemplate");

  let activeTab = null;
  let savedJobs = {};

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
      status: fields.status.value || "Pending",
      source: "popup"
    };
  }

  function fillForm(job) {
    fields.roleName.value = job.roleName || "";
    fields.companyName.value = job.companyName || "";
    fields.jobLink.value = job.jobLink || (activeTab && activeTab.url) || "";
    fields.location.value = job.location || "NA";
    fields.jobType.value = constants.JOB_TYPES.includes(job.jobType) ? job.jobType : "NA";
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

  function renderJobs() {
    const jobs = Object.values(savedJobs).sort((a, b) => {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    jobCount.textContent = String(jobs.length);
    jobsList.textContent = "";

    if (!jobs.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No saved jobs yet.";
      jobsList.append(empty);
      updateDeleteVisibility();
      return;
    }

    jobs.forEach((job) => {
      const item = jobItemTemplate.content.firstElementChild.cloneNode(true);
      const title = item.querySelector(".job-title");
      const meta = item.querySelector(".job-meta");
      const status = item.querySelector(".job-status");

      title.href = job.jobLink;
      title.textContent = job.roleName || "Untitled role";
      meta.textContent = [
        job.companyName || "Unknown company",
        job.location || "NA",
        job.jobType || "NA"
      ].join(" · ");
      status.value = job.status || "Pending";
      status.addEventListener("change", async () => {
        await sendRuntimeMessage({
          type: MESSAGES.UPDATE_JOB_STATUS,
          jobLink: job.jobLink,
          status: status.value
        });
        await loadSavedJobs();
      });

      jobsList.append(item);
    });

    updateDeleteVisibility();
  }

  async function loadSavedJobs() {
    savedJobs = await sendRuntimeMessage({ type: MESSAGES.GET_JOBS });
    renderJobs();
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
      fillForm(savedJob || { jobLink: activeTab.url, status: "Pending", location: "NA", jobType: "NA" });
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

  saveButton.addEventListener("click", () => {
    saveCurrentJob().catch((error) => {
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

  fields.jobLink.addEventListener("input", updateDeleteVisibility);

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      await loadSavedJobs();
      await detectCurrentJob();
    } catch (error) {
      pageState.textContent = error.message;
    }
  });
})();
