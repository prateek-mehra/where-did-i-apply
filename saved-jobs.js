(function () {
  "use strict";

  const constants = globalThis.WdiaConstants;
  const { MESSAGES, cleanText } = constants;

  const filters = {
    role: document.getElementById("roleFilter"),
    location: document.getElementById("locationFilter"),
    status: document.getElementById("statusFilter")
  };

  const jobCount = document.getElementById("jobCount");
  const tableBody = document.getElementById("jobsTableBody");
  const emptyState = document.getElementById("emptyState");

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

  function textMatches(value, query) {
    return cleanText(value).toLowerCase().includes(cleanText(query).toLowerCase());
  }

  function toTitleCase(value) {
    return cleanText(value)
      .toLowerCase()
      .replace(/\b([a-z])/g, (match) => match.toUpperCase())
      .replace(/\bIi\b/g, "II")
      .replace(/\bIii\b/g, "III")
      .replace(/\bIv\b/g, "IV");
  }

  function formatLocation(value) {
    const cleaned = cleanText(value)
      .replace(/\d+/g, " ")
      .replace(/[|()[\]{}:;]+/g, " ")
      .replace(/\s*[-·,/]\s*/g, ",")
      .toLowerCase();

    if (!cleaned || cleaned === "na") {
      return "NA";
    }

    if (/\b(bangalore|bengaluru|bangaluru)\b/.test(cleaned)) {
      return "Bengaluru";
    }

    const city = cleaned
      .split(",")
      .map((part) => cleanText(part.replace(/[^a-z\s]/g, " ")))
      .find((part) => part && !/\b(remote|hybrid|india|karnataka|full time|part time|contract)\b/.test(part));

    return city ? toTitleCase(city) : "NA";
  }

  function sourceLabel(value) {
    const normalized = cleanText(value).toLowerCase();
    const labels = {
      amazon: "Amazon",
      ericsson: "Ericsson",
      generic: "Careers Page",
      greenhouse: "Greenhouse",
      "google-careers": "Google Careers",
      instahyre: "Instahyre",
      lever: "Lever",
      linkedin: "LinkedIn",
      ripplehire: "RippleHire",
      sap: "SAP",
      workday: "Workday"
    };

    return labels[normalized] || toTitleCase(normalized.replace(/[-_]/g, " "));
  }

  function sourceFromJob(job) {
    const rawSource = cleanText(job.source);

    if (rawSource && rawSource !== "popup" && rawSource !== "manual" && rawSource !== "generic") {
      return sourceLabel(rawSource);
    }

    try {
      const hostname = new URL(job.jobLink).hostname.replace(/^www\./, "");

      if (/linkedin/i.test(hostname)) {
        return "LinkedIn";
      }

      if (/instahyre/i.test(hostname)) {
        return "Instahyre";
      }

      if (/greenhouse/i.test(hostname)) {
        return "Greenhouse";
      }

      if (/lever/i.test(hostname)) {
        return "Lever";
      }

      if (/workday/i.test(hostname)) {
        return "Workday";
      }

      return /careers?|jobs?/i.test(job.jobLink) ? "Careers Page" : toTitleCase(hostname.split(".")[0]);
    } catch (error) {
      return "Careers Page";
    }
  }

  function formatTimestamp(value) {
    if (!value) {
      return "NA";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "NA";
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function getFilteredJobs() {
    const roleQuery = filters.role.value;
    const locationQuery = filters.location.value;
    const statusQuery = filters.status.value;

    return Object.values(savedJobs)
      .filter((job) => !roleQuery || textMatches(job.roleName, roleQuery))
      .filter((job) => !locationQuery || textMatches(formatLocation(job.location), locationQuery))
      .filter((job) => !statusQuery || job.status === statusQuery)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  function appendCell(row, text) {
    const cell = document.createElement("td");
    cell.textContent = text || "NA";
    row.append(cell);
    return cell;
  }

  function createStatusSelect(job) {
    const select = document.createElement("select");
    select.className = "status-select";
    select.setAttribute("aria-label", "Job status");

    constants.STATUSES.forEach((status) => {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = status;
      select.append(option);
    });

    select.value = constants.STATUSES.includes(job.status) ? job.status : "Pending";
    select.addEventListener("change", async () => {
      await sendRuntimeMessage({
        type: MESSAGES.UPDATE_JOB_STATUS,
        jobLink: job.jobLink,
        status: select.value
      });
      await loadSavedJobs();
    });

    return select;
  }

  function createDeleteButton(job) {
    const button = document.createElement("button");
    button.className = "row-delete";
    button.type = "button";
    button.textContent = "Delete";
    button.setAttribute("aria-label", `Delete ${job.roleName || "saved job"}`);
    button.addEventListener("click", async () => {
      await sendRuntimeMessage({ type: MESSAGES.DELETE_JOB, jobLink: job.jobLink });
      await loadSavedJobs();
    });
    return button;
  }

  function renderJobs() {
    const jobs = getFilteredJobs();

    jobCount.textContent = String(Object.keys(savedJobs).length);
    tableBody.textContent = "";
    emptyState.hidden = jobs.length > 0;

    jobs.forEach((job, index) => {
      const row = document.createElement("tr");
      const roleCell = document.createElement("td");
      const link = document.createElement("a");
      const statusCell = document.createElement("td");
      const actionsCell = document.createElement("td");

      appendCell(row, String(index + 1));

      link.href = job.jobLink;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = toTitleCase(job.roleName || "Untitled role");
      roleCell.append(link);
      row.append(roleCell);

      appendCell(row, toTitleCase(job.companyName || "Unknown company"));
      appendCell(row, sourceFromJob(job));
      appendCell(row, formatLocation(job.location));
      appendCell(row, job.jobType || "NA");
      appendCell(row, job.yoe || "NA");

      statusCell.append(createStatusSelect(job));
      row.append(statusCell);

      appendCell(row, formatTimestamp(job.updatedAt));

      actionsCell.className = "row-actions";
      actionsCell.append(createDeleteButton(job));
      row.append(actionsCell);

      tableBody.append(row);
    });
  }

  async function loadSavedJobs() {
    savedJobs = await sendRuntimeMessage({ type: MESSAGES.GET_JOBS });
    renderJobs();
  }

  Object.values(filters).forEach((filter) => {
    filter.addEventListener("input", renderJobs);
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.jobs) {
      savedJobs = changes.jobs.newValue || {};
      renderJobs();
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    loadSavedJobs().catch(() => {
      savedJobs = {};
      renderJobs();
    });
  });
})();
