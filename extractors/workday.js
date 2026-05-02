(function () {
  "use strict";

  const constants = globalThis.WdiaConstants;
  const generic = globalThis.WdiaGenericExtractor;

  function canHandle(url) {
    return /workdayjobs\.com|myworkdayjobs\.com/i.test(url.hostname);
  }

  function extract() {
    const fallback = generic.extract();
    const roleName = generic.textFromSelector([
      '[data-automation-id="jobPostingHeader"]',
      '[data-automation-id="jobTitle"]',
      "h1"
    ]);
    const companyName = generic.textFromSelector([
      '[data-automation-id="jobPostingCompany"]',
      '[data-automation-id="company"]'
    ]) || location.hostname.split(".")[0];
    const locationText = generic.textFromSelector([
      '[data-automation-id="locations"]',
      '[data-automation-id="jobPostingLocation"]',
      '[data-automation-id="location"]'
    ]);

    return {
      ...fallback,
      roleName: constants.cleanText(roleName) || fallback.roleName,
      companyName: constants.cleanText(companyName) || fallback.companyName,
      location: constants.cleanText(locationText) || fallback.location,
      jobType: constants.inferJobType(`${locationText} ${document.body.innerText}`),
      source: "workday",
      isJobPage: true
    };
  }

  globalThis.WdiaSiteExtractors = globalThis.WdiaSiteExtractors || [];
  globalThis.WdiaSiteExtractors.push({ name: "workday", canHandle, extract });
})();
