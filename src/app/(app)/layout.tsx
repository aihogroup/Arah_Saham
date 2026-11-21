import { Suspense } from "react";
import { Header, Footer, MobileNav } from "@/components/SiteChrome";
import { Skeleton } from "@/components/ui";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main id="konten" className="container-x min-h-[60vh] py-8 pb-24">
        <Suspense fallback={<Skeleton className="h-96" />}>{children}</Suspense>
      </main>
      <Footer />
      <MobileNav />
    </>
  );
}
