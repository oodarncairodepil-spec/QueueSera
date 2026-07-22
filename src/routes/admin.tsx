import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAdminSession } from "@/shared/hooks/useAdminSession";
import { CalendarCog, KeyRound, ListOrdered, LogOut } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { session, loaded, logout } = useAdminSession();
  const isLogin = pathname === "/admin/login";
  const isBookingDetail = /^\/admin\/bookings\/[^/]+$/.test(pathname);

  useEffect(() => {
    if (!loaded) return;
    if (!session && !isLogin) {
      navigate({ to: "/admin/login" });
    }
  }, [loaded, session, isLogin, navigate]);

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!session) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <div className="text-sm font-semibold">EventQueue Admin</div>
            <div className="text-xs text-muted-foreground">{session.email}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate({ to: "/admin/login" });
            }}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </header>

      <div className={isBookingDetail ? "" : "pb-24"}>
        <Outlet />
      </div>

      {!isBookingDetail && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="mx-auto grid max-w-5xl grid-cols-3">
            <Link
              to="/admin/codes"
              className="flex flex-col items-center gap-1 px-1 py-3 text-[11px] font-medium transition-colors sm:text-xs"
              activeProps={{ className: "text-primary" }}
              inactiveProps={{ className: "text-muted-foreground" }}
            >
              <KeyRound className="h-5 w-5" />
              Codes
            </Link>
            <Link
              to="/admin/bookings"
              className="flex flex-col items-center gap-1 px-1 py-3 text-[11px] font-medium transition-colors sm:text-xs"
              activeProps={{ className: "text-primary" }}
              inactiveProps={{ className: "text-muted-foreground" }}
            >
              <ListOrdered className="h-5 w-5" />
              Bookings
            </Link>
            <Link
              to="/admin/event"
              className="flex flex-col items-center gap-1 px-1 py-3 text-[11px] font-medium transition-colors sm:text-xs"
              activeProps={{ className: "text-primary" }}
              inactiveProps={{ className: "text-muted-foreground" }}
            >
              <CalendarCog className="h-5 w-5" />
              Event
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}
