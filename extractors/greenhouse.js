(function () {
  "use strict";

  const constants = globalThis.WdiaConstants;
  const generic = globalThis.WdiaGenericExtractor;

  function canHandle(url) {
    return /greenhouse\.io|boards\.greenhouse\.io/i.test(url.hostname);
  }

  function companyFromPath() {
    const segments = location.pathname.split("/").filter(Boolean);
    const boardIndex = segments.indexOf("boards");

    if (boardIndex >= 0 && segments[boardIndex + 1]) {
      return segments[boardIndex + 1].replace(/[-_]/g, " ");
    }

    if (segments[0] && segments[1] === "jobs") {
      return segments[0].replace(/[-_]/g, " ");
    }

    return "";
  }

  function extract() {
    const fallback = generic.extract();
    const roleName = generic.textFromSelector([".app-title", "#header h1", "h1", ".job__title"]);
    const companyName = generic.textFromSelector([".company-name", "#header .company", ".job-company"]) ||
      (document.title.match(/\bat\s+(.+?)(?:\s+Careers)?$/i) || [])[1] ||
      companyFromPath();
    const locationText = generic.textFromSelector([".location", ".app-location", "#header .location"]);

    return {
      ...fallback,
      roleName: constants.cleanText(roleName) || fallback.roleName,
      companyName: constants.cleanText(companyName) || fallback.companyName,
      location: constants.cleanText(locationText) || fallback.location,
      jobType: constants.inferJobType(`${locationText} ${document.body.innerText}`),
      source: "greenhouse",
      isJobPage: true
    };
  }

  globalThis.WdiaSiteExtractors = globalThis.WdiaSiteExtractors || [];
  globalThis.WdiaSiteExtractors.push({ name: "greenhouse", canHandle, extract });
})();
