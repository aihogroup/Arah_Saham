"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

/** Kolom kata sandi dengan tombol tampilkan/sembunyikan (mencegah salah ketik tanpa kolom "ulangi kata sandi"). */
export default function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={show ? "text" : "password"} className={`input pe-12 ${props.className ?? ""}`} />
      <button type="button" className="absolute inset-y-0 end-0 grid w-11 place-items-center text-muted hover:text-foreground"
        aria-label={show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"} aria-pressed={show} onClick={() => setShow((s) => !s)}>
        {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </div>
  );
}
