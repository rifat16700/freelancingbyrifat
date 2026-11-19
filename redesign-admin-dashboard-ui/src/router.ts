import { useEffect, useState } from "react";

const KNOWN_ROUTES = new Set([
  "/dashboard", "/insights", "/orders", "/customers", "/products",
  "/categories", "/brands", "/banners", "/sections", "/promos",
  "/reviews", "/delivery", "/addons", "/settings", "/theme",
  "/tracking", "/staff", "/developer",
]);

function detectInitialHash(): string {
  const rawHash = window.location.hash.replace(/^#/, "");
  if (rawHash && rawHash.startsWith("/")) return rawHash;

  const pathname = (window.location.pathname || "").toLowerCase();
  const seg = pathname.split("/").filter(Boolean).pop()?.replace(/\.html$/, "") || "";
  let mapped = "/dashboard";
  if (seg === "env-setup" || seg === "devtools" || seg === "developer") {
    mapped = "/developer";
  } else if (seg && seg !== "admin" && seg !== "index" && KNOWN_ROUTES.has("/" + seg)) {
    mapped = "/" + seg;
  }
  const search = window.location.search || "";
  return mapped + search;
}

function parse() {
  const h = detectInitialHash();
  const [path, q] = h.split("?");
  return { path: path || "/dashboard", query: new URLSearchParams(q || "") };
}

export function useRoute() {
  const [r, setR] = useState(parse());
  useEffect(() => {
    const h = () => setR(parse());
    window.addEventListener("hashchange", h);
    window.addEventListener("popstate", h);
    return () => {
      window.removeEventListener("hashchange", h);
      window.removeEventListener("popstate", h);
    };
  }, []);
  return r;
}

export const go = (to: string) => {
  window.location.hash = to;
  window.scrollTo({ top: 0 });
};
