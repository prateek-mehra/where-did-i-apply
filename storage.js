(function () {
  "use strict";

  const constants = globalThis.WdiaConstants;

  function getAllJobs() {
    return new Promise((resolve) => {
      chrome.storage.local.get({ jobs: {} }, (result) => {
        resolve(result.jobs || {});
      });
    });
  }

  function getIgnoredJobs() {
    return new Promise((resolve) => {
      chrome.storage.local.get({ ignoredJobs: {} }, (result) => {
        resolve(result.ignoredJobs || {});
      });
    });
  }

  function setIgnoredJobs(ignoredJobs) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ ignoredJobs }, resolve);
    });
  }

  function setAllJobs(jobs) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ jobs }, resolve);
    });
  }

  async function getJobByUrl(jobLink) {
    const jobs = await getAllJobs();
    const normalizedJobLink = constants.normalizeUrl(jobLink);
    return jobs[normalizedJobLink] || null;
  }

  async function upsertJob(jobInput, options) {
    const now = new Date().toISOString();
    const jobs = await getAllJobs();
    const normalizedJobLink = constants.normalizeUrl(jobInput.jobLink);
    const existing = jobs[normalizedJobLink] || {};
    const status = options && options.forceApplied ? "Applied" : jobInput.status || existing.status || "Pending";

    const job = {
      id: existing.id || constants.makeJobId(normalizedJobLink),
      roleName: constants.cleanText(jobInput.roleName) || existing.roleName || "",
      companyName: constants.cleanText(jobInput.companyName) || existing.companyName || "",
      jobLink: jobInput.jobLink || existing.jobLink || normalizedJobLink,
      normalizedJobLink,
      location: constants.cleanText(jobInput.location) || existing.location || "NA",
      jobType: constants.JOB_TYPES.includes(jobInput.jobType) ? jobInput.jobType : existing.jobType || "NA",
      yoe: constants.cleanText(jobInput.yoe) || existing.yoe || "NA",
      status,
      source: jobInput.source || existing.source || "manual",
      createdAt: existing.createdAt || now,
      updatedAt: now
    };

    if (options && options.forceApplied) {
      job.appliedDetectedAt = now;
    } else if (existing.appliedDetectedAt) {
      job.appliedDetectedAt = existing.appliedDetectedAt;
    }

    jobs[normalizedJobLink] = job;
    await setAllJobs(jobs);
    return job;
  }

  async function deleteJob(jobLink) {
    const jobs = await getAllJobs();
    const normalizedJobLink = constants.normalizeUrl(jobLink);
    const existed = Boolean(jobs[normalizedJobLink]);

    if (existed) {
      delete jobs[normalizedJobLink];
      await setAllJobs(jobs);
    }

    return existed;
  }

  async function updateJobStatus(jobLink, status) {
    const jobs = await getAllJobs();
    const normalizedJobLink = constants.normalizeUrl(jobLink);
    const existing = jobs[normalizedJobLink];

    if (!existing || !constants.STATUSES.includes(status)) {
      return null;
    }

    const updated = {
      ...existing,
      status,
      updatedAt: new Date().toISOString()
    };

    jobs[normalizedJobLink] = updated;
    await setAllJobs(jobs);
    return updated;
  }

  async function ignoreJob(jobLink) {
    const normalizedJobLink = constants.normalizeUrl(jobLink);

    if (!normalizedJobLink) {
      return null;
    }

    const ignoredJobs = await getIgnoredJobs();
    const ignored = {
      normalizedJobLink,
      ignoredAt: new Date().toISOString()
    };

    ignoredJobs[normalizedJobLink] = ignored;
    await setIgnoredJobs(ignoredJobs);
    return ignored;
  }

  async function isIgnoredJob(jobLink) {
    const ignoredJobs = await getIgnoredJobs();
    return Boolean(ignoredJobs[constants.normalizeUrl(jobLink)]);
  }

  globalThis.WdiaStorage = {
    deleteJob,
    getAllJobs,
    getJobByUrl,
    ignoreJob,
    isIgnoredJob,
    setAllJobs,
    updateJobStatus,
    upsertJob
  };
})();
