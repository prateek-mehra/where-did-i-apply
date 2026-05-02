(function () {
  "use strict";

  const generic = globalThis.WdiaGenericExtractor;

  function pickExtractor() {
    const url = new URL(location.href);
    const extractors = globalThis.WdiaSiteExtractors || [];
    return extractors.find((extractor) => extractor.canHandle(url)) || {
      name: "generic",
      extract: generic.extract
    };
  }

  function extractJob() {
    const extractor = pickExtractor();
    const result = extractor.extract();

    return {
      roleName: result.roleName || "",
      companyName: result.companyName || "",
      jobLink: result.jobLink || location.href,
      location: result.location || "NA",
      jobType: result.jobType || "NA",
      source: result.source || extractor.name || "generic",
      detectedAt: result.detectedAt || new Date().toISOString(),
      isJobPage: Boolean(result.isJobPage)
    };
  }

  globalThis.WdiaExtractor = {
    extractJob,
    pickExtractor
  };
})();
