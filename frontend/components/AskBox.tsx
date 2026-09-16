"use client";

import { useState } from "react";
import { ApiError, askReport } from "@/lib/api";
import type { ReportAnswer } from "@/lib/types";

// Backend'deki sınırla aynı; formda önceden göstermek boşuna istek atılmasını önlüyor.
const MAX_LENGTH = 500;

const EXAMPLES = [
  "Bu hafta en çok hangi ürün reddedildi?",
  "Kritik stokta hangi ürünler var?",
  "Bu haftanın cirosu geçen haftaya göre nasıl?",
];

export function AskBox() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<ReportAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || asking) return;

    setAsking(true);
    setError(null);
    setResult(null);
    try {
      setResult(await askReport(trimmed));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Soru gönderilemedi.");
    } finally {
      setAsking(false);
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    void ask(question);
  }

  function handleExample(example: string) {
    setQuestion(example);
    void ask(example);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-medium text-slate-700">Verilere soru sor</h2>
      <p className="mt-1 text-xs text-slate-500">
        Son 7 günün siparişleri ve güncel stok durumu üzerinden cevaplanır.
      </p>

      <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap gap-2">
        <input
          type="text"
          aria-label="Soru"
          maxLength={MAX_LENGTH}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Örneğin: Bu hafta en çok hangi ürün reddedildi?"
          className="min-w-64 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        />
        <button
          type="submit"
          disabled={asking || !question.trim()}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
        >
          {asking ? "Düşünüyor…" : "Sor"}
        </button>
      </form>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => handleExample(example)}
            disabled={asking}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:border-slate-400 disabled:opacity-40"
          >
            {example}
          </button>
        ))}
        <span className="ml-auto text-xs tabular-nums text-slate-400">
          {question.length}/{MAX_LENGTH}
        </span>
      </div>

      {asking && <p className="mt-4 text-sm text-slate-500">Yapay zekâ verileri inceliyor…</p>}

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-4 rounded-md bg-slate-50 p-4">
          <p className="text-xs font-medium text-slate-500">{result.question}</p>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-800">{result.answer}</p>
        </div>
      )}
    </section>
  );
}
