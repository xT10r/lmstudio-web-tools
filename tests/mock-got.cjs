exports.gotScraping = async ({url, signal}) => ({body: await globalThis.__websiteTestFetchPage(url, signal)});
