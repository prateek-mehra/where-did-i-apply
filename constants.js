(function () {
  "use strict";

  const JOB_TYPES = ["Remote", "Hybrid", "In-office", "NA"];
  const STATUSES = ["Pending", "Applied"];

  const MESSAGES = {
    GET_EXTRACTED_JOB: "GET_EXTRACTED_JOB",
    EXTRACTED_JOB_RESULT: "EXTRACTED_JOB_RESULT",
    GET_CURRENT_JOB: "GET_CURRENT_JOB",
    SAVE_JOB: "SAVE_JOB",
    GET_JOBS: "GET_JOBS",
    IGNORE_JOB: "IGNORE_JOB",
    JOB_PAGE_CONFIDENT: "JOB_PAGE_CONFIDENT",
    OPEN_SAVED_JOBS: "OPEN_SAVED_JOBS",
    DELETE_JOB: "DELETE_JOB",
    UPDATE_JOB_STATUS: "UPDATE_JOB_STATUS",
    AUTO_APPLIED_DETECTED: "AUTO_APPLIED_DETECTED"
  };

  const APPLY_KEYWORDS = ["apply", "submit", "submit application", "continue"];

  const NON_JOB_URL_PATTERNS = [
    /google\.[^/]+\/search/i,
    /linkedin\.com\/jobs\/search/i,
    /linkedin\.com\/jobs\/collections/i,
    /linkedin\.com\/jobs\/?$/i,
    /instahyre\.com\/(?:login|signin|candidate\/login|candidate\/signin)/i,
    /\/(?:login|signin|sign-in|auth|session)(?:\/|$|\?)/i
  ];

  const JOB_URL_PATTERNS = [
    /linkedin\.com\/jobs/i,
    /greenhouse\.io/i,
    /boards\.greenhouse\.io/i,
    /jobs\.lever\.co/i,
    /myworkdayjobs\.com/i,
    /workdayjobs\.com/i,
    /\/careers?\b/i,
    /\/jobs?\b/i,
    /\/positions?\b/i,
    /\/openings?\b/i
  ];

  const TRACKING_PARAMS = [
    "fbclid",
    "gclid",
    "igshid",
    "mc_cid",
    "mc_eid",
    "ref",
    "source"
  ];

  function normalizeUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== "string") {
      return "";
    }

    try {
      const url = new URL(rawUrl, globalThis.location && globalThis.location.href);
      url.hash = "";

      Array.from(url.searchParams.keys()).forEach((key) => {
        if (key.toLowerCase().startsWith("utm_") || TRACKING_PARAMS.includes(key.toLowerCase())) {
          url.searchParams.delete(key);
        }
      });

      url.pathname = url.pathname.replace(/\/+$/, "") || "/";
      return url.toString();
    } catch (error) {
      return rawUrl.trim();
    }
  }

  function cleanText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .replace(/\[object Object\]/g, "")
      .replace(/\u00a0/g, " ")
      .trim();
  }

  function inferJobType(text) {
    const normalized = cleanText(text).toLowerCase();

    if (!normalized) {
      return "NA";
    }

    if (/\bremote\b|work from home|wfh/.test(normalized)) {
      return "Remote";
    }

    if (/\bhybrid\b/.test(normalized)) {
      return "Hybrid";
    }

    if (/\bin[-\s]?office\b|onsite|on-site|office based/.test(normalized)) {
      return "In-office";
    }

    return "NA";
  }

  function inferYoe(text) {
    const normalized = cleanText(text).toLowerCase();

    if (!normalized) {
      return "NA";
    }

    const explicitRange = normalized.match(/\b(\d{1,2})\s*(?:\+|plus|-|to)\s*(\d{1,2})?\s*(?:years?|yrs?)\b/);

    if (explicitRange) {
      return explicitRange[2] ? `${explicitRange[1]}-${explicitRange[2]} yrs` : `${explicitRange[1]}+ yrs`;
    }

    const years = normalized.match(/\b(\d{1,2})\s*(?:\+)?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:relevant\s+)?experience\b/);

    if (years) {
      return normalized.includes(`${years[1]}+`) ? `${years[1]}+ yrs` : `${years[1]} yrs`;
    }

    if (/\b(entry level|new grad|graduate|fresher)\b/.test(normalized)) {
      return "0-1 yrs";
    }

    return "NA";
  }

  function isJobLikeUrl(rawUrl) {
    const url = rawUrl || "";

    if (NON_JOB_URL_PATTERNS.some((pattern) => pattern.test(url))) {
      return false;
    }

    return JOB_URL_PATTERNS.some((pattern) => pattern.test(url));
  }

  function isNonJobUrl(rawUrl) {
    return NON_JOB_URL_PATTERNS.some((pattern) => pattern.test(rawUrl || ""));
  }

  function makeJobId(normalizedJobLink) {
    let hash = 0;
    const input = normalizedJobLink || `${Date.now()}`;

    for (let index = 0; index < input.length; index += 1) {
      hash = (hash << 5) - hash + input.charCodeAt(index);
      hash |= 0;
    }

    return `job_${Math.abs(hash).toString(36)}`;
  }

  globalThis.WdiaConstants = {
    APPLY_KEYWORDS,
    JOB_TYPES,
    JOB_URL_PATTERNS,
    MESSAGES,
    NON_JOB_URL_PATTERNS,
    STATUSES,
    cleanText,
    inferJobType,
    inferYoe,
    isJobLikeUrl,
    isNonJobUrl,
    makeJobId,
    normalizeUrl
  };
})();
