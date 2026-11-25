// Struktur menu header: kelompok menu dengan panel mengambang (mega-menu).

export type NavLink = { href: string; label: string; hint?: string; premium?: boolean };
export type NavSection = { title: string; links: NavLink[]; cols?: 1 | 2 };
export type NavMenuDef = { id: string; label: string; href: string; sections: NavSection[] };

const g = (kind: string, v: string) => `/saham/kelompok/${kind}/${encodeURIComponent(v)}`;

export const SECTORS = ["Financials", "Energy", "Basic Materials", "Consumer Non-Cyclicals", "Consumer Cyclicals", "Infrastructures", "Technology", "Healthcare", "Industrials", "Properties & Real Estate", "Transportation & Logistic"];
export const SECTOR_LABEL: Record<string, string> = {
  Financials: "Keuangan", Energy: "Energi", "Basic Materials": "Barang Baku", "Consumer Non-Cyclicals": "Barang Konsumen Primer", "Consumer Cyclicals": "Barang Konsumen Non-Primer",
  Infrastructures: "Infrastruktur", Technology: "Teknologi", Healthcare: "Kesehatan", Industrials: "Perindustrian", "Properties & Real Estate": "Properti dan Real Estat", "Transportation & Logistic": "Transportasi dan Logistik",
};
export const BOARDS = ["Utama", "Pengembangan", "Akselerasi", "Ekonomi Baru", "Pemantauan Khusus"];
export const INDEXES: [string, string][] = [["COMPOSITE", "IHSG"], ["IDX30", "IDX30"], ["LQ45", "LQ45"], ["IDX80", "IDX80"], ["KOMPAS100", "KOMPAS100"], ["IDXHIDIV20", "IDX High Dividend 20"], ["SRI-KEHATI", "SRI-KEHATI"], ["JII", "JII"]];

export const MENUS: NavMenuDef[] = [
  {
    id: "saham", label: "Saham", href: "/saham",
    sections: [
      { title: "Jelajahi", links: [
        { href: "/saham", label: "Semua saham", hint: "Cari dan urutkan" },
        { href: "/peringkat?jenis=gainer", label: "Top gainer" }, { href: "/peringkat?jenis=loser", label: "Top loser" },
        { href: "/peringkat?jenis=value", label: "Top value" }, { href: "/peringkat?jenis=volume", label: "Top volume" },
        { href: "/peringkat?jenis=frequency", label: "Top frekuensi" }, { href: "/peringkat?jenis=net_foreign_buy", label: "Net asing beli" },
        { href: "/free-float", label: "Free float dan risiko gorengan" },
      ] },
      { title: "Sektor", cols: 1, links: SECTORS.map((s) => ({ href: g("sektor", s), label: SECTOR_LABEL[s] ?? s })) },
      { title: "Papan pencatatan", links: BOARDS.map((b) => ({ href: g("papan", b), label: b })) },
      { title: "Indeks", links: [...INDEXES.map(([c, l]) => ({ href: g("indeks", c), label: l })), { href: "/saham?lihat=indeks", label: "Semua indeks →" }] },
    ],
  },
  {
    id: "pasar", label: "Pasar", href: "/pasar",
    sections: [
      { title: "Ringkasan", links: [
        { href: "/pasar", label: "IHSG dan pasar", hint: "Breadth dan grafik" },
        { href: "/pasar/pergerakan", label: "Analisis pergerakan", hint: "Pengaruh ke IHSG" },
        { href: "/indeks", label: "Perubahan anggota indeks" },
      ] },
      { title: "Instrumen", links: [
        { href: "/pasar/indeks-global", label: "Indeks global" }, { href: "/pasar/kurs", label: "Kurs" }, { href: "/pasar/komoditas", label: "Komoditas" },
        { href: "/pasar/proksi-indonesia", label: "Proksi Indonesia" },
      ] },
      { title: "Broker", links: [
        { href: "/pasar/pergerakan#h-broker", label: "Pergerakan broker", hint: "Aktivitas dan konsentrasi" }, { href: "/broker", label: "Pangsa tiap broker" },
      ] },
    ],
  },
  {
    id: "analisis", label: "Analisis", href: "/beranda",
    sections: [
      { title: "Untuk Anda", links: [
        { href: "/beranda", label: "Beranda Premium", hint: "Saran harian dan portofolio", premium: true },
        { href: "/analisis", label: "Analisis saya", hint: "Pilih indeks dan indikator", premium: true },
        { href: "/analisis/pasar", label: "Kondisi pasar besok", premium: true },
      ] },
      { title: "Catatan", links: [
        { href: "/watchlist", label: "Watchlist" }, { href: "/riwayat", label: "Riwayat ketepatan sinyal", premium: true },
      ] },
    ],
  },
];

export const PLAIN_LINKS: NavLink[] = [{ href: "/harga", label: "Harga" }, { href: "/blog", label: "Blog" }];
