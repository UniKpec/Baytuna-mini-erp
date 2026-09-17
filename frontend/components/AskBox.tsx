"use client";

import { useState } from "react";
import { SendIcon } from "lucide-react";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(question);
  }

  function handleExample(example: string) {
    setQuestion(example);
    void ask(example);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verilere soru sor</CardTitle>
        <CardDescription>Son 7 günün siparişleri ve güncel stok durumu üzerinden cevaplanır.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            aria-label="Soru"
            maxLength={MAX_LENGTH}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Örneğin: Bu hafta en çok hangi ürün reddedildi?"
            className="flex-1"
          />
          <Button type="submit" disabled={asking || !question.trim()}>
            {asking ? <Spinner aria-label="Düşünüyor" /> : <SendIcon />}
            Sor
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {EXAMPLES.map((example) => (
            <Button
              key={example}
              type="button"
              variant="outline"
              size="xs"
              onClick={() => handleExample(example)}
              disabled={asking}
            >
              {example}
            </Button>
          ))}
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            {question.length}/{MAX_LENGTH}
          </span>
        </div>

        {asking && <p className="text-sm text-muted-foreground">Yapay zekâ verileri inceliyor…</p>}

        {error && <ErrorState title="Soru cevaplanamadı" message={error} />}

        {result && (
          <div className="rounded-lg bg-muted p-4">
            <p className="text-xs font-medium text-muted-foreground">{result.question}</p>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{result.answer}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
