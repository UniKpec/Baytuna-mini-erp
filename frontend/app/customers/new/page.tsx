"use client";

import Link from "next/link";
import { useState } from "react";
import { PageToolbar } from "@/components/page-toolbar";
import { ProtectedPage } from "@/components/ProtectedPage";
import { FormResultAlert, type FormResult } from "@/components/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ApiError, createCustomer } from "@/lib/api";

export default function NewCustomerPage() {
  return (
    <ProtectedPage allowedRoles={["sales", "admin"]}>
      <NewCustomerForm />
    </ProtectedPage>
  );
}

function NewCustomerForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<FormResult>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setResult(null);

    try {
      const customer = await createCustomer(name.trim(), email.trim(), phone.trim());
      setResult({
        type: "success",
        title: "Müşteri eklendi",
        message: (
          <>
            {customer.name} artık sipariş oluştururken seçilebilir.{" "}
            <Link href="/customers">Müşteri listesine dön</Link>
          </>
        ),
      });
      setName("");
      setEmail("");
      setPhone("");
    } catch (caught) {
      setResult({
        type: "error",
        title: "Müşteri eklenemedi",
        message: caught instanceof ApiError ? caught.message : "Beklenmeyen bir hata oluştu.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageToolbar description="Sipariş verilebilecek yeni bir müşteri kaydet.">
        <Link href="/customers" className={buttonVariants({ variant: "outline" })}>
          Müşteri listesi
        </Link>
      </PageToolbar>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Müşteri bilgileri</CardTitle>
          <CardDescription>Sipariş onay maili bu e-posta adresine gönderilir.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Ad soyad</FieldLabel>
                <Input id="name" required maxLength={255} value={name} onChange={(event) => setName(event.target.value)} />
              </Field>

              <Field>
                <FieldLabel htmlFor="email">E-posta</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  required
                  maxLength={255}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="phone">Telefon</FieldLabel>
                <Input
                  id="phone"
                  type="tel"
                  maxLength={30}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
                <FieldDescription>İsteğe bağlı.</FieldDescription>
              </Field>

              <FormResultAlert result={result} />

              <Button type="submit" disabled={submitting} className="w-fit">
                {submitting && <Spinner aria-label="Ekleniyor" />}
                {submitting ? "Ekleniyor…" : "Müşteri ekle"}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
