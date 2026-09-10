"use client";

import { useState } from "react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { createCustomer } from "@/lib/api";

export default function NewCustomerPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();

        setSubmitting(true);
        setMessage(null);

        try {
            await createCustomer(
                name,
                email,
                phone
            );

            setMessage("Müşteri başarıyla eklendi.");

            setName("");
            setEmail("");
            setPhone("");
        } catch (err) {
            setMessage(
            err instanceof Error
                ? err.message
                : "Müşteri eklenemedi."
            );
        } finally {
            setSubmitting(false);
        }
    }

  return (
    <ProtectedPage>
        <div className="max-w-xl">
            <h1 className="text-xl font-semibold">Yeni Müşteri</h1>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">Ad Soyad</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="rounded-md border border-slate-300 px-3 py-2"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">E-posta</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="rounded-md border border-slate-300 px-3 py-2"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">Telefon</label>
                    <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="rounded-md border border-slate-300 px-3 py-2"
                    />
                </div>
                <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
                >
                    {submitting ? "Ekleniyor..." : "Müşteri Ekle"}
                </button>
                {message && (
                    <p className="text-sm text-slate-600">
                        {message}
                    </p>
                )}
            </form>
        </div>
    </ProtectedPage>
  );
}