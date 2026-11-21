import type { Lang } from "@/lib/prefs";

/**
 * Kamus antarmuka. Bahasa Indonesia adalah bahasa dasar (dipakai saat render server dan bila kunci belum diterjemahkan).
 * Yang diterjemahkan: navigasi, footer, halaman Pasar/Saham/Pengaturan, dan label tabel. Isi artikel blog, narasi analisis,
 * dan teks hukum tetap berbahasa Indonesia.
 */
const id = {
  "nav.market": "Pasar", "nav.stocks": "Saham", "nav.blog": "Blog", "nav.pricing": "Harga", "nav.settings": "Pengaturan",
  "nav.analysis": "Analisis", "nav.myAnalysis": "Analisis Saya", "nav.account": "Akun", "nav.admin": "Admin", "nav.openMenu": "Buka menu",
  "nav.main": "Menu utama", "nav.mobile": "Navigasi ponsel", "nav.home": "Beranda",
  "auth.login": "Masuk", "auth.signup": "Daftar",
  "footer.tagline": "Analisis arah pasar saham Indonesia berbasis data, disajikan sederhana.",
  "footer.product": "Produk", "footer.ranking": "Peringkat", "footer.indexChanges": "Perubahan indeks", "footer.company": "Perusahaan",
  "footer.legal": "Legal", "footer.terms": "Syarat layanan", "footer.privacy": "Kebijakan privasi", "footer.disclaimer": "Disclaimer",

  "cat.komoditas": "Komoditas", "cat.kurs": "Kurs", "cat.indeks_global": "Indeks global", "cat.proksi_id": "Proksi Indonesia",
  "cat.komoditas.lead": "Harga energi, logam, dan komoditas yang memengaruhi emiten Indonesia.",
  "cat.kurs.lead": "Nilai tukar rupiah dan mata uang mitra dagang utama.",
  "cat.indeks_global.lead": "Bursa Amerika, Eropa, dan Asia yang menjadi acuan sentimen IHSG.",
  "cat.proksi_id.lead": "Instrumen Indonesia yang diperdagangkan di luar negeri, bergerak lebih dulu dari IHSG.",
  "market.title": "Pasar", "market.lead": "Kondisi IHSG dan pasar yang memengaruhinya. Klik kategori atau instrumen untuk melihat riwayat lengkap.",
  "market.breadth": "Breadth", "market.advDec": "saham naik / turun", "market.aboveMa": "Di atas rata-rata 20 hari", "market.ofAll": "dari seluruh saham",
  "market.value": "Nilai transaksi", "market.valueSub": "rupiah, seluruh saham", "market.viewAll": "Lihat semua", "market.instruments": "instrumen",
  "market.back": "Kembali ke Pasar", "market.history": "Riwayat harga", "market.perf": "Kinerja", "market.range": "Rentang data", "market.days": "hari data",
  "market.loadMore": "Muat lebih banyak", "market.since": "Data sejak", "market.high": "Tertinggi", "market.low": "Terendah", "market.period": "Periode grafik",
  "market.incomplete": "Data hari ini belum lengkap. Angka di bawah adalah data lengkap terakhir.",
  "col.name": "Nama", "col.last": "Terakhir", "col.d1": "1H", "col.w1": "1M", "col.m1": "1B", "col.m3": "3B", "col.ytd": "YTD", "col.y1": "1T",
  "col.date": "Tanggal", "col.close": "Penutupan", "col.change": "Perubahan", "col.trend": "Tren", "col.code": "Kode", "col.price": "Harga",
  "col.value": "Nilai", "col.sector": "Sektor", "col.board": "Papan", "col.stocks": "Saham", "col.avg": "Rata-rata perubahan", "col.upDown": "Naik / turun",
  "per.1m": "1 bulan", "per.3m": "3 bulan", "per.6m": "6 bulan", "per.1y": "1 tahun", "per.5y": "5 tahun", "per.max": "Semua",

  "stocks.title": "Daftar saham", "stocks.lead": "Telusuri saham IDX menurut sektor, papan, atau indeks. Pengunjung melihat 10 saham teratas; akun gratis membuka seluruh daftar.",
  "stocks.tab.all": "Semua", "stocks.tab.sektor": "Sektor", "stocks.tab.papan": "Papan", "stocks.tab.indeks": "Indeks",
  "stocks.noIndexData": "Keanggotaan belum diunggah admin.", "stocks.members": "saham", "stocks.back": "Kembali ke daftar saham",
  "stocks.group.sektor": "Sektor", "stocks.group.papan": "Papan pencatatan", "stocks.group.indeks": "Indeks",
  "stocks.empty": "Belum ada saham pada kelompok ini.", "stocks.lockedGroup": "Daftar lengkap saham pada kelompok ini tersedia untuk akun gratis.",
  "stocks.sort": "Urutkan", "stocks.unclassified": "Belum dikelompokkan",

  "seas.title": "Seasonality", "seas.lead": "Rata-rata perubahan menurut waktu, dihitung dari riwayat data yang tersedia. Pola masa lalu tidak menjamin hasil di masa depan.",
  "seas.monthly": "Bulanan", "seas.weekday": "Hari", "seas.years": "Tahun terakhir", "seas.all": "Semua", "seas.avg": "Rata-rata", "seas.year": "Tahun",
  "seas.up": "Naik", "seas.down": "Turun", "seas.total": "Total", "seas.prob": "Peluang naik", "seas.day": "Hari", "seas.avgChange": "Rata-rata perubahan",
  "seas.loading": "Memuat seasonality…", "seas.none": "Data seasonality belum tersedia.", "seas.error": "Gagal memuat seasonality.",
  "set.title": "Pengaturan tampilan", "set.lead": "Sesuaikan tampilan agar nyaman dibaca. Pengaturan tersimpan di perangkat ini.",
  "set.language": "Bahasa", "set.language.hint": "Bahasa antarmuka. Artikel blog dan narasi analisis tetap berbahasa Indonesia.", "set.lang.id": "Bahasa Indonesia", "set.lang.en": "English",
  "set.theme": "Tema", "set.theme.system": "Ikuti sistem", "set.theme.light": "Terang", "set.theme.dark": "Gelap",
  "set.accent": "Warna aksen", "set.accent.cobalt": "Kobalt", "set.accent.emerald": "Zamrud", "set.accent.violet": "Ungu", "set.accent.orange": "Jingga", "set.accent.rose": "Mawar",
  "set.fontSize": "Ukuran teks", "set.fs.s": "Kecil", "set.fs.m": "Normal", "set.fs.l": "Besar", "set.fs.xl": "Sangat besar",
  "set.access": "Aksesibilitas", "set.cb": "Palet ramah buta warna", "set.cb.hint": "Naik berwarna biru dan turun berwarna jingga, tidak lagi hijau/merah. Panah dan tanda +/− tetap ditampilkan.",
  "set.contrast": "Kontras tinggi", "set.contrast.hint": "Teks sekunder dan garis pemisah dibuat lebih tegas.",
  "set.motion": "Kurangi animasi", "set.motion.hint": "Menghentikan pita pasar berjalan dan animasi pemuatan.",
  "set.density": "Kepadatan tabel", "set.density.comfortable": "Nyaman", "set.density.compact": "Ringkas",
  "set.preview": "Pratinjau", "set.previewText": "Contoh teks, angka, dan perubahan harga.", "set.reset": "Kembalikan ke bawaan", "set.saved": "Perubahan diterapkan langsung dan tersimpan di perangkat ini.",
} as const;

