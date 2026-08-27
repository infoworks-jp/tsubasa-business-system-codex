(function () {
  "use strict";

  const nativeFetch = window.fetch.bind(window);
  window.fetch = function patchedFetch(input, init) {
    try {
      const requestUrl = typeof input === "string" ? input : input && input.url;
      if (requestUrl && requestUrl.includes("spyopczqtxypqjbhylzf.supabase.co/rest/v1/")) {
        const url = new URL(requestUrl);
        if (!url.searchParams.has("order")) url.searchParams.set("order", "id.asc");
        const nextInit = Object.assign({}, init || {}, { cache: "no-store" });
        nextInit.headers = Object.assign({}, (init && init.headers) || {}, {
          "Cache-Control": "no-cache",
          Pragma: "no-cache"
        });
        if (typeof input === "string") return nativeFetch(url.toString(), nextInit);
        return nativeFetch(new Request(url.toString(), input), nextInit);
      }
    } catch (error) {
      console.warn("fresh-supabase patch fallback", error);
    }
    return nativeFetch(input, init);
  };

  window.__TSUBASA_FRESH_SUPABASE__ = true;
})();
