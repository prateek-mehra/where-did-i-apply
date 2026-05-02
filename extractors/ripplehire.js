(function () {
  "use strict";

  const constants = globalThis.WdiaConstants;
  const generic = globalThis.WdiaGenericExtractor;

  function canHandle(url) {
    return /ripplehire\.com$/i.test(url.hostname);
  }

  function extractRoleFromSection(sectionText) {
    return constants.cleanText(sectionText)
      .replace(/\b\d+\s*-\s*\d+\s+Years\b.*$/i, "")
      .replace(/\b\d+\s+Opening\b.*$/i, "");
  }

  function extract() {
    const fallback = generic.extract();
    const titleText = generic.textFromSelector([".section-title"]);
    const roleName = extractRoleFromSection(titleText) || fallback.roleName;
    const locationText = generic.textFromSelector([".location-text"]);
    const companyName = generic.textFromSelector([".page-title"]) ||
      (document.title.match(/Apply for\s+(.+?)\s+-/i) || [])[1];

    return {
      ...fallback,
      roleName: constants.cleanText(roleName) || fallback.roleName,
      companyName: constants.cleanText(companyName).replace(/^Careers at\s+/i, "") || fallback.companyName,
      location: constants.cleanText(locationText) || fallback.location,
      jobType: constants.inferJobType(`${locationText} ${document.body.innerText}`),
      source: "ripplehire",
      isJobPage: true
    };
  }

  globalThis.WdiaSiteExtractors = globalThis.WdiaSiteExtractors || [];
  globalThis.WdiaSiteExtractors.push({ name: "ripplehire", canHandle, extract });
})();
