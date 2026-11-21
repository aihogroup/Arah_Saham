import { Suspense } from "react";
import { AnnouncementBar, Footer, Header, MobileNav, Ticker } from "@/components/SiteChrome";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}><AnnouncementBar /></Suspense>
      <Header />
      <Suspense fallback={<div className="h-10 border-b border-line bg-surface" />}><Ticker /></Suspense>
      <main id="konten" className="flex-1">{children}</main>
      <Footer />
      <MobileNav />
    </>
  );
}
