(function () {
  "use strict";

  const constants = globalThis.WdiaConstants;
  const { MESSAGES, cleanText, isJobLikeUrl } = constants;

  let latestJob = null;
  let extractionTimer = null;
  let lastAutoAppliedAt = 0;
  let confidenceTimer = null;
  let lastPromptedUrl = "";
  let lastUrl = location.href;

  function hasUsefulJobData(job) {
    return Boolean(
      job &&
        job.jobLink &&
        !constants.isNonJobUrl(job.jobLink) &&
        (job.roleName || job.companyName || job.isJobPage || isJobLikeUrl(job.jobLink))
    );
  }

  function extractNow() {
    try {
      const extracted = globalThis.WdiaExtractor.extractJob();
      latestJob = {
        ...extracted,
        jobLink: location.href
      };
      return latestJob;
    } catch (error) {
      console.warn("Where did I apply? extraction failed:", error);
      latestJob = {
        roleName: "",
        companyName: "",
        jobLink: location.href,
        location: "NA",
        jobType: "NA",
        source: "unknown",
        detectedAt: new Date().toISOString(),
        isJobPage: false
      };
      return latestJob;
    }
  }

  function scheduleExtraction(delay) {
    window.clearTimeout(extractionTimer);
    extractionTimer = window.setTimeout(() => {
      extractNow();
      scheduleConfidenceCheck(700);
    }, delay);
  }

  function isConfidentJobPage(job) {
    return Boolean(
      hasUsefulJobData(job) &&
        job.isJobPage &&
        job.roleName &&
        (job.companyName || job.source !== "generic")
    );
  }

  function scheduleConfidenceCheck(delay) {
    window.clearTimeout(confidenceTimer);
    confidenceTimer = window.setTimeout(() => {
      const job = latestJob || extractNow();
      const normalizedUrl = constants.normalizeUrl(job && job.jobLink);

      if (!normalizedUrl || normalizedUrl === lastPromptedUrl || !isConfidentJobPage(job)) {
        return;
      }

      lastPromptedUrl = normalizedUrl;
      chrome.runtime.sendMessage({
        type: MESSAGES.JOB_PAGE_CONFIDENT,
        job
      });
    }, delay);
  }

  function getElementLabel(element) {
    if (!element) {
      return "";
    }

    return cleanText([
      element.innerText,
      element.textContent,
      element.value,
      element.getAttribute && element.getAttribute("aria-label"),
      element.getAttribute && element.getAttribute("title")
    ].filter(Boolean).join(" "));
  }

  function findActionElement(target) {
    if (!target || !target.closest) {
      return null;
    }

    return target.closest(
      'button, a, input[type="button"], input[type="submit"], [role="button"]'
    );
  }

  function isSubmitApplicationAction(element) {
    const label = getElementLabel(element).toLowerCase();
    return /\b(submit application|send application|finish application|complete application)\b/.test(label);
  }

  function isRoutingApplyLink(element) {
    if (!element || !element.closest) {
      return false;
    }

    const link = element.closest("a[href]");

    if (!link) {
      return false;
    }

    const href = link.getAttribute("href") || "";

    if (!href || href.startsWith("#") || href.startsWith("javascript:")) {
      return false;
    }

    try {
      const nextUrl = new URL(href, location.href);
      return nextUrl.origin !== location.origin || nextUrl.href !== location.href;
    } catch (error) {
      return false;
    }
  }

  function formLooksLikeApplication(form) {
    if (!form || constants.isNonJobUrl(location.href)) {
      return false;
    }

    const text = cleanText(form.innerText || form.textContent || "").toLowerCase();
    const action = (form.getAttribute("action") || "").toLowerCase();
    const fieldNames = Array.from(form.querySelectorAll("input, textarea, select"))
      .map((field) => [
        field.name,
        field.id,
        field.getAttribute("aria-label"),
        field.getAttribute("placeholder")
      ].filter(Boolean).join(" "))
      .join(" ")
      .toLowerCase();
    const combined = `${text} ${action} ${fieldNames}`;

    if (/\b(sign in|signin|log in|login|password|otp|verification code)\b/.test(combined)) {
      return false;
    }

    return /\b(resume|cv|cover letter|portfolio|work authorization|application)\b/.test(combined);
  }

  function shouldMarkApplied(reason, job, actionElement) {
    if (!hasUsefulJobData(job) || !job.isJobPage) {
      return false;
    }

    if (reason === "form-submit") {
      return formLooksLikeApplication(actionElement);
    }

    return isSubmitApplicationAction(actionElement) && !isRoutingApplyLink(actionElement);
  }

  function sendAutoApplied(reason, actionElement) {
    const now = Date.now();

    if (now - lastAutoAppliedAt < 1500) {
      return;
    }

    const job = extractNow();

    if (!shouldMarkApplied(reason, job, actionElement)) {
      return;
    }

    lastAutoAppliedAt = now;

    chrome.runtime.sendMessage({
      type: MESSAGES.AUTO_APPLIED_DETECTED,
      reason,
      job: {
        ...job,
        status: "Applied",
        jobLink: location.href
      }
    });
  }

  function handleClick(event) {
    const actionElement = findActionElement(event.target);

    if (actionElement && isSubmitApplicationAction(actionElement)) {
      sendAutoApplied("click", actionElement);
    }
  }

  function handleSubmit(event) {
    sendAutoApplied("form-submit", event.target);
  }

  function observeSpaChanges() {
    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        lastPromptedUrl = "";
        scheduleExtraction(250);
        return;
      }

      scheduleExtraction(500);
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== MESSAGES.GET_EXTRACTED_JOB) {
      return false;
    }

    const job = extractNow();
    sendResponse({
      type: MESSAGES.EXTRACTED_JOB_RESULT,
      job
    });
    return false;
  });

  document.addEventListener("click", handleClick, true);
  document.addEventListener("submit", handleSubmit, true);

  extractNow();
  if (document.readyState === "complete") {
    scheduleConfidenceCheck(900);
  } else {
    window.addEventListener("load", () => scheduleConfidenceCheck(900), { once: true });
  }
  observeSpaChanges();
})();
