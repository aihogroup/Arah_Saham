import { Suspense } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { Skeleton } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };

async function Gate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminShell>
      <Suspense fallback={<Skeleton className="h-96" />}><Gate>{children}</Gate></Suspense>
    </AdminShell>
  );
}
