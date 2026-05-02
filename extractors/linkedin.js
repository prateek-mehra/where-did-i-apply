(function () {
  "use strict";

  const constants = globalThis.WdiaConstants;
  const generic = globalThis.WdiaGenericExtractor;

  function canHandle(url) {
    return /linkedin\.com\/jobs/i.test(url.href);
  }

  function isJobDetailPage() {
    const url = new URL(location.href);

    return (
      /\/jobs\/view\/\d+/i.test(url.pathname) ||
      Boolean(url.searchParams.get("currentJobId")) ||
      Boolean(document.querySelector(".jobs-unified-top-card, .job-details-jobs-unified-top-card"))
    );
  }

  function cleanLinkedInLocation(text) {
    return constants.cleanText(text)
      .replace(/\s+\d+\s+(?:minute|hour|day|week|month|year)s?\s+ago\b.*$/i, "")
      .replace(/\s+Over\s+\d+.*$/i, "")
      .replace(/\s+·.*$/i, "");
  }

  function extract() {
    const fallback = generic.extract();
    const roleName = generic.textFromSelector([
      ".jobs-unified-top-card__job-title",
      ".top-card-layout__title",
      ".job-details-jobs-unified-top-card__job-title",
      "h1"
    ]);
    const companyName = generic.textFromSelector([
      ".jobs-unified-top-card__company-name",
      ".topcard__org-name-link",
      ".job-details-jobs-unified-top-card__company-name",
      '[class*="company-name" i]'
    ]);
    const locationText = generic.textFromSelector([
      ".jobs-unified-top-card__primary-description-container .tvm__text",
      ".job-details-jobs-unified-top-card__primary-description-container .tvm__text",
      ".jobs-unified-top-card__bullet",
      ".topcard__flavor--bullet",
      ".job-details-jobs-unified-top-card__primary-description-container",
      '[class*="location" i]'
    ]);

    return {
      ...fallback,
      roleName: constants.cleanText(roleName) || fallback.roleName,
      companyName: constants.cleanText(companyName) || fallback.companyName,
      location: cleanLinkedInLocation(locationText) || fallback.location,
      jobType: constants.inferJobType(`${locationText} ${document.body.innerText}`),
      source: "linkedin",
      isJobPage: isJobDetailPage()
    };
  }

  globalThis.WdiaSiteExtractors = globalThis.WdiaSiteExtractors || [];
  globalThis.WdiaSiteExtractors.push({ name: "linkedin", canHandle, extract });
})();
