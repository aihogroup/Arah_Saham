"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { revalidateContent } from "@/app/admin/actions";
import { createClient } from "@/lib/supabase/client";

type Status = "draft" | "published";
type P = { id: string; slug: string; title: string; excerpt: string | null; body_md: string; cover_url: string | null; status: Status; publish_at: string | null };
type Form = { id: string; slug: string; title: string; excerpt: string; body_md: string; cover_url: string; status: Status; publish_at: string };
const EMPTY: Form = { id: "", slug: "", title: "", excerpt: "", body_md: "", cover_url: "", status: "draft", publish_at: "" };
const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);

const BUCKET = "blog-images", MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };

/** Unggah gambar ke bucket publik `blog-images` (hanya admin yang boleh menulis) dan kembalikan URL publiknya. */
async function uploadImage(file: File): Promise<string> {
  const ext = TYPES[file.type];
  if (!ext) throw new Error("Format harus JPG, PNG, WebP, GIF, atau AVIF.");
  if (file.size > MAX_BYTES) throw new Error("Ukuran gambar maksimal 5 MB.");
  const sb = createClient();
  const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) throw new Error("Gagal mengunggah gambar.");
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export default function BlogAdmin() {
  const [posts, setPosts] = useState<P[]>([]);
  const [f, setF] = useState<Form>(EMPTY);
  const [preview, setPreview] = useState(false);
  const [alt, setAlt] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    const { data } = await createClient().from("blog_posts").select("id,slug,title,excerpt,body_md,cover_url,status,publish_at").order("created_at", { ascending: false });
    setPosts((data as P[]) ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function pickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setBusy(true); setMsg(null);
    try { const url = await uploadImage(file); setF((p) => ({ ...p, cover_url: url })); setMsg({ ok: true, t: "Gambar sampul terunggah. Simpan artikel untuk menerapkannya." }); }
    catch (err) { setMsg({ ok: false, t: (err as Error).message }); }
    setBusy(false);
  }

  async function pickInline(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setBusy(true); setMsg(null);
    try {
      const url = await uploadImage(file);
      const md = `\n![${alt.trim() || "Gambar"}](${url})\n`;
      const el = bodyRef.current;
      setF((p) => {
        const at = el ? el.selectionStart : p.body_md.length;
        return { ...p, body_md: p.body_md.slice(0, at) + md + p.body_md.slice(at) };
      });
      setAlt(""); setPreview(false);
      setMsg({ ok: true, t: "Gambar disisipkan ke isi artikel." });
    } catch (err) { setMsg({ ok: false, t: (err as Error).message }); }
    setBusy(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const slug = f.slug || slugify(f.title);
    if (!f.title.trim() || !/^[a-z0-9-]{3,120}$/.test(slug)) return setMsg({ ok: false, t: "Judul wajib dan slug 3–120 karakter (a–z, 0–9, tanda hubung)." });
    const sb = createClient();
    const { data: u } = await sb.auth.getUser();
    const row = { slug, title: f.title.trim(), excerpt: f.excerpt || null, body_md: f.body_md, cover_url: f.cover_url || null, status: f.status, publish_at: f.status === "published" ? (f.publish_at ? new Date(f.publish_at).toISOString() : new Date().toISOString()) : null, author_id: u.user!.id };
    const { error } = f.id ? await sb.from("blog_posts").update(row).eq("id", f.id) : await sb.from("blog_posts").insert(row);
    if (error) return setMsg({ ok: false, t: error.code === "23505" ? "Slug sudah dipakai." : "Gagal menyimpan." });
    setMsg({ ok: true, t: "Tersimpan." }); setF(EMPTY); load(); revalidateContent("blog");
  }
  async function del(p: P) {
    if (!confirm(`Hapus artikel "${p.title}"? Tidak bisa dibatalkan.`)) return;
    await createClient().from("blog_posts").delete().eq("id", p.id); load(); revalidateContent("blog");
  }

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="card space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label htmlFor="bt" className="mb-1 block text-[13px]">Judul</label><input id="bt" className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div><label htmlFor="bs" className="mb-1 block text-[13px]">Slug (otomatis bila kosong)</label><input id="bs" className="input" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} placeholder={slugify(f.title)} /></div>
          <div className="sm:col-span-2"><label htmlFor="be" className="mb-1 block text-[13px]">Ringkasan</label><input id="be" className="input" value={f.excerpt} onChange={(e) => setF({ ...f, excerpt: e.target.value })} /></div>
        </div>

        <div className="rounded-xl border border-line p-3">
          <p className="mb-2 text-[13px] font-medium">Gambar sampul</p>
          {f.cover_url ? (
            <div className="flex flex-wrap items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.cover_url} alt="Pratinjau sampul" className="max-h-40 rounded-lg border border-line" />
              <button type="button" className="btn" onClick={() => setF({ ...f, cover_url: "" })}>Hapus sampul</button>
            </div>
          ) : <p className="mb-2 text-[13px] text-muted">Belum ada sampul. JPG/PNG/WebP/GIF/AVIF, maksimal 5 MB.</p>}
          <label className="btn mt-2 cursor-pointer">{busy ? "Mengunggah…" : f.cover_url ? "Ganti sampul" : "Unggah sampul"}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" className="sr-only" onChange={pickCover} disabled={busy} /></label>
        </div>

        <div><div className="mb-1 flex items-center justify-between"><label htmlFor="bb" className="text-[13px]">Isi (Markdown)</label><button type="button" className="underline text-[13px]" onClick={() => setPreview(!preview)}>{preview ? "Edit" : "Pratinjau"}</button></div>
          {preview ? <div className="prose-id card"><ReactMarkdown skipHtml>{f.body_md}</ReactMarkdown></div> : <textarea id="bb" ref={bodyRef} rows={12} className="input font-mono" value={f.body_md} onChange={(e) => setF({ ...f, body_md: e.target.value })} />}
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <div className="min-w-[200px] flex-1"><label htmlFor="ba" className="mb-1 block text-[13px]">Teks alternatif gambar (aksesibilitas)</label><input id="ba" className="input" value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Mis. Grafik IHSG sepanjang 2026" /></div>
            <label className="btn cursor-pointer">{busy ? "Mengunggah…" : "Sisipkan gambar"}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" className="sr-only" onChange={pickInline} disabled={busy} /></label>
          </div>
          <p className="mt-1 text-[12px] text-muted">Gambar disisipkan di posisi kursor sebagai <code>![teks](url)</code>.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div><label htmlFor="bst" className="mb-1 block text-[13px]">Status</label><select id="bst" className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Status })}><option value="draft">Draf</option><option value="published">Terbit</option></select></div>
          <div><label htmlFor="bp" className="mb-1 block text-[13px]">Waktu terbit</label><input id="bp" type="datetime-local" className="input" value={f.publish_at} onChange={(e) => setF({ ...f, publish_at: e.target.value })} /></div>
          <button className="btn btn-primary" disabled={busy}>{f.id ? "Perbarui" : "Simpan"}</button>
          {f.id && <button type="button" className="btn" onClick={() => setF(EMPTY)}>Batal</button>}
        </div>
        {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "up" : "down"}>{msg.t}</p>}
      </form>
      <table className="data"><thead><tr><th>Judul</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody>{posts.map((p) => <tr key={p.id}><td>{p.title}<br /><span className="text-[12px] text-muted">/{p.slug}</span></td><td>{p.status === "published" ? "Terbit" : "Draf"}</td>
          <td className="space-x-3"><button className="underline" onClick={() => { setF({ id: p.id, slug: p.slug, title: p.title, excerpt: p.excerpt ?? "", body_md: p.body_md, cover_url: p.cover_url ?? "", status: p.status, publish_at: p.publish_at ? p.publish_at.slice(0, 16) : "" }); window.scrollTo({ top: 0 }); }}>Ubah</button><button className="underline down" onClick={() => del(p)}>Hapus</button></td></tr>)}</tbody></table>
    </div>
  );
}
