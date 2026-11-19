import { useEffect, useState, type ReactElement } from "react";
import { StoreProvider, useStore } from "./store";
import { useRoute } from "./router";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Insights } from "./pages/Insights";
import { Orders } from "./pages/Orders";
import { Customers } from "./pages/Customers";
import { Products } from "./pages/Products";
import { Categories, Brands } from "./pages/Catalog";
import { Banners, Sections } from "./pages/Storefront";
import { Promos } from "./pages/Promos";
import { Reviews } from "./pages/Reviews";
import { Delivery, Addons } from "./pages/Checkout";
import { Settings } from "./pages/Settings";
import { Theme, Tracking } from "./pages/Branding";
import { Staff } from "./pages/Staff";
import { Developer } from "./pages/Developer";
import { getAdminToken, proxyFetch } from "./lib/api";

const ROUTES: Record<string, () => ReactElement> = {
  "/dashboard": () => <Dashboard />,
  "/insights": () => <Insights />,
  "/orders": () => <Orders />,
  "/customers": () => <Customers />,
  "/products": () => <Products />,
  "/categories": () => <Categories />,
  "/brands": () => <Brands />,
  "/banners": () => <Banners />,
  "/sections": () => <Sections />,
  "/promos": () => <Promos />,
  "/reviews": () => <Reviews />,
  "/delivery": () => <Delivery />,
  "/addons": () => <Addons />,
  "/settings": () => <Settings />,
  "/theme": () => <Theme />,
  "/tracking": () => <Tracking />,
  "/staff": () => <Staff />,
  "/developer": () => <Developer />,
};

function Shell() {
  const { path } = useRoute();
  const { authUser, setAuthUser } = useStore();
  const [checking, setChecking] = useState(() => Boolean(getAdminToken()));

  useEffect(() => {
    const tok = getAdminToken();
    if (!tok) {
      setChecking(false);
      return;
    }
    let mounted = true;
    proxyFetch("/verify-token", {})
      .then((res) => {
        if (!mounted) return;
        if (res?.valid && res?.user) {
          setAuthUser({
            email: String(res.user.sub || res.user.email || "admin"),
            role: String(res.user.role || "master_admin"),
            permissions: res.user.permissions || ["*"],
          });
        } else {
          try {
            localStorage.removeItem("admin_token");
            localStorage.removeItem("admin_token_exp");
          } catch {}
          setAuthUser(null);
        }
      })
      .catch(() => {
        if (!mounted) return;
        setAuthUser(null);
      })
      .finally(() => {
        if (mounted) setChecking(false);
      });
    return () => { mounted = false; };
  }, [setAuthUser]);

  useEffect(() => {
    const onUnauth = () => setAuthUser(null);
    window.addEventListener("adm-unauthorized", onUnauth);
    return () => window.removeEventListener("adm-unauthorized", onUnauth);
  }, [setAuthUser]);

  const handleLogout = async () => {
    try { await proxyFetch("/admin-logout", {}); } catch {}
    try {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_token_exp");
    } catch {}
    setAuthUser(null);
  };

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-600">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 shadow-sm">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <span className="text-sm font-medium">Verifying admin session…</span>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return <Login onDone={(u) => setAuthUser(u)} />;
  }

  const page = ROUTES[path] || ROUTES["/dashboard"];
  return (
    <Layout path={ROUTES[path] ? path : "/dashboard"} onLogout={handleLogout}>
      {page()}
    </Layout>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
