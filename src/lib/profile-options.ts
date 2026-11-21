// Pilihan isian profil dan batas usia (juga ditegakkan di database oleh trigger profiles_check_birth).

export const MIN_AGE = 17;
export const MAX_AGE = 100;

export const OCCUPATIONS = [
  "Pelajar / Mahasiswa", "Karyawan swasta", "Pegawai negeri / ASN", "TNI / Polri", "Pegawai BUMN / BUMD",
  "Profesional (dokter, pengacara, akuntan, dll.)", "Guru / Dosen", "Pengusaha / Wiraswasta", "Freelancer / Pekerja lepas",
  "Pekerja sektor keuangan / perbankan", "Pekerja teknologi informasi", "Petani / Nelayan", "Ibu rumah tangga", "Pensiunan", "Belum bekerja", "Lainnya",
] as const;

export const INCOME_RANGES = [
  { v: "<5jt", label: "Di bawah Rp5 juta" }, { v: "5-10jt", label: "Rp5 – 10 juta" }, { v: "10-25jt", label: "Rp10 – 25 juta" },
  { v: "25-50jt", label: "Rp25 – 50 juta" }, { v: ">50jt", label: "Di atas Rp50 juta" },
] as const;

/** Usia penuh (tahun) pada hari ini dari tanggal lahir YYYY-MM-DD; null bila tidak valid. */
export function ageOf(birth: string, today = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null; // mis. 31 Februari
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < mo || (today.getMonth() + 1 === mo && today.getDate() < d)) age--;
  return age;
}

/** Pesan galat bila usia di luar 17–100 tahun atau tanggal tidak valid; null bila lolos. */
export function birthError(birth: string, today = new Date()): string | null {
  const a = ageOf(birth, today);
  if (a === null) return "Tanggal lahir tidak valid.";
  if (a < MIN_AGE) return `Usia minimal ${MIN_AGE} tahun.`;
  if (a > MAX_AGE) return `Usia maksimal ${MAX_AGE} tahun. Periksa tahun lahir Anda.`;
  return null;
}