export type Key = keyof typeof id;

const en: Record<Key, string> = {
  "nav.market": "Market", "nav.stocks": "Stocks", "nav.blog": "Blog", "nav.pricing": "Pricing", "nav.settings": "Settings",
  "nav.analysis": "Analysis", "nav.myAnalysis": "My Analysis", "nav.account": "Account", "nav.admin": "Admin", "nav.openMenu": "Open menu",
  "nav.main": "Main menu", "nav.mobile": "Mobile navigation", "nav.home": "Home",
  "auth.login": "Sign in", "auth.signup": "Sign up",
  "footer.tagline": "Data-driven analysis of the Indonesian stock market direction, kept simple.",
  "footer.product": "Product", "footer.ranking": "Rankings", "footer.indexChanges": "Index changes", "footer.company": "Company",
  "footer.legal": "Legal", "footer.terms": "Terms of service", "footer.privacy": "Privacy policy", "footer.disclaimer": "Disclaimer",

  "cat.komoditas": "Commodities", "cat.kurs": "Currencies", "cat.indeks_global": "Global indices", "cat.proksi_id": "Indonesia proxies",
  "cat.komoditas.lead": "Energy, metals, and commodity prices that move Indonesian issuers.",
  "cat.kurs.lead": "The rupiah and the currencies of major trading partners.",
  "cat.indeks_global.lead": "US, European, and Asian markets that set the tone for the IDX Composite.",
  "cat.proksi_id.lead": "Indonesian instruments traded overseas, which often move ahead of the IDX Composite.",
  "market.title": "Market", "market.lead": "The IDX Composite and the markets that influence it. Click a category or instrument for its full history.",
  "market.breadth": "Breadth", "market.advDec": "stocks up / down", "market.aboveMa": "Above 20-day average", "market.ofAll": "of all stocks",
  "market.value": "Traded value", "market.valueSub": "rupiah, all stocks", "market.viewAll": "View all", "market.instruments": "instruments",
  "market.back": "Back to Market", "market.history": "Price history", "market.perf": "Performance", "market.range": "Data range", "market.days": "data days",
  "market.loadMore": "Load more", "market.since": "Data since", "market.high": "High", "market.low": "Low", "market.period": "Chart period",
  "market.incomplete": "Today's data is not complete yet. The figures below are the latest complete data.",
  "col.name": "Name", "col.last": "Last", "col.d1": "1D", "col.w1": "1W", "col.m1": "1M", "col.m3": "3M", "col.ytd": "YTD", "col.y1": "1Y",
  "col.date": "Date", "col.close": "Close", "col.change": "Change", "col.trend": "Trend", "col.code": "Code", "col.price": "Price",
  "col.value": "Value", "col.sector": "Sector", "col.board": "Board", "col.stocks": "Stocks", "col.avg": "Average change", "col.upDown": "Up / down",
  "per.1m": "1 month", "per.3m": "3 months", "per.6m": "6 months", "per.1y": "1 year", "per.5y": "5 years", "per.max": "All",

  "stocks.title": "Stock list", "stocks.lead": "Browse IDX stocks by sector, board, or index. Visitors see the top 10; free accounts unlock the full list.",
  "stocks.tab.all": "All", "stocks.tab.sektor": "Sector", "stocks.tab.papan": "Board", "stocks.tab.indeks": "Index",
  "stocks.noIndexData": "Membership has not been uploaded by an admin yet.", "stocks.members": "stocks", "stocks.back": "Back to stock list",
  "stocks.group.sektor": "Sector", "stocks.group.papan": "Listing board", "stocks.group.indeks": "Index",
  "stocks.empty": "No stocks in this group yet.", "stocks.lockedGroup": "The full list of stocks in this group is available with a free account.",
  "stocks.sort": "Sort", "stocks.unclassified": "Unclassified",

  "seas.title": "Seasonality", "seas.lead": "Average change by time period, computed from the available history. Past patterns do not guarantee future results.",
  "seas.monthly": "Monthly", "seas.weekday": "Weekday", "seas.years": "Last years", "seas.all": "All", "seas.avg": "Average", "seas.year": "Year",
  "seas.up": "Up", "seas.down": "Down", "seas.total": "Total", "seas.prob": "Up probability", "seas.day": "Day", "seas.avgChange": "Average change",
  "seas.loading": "Loading seasonality…", "seas.none": "Seasonality data is not available yet.", "seas.error": "Failed to load seasonality.",
  "set.title": "Display settings", "set.lead": "Adjust the display so it is comfortable to read. Settings are stored on this device.",
  "set.language": "Language", "set.language.hint": "Interface language. Blog articles and analysis narratives remain in Indonesian.", "set.lang.id": "Bahasa Indonesia", "set.lang.en": "English",
  "set.theme": "Theme", "set.theme.system": "Follow system", "set.theme.light": "Light", "set.theme.dark": "Dark",
  "set.accent": "Accent color", "set.accent.cobalt": "Cobalt", "set.accent.emerald": "Emerald", "set.accent.violet": "Violet", "set.accent.orange": "Orange", "set.accent.rose": "Rose",
  "set.fontSize": "Text size", "set.fs.s": "Small", "set.fs.m": "Normal", "set.fs.l": "Large", "set.fs.xl": "Extra large",
  "set.access": "Accessibility", "set.cb": "Color-blind friendly palette", "set.cb.hint": "Up is blue and down is orange instead of green/red. Arrows and +/− signs are always shown.",
  "set.contrast": "High contrast", "set.contrast.hint": "Secondary text and dividers are made stronger.",
  "set.motion": "Reduce motion", "set.motion.hint": "Stops the scrolling market ticker and loading animations.",
  "set.density": "Table density", "set.density.comfortable": "Comfortable", "set.density.compact": "Compact",
  "set.preview": "Preview", "set.previewText": "Sample text, numbers, and price changes.", "set.reset": "Reset to defaults", "set.saved": "Changes apply immediately and are stored on this device.",
};

export const DICT: Record<Lang, Record<Key, string>> = { id, en };
export const tr = (lang: Lang, k: Key): string => DICT[lang][k] ?? DICT.id[k] ?? k;
