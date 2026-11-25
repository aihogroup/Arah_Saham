import { Suspense } from "react";
import { Header, Footer, MobileNav } from "@/components/SiteChrome";
import PageSkeleton from "@/components/PageSkeleton";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main id="konten" className="container-x pb-bottom-nav min-h-[60vh] pt-6 sm:pt-8">
        <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
      </main>
      <Footer />
      <MobileNav />
    </>
  );
}
