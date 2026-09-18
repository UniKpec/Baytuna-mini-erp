"use client";

import { useEffect, useState } from "react";
import { CheckIcon, CopyIcon, KeyRoundIcon, Trash2Icon, TriangleAlertIcon, UserPlusIcon } from "lucide-react";
import { PageToolbar } from "@/components/page-toolbar";
import { ProtectedPage } from "@/components/ProtectedPage";
import { ErrorState, LoadingState } from "@/components/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError, createStaff, deleteStaff, getStaff, resetStaffPassword } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { ROLE_LABELS, type CreatedStaffMember, type Role, type StaffMember, type StaffRole } from "@/lib/types";

type Credentials = {
  name: string;
  email: string;
  password: string;
  reason: "created" | "reset";
};

const ROLE_ORDER: Record<Role, number> = { admin: 0, sales: 1, warehouse: 2 };

function fullName(member: StaffMember): string {
  return [member.first_name, member.last_name].filter(Boolean).join(" ") || "-";
}

function sortStaff(list: StaffMember[]): StaffMember[] {
  return [...list].sort(
    (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || fullName(a).localeCompare(fullName(b), "tr"),
  );
}

export default function StaffPage() {
  return (
    <ProtectedPage allowedRoles={["admin"]}>
      <StaffManagement />
    </ProtectedPage>
  );
}

function StaffManagement() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  useEffect(() => {
    getStaff()
      .then((list) => setStaff(sortStaff(list)))
      .catch((caught) => setLoadError(caught instanceof ApiError ? caught.message : "Personel listesi yüklenemedi."))
      .finally(() => setLoading(false));
  }, []);

  // Şifre yalnızca bir kez gösteriliyor; kart sayfanın en üstünde, gözden kaçmasın diye oraya kaydırıyoruz.
  function showCredentials(next: Credentials) {
    setCredentials(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCreated(created: CreatedStaffMember) {
    const { password, ...member } = created;
    setStaff((current) => sortStaff([...current, member]));
    showCredentials({ name: fullName(member), email: member.email, password, reason: "created" });
  }

  function handleReset(member: StaffMember, password: string) {
    showCredentials({ name: fullName(member), email: member.email, password, reason: "reset" });
  }

  function handleDeleted(member: StaffMember) {
    setStaff((current) => current.filter((item) => item.id !== member.id));
    // Silinen kişinin giriş bilgisi ekranda duruyorsa artık geçersiz; kaldırıyoruz.
    setCredentials((current) => (current?.email === member.email ? null : current));
  }

  return (
    <>
      <PageToolbar description="Satış ve depo personeli ekle. Giriş e-postası ve şifre otomatik oluşturulur." />

      <div className="flex flex-col gap-6">
        {credentials && (
          <CredentialsCard
            key={`${credentials.email}-${credentials.password}`}
            credentials={credentials}
            onDismiss={() => setCredentials(null)}
          />
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <NewStaffForm onCreated={handleCreated} />
          <HowItWorksCard />
        </div>

        <StaffTable staff={staff} loading={loading} error={loadError} onReset={handleReset} onDeleted={handleDeleted} />
      </div>
    </>
  );
}

function NewStaffForm({ onCreated }: { onCreated: (member: CreatedStaffMember) => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<StaffRole>("warehouse");
  const [contactEmail, setContactEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const member = await createStaff(firstName.trim(), lastName.trim(), role, contactEmail.trim() || null);
      onCreated(member);
      setFirstName("");
      setLastName("");
      setContactEmail("");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Personel eklenemedi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personel ekle</CardTitle>
        <CardDescription>Ad ve soyada göre giriş e-postası ve şifre otomatik oluşturulur.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="first-name">Ad</FieldLabel>
                <Input
                  id="first-name"
                  required
                  maxLength={100}
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="last-name">Soyad</FieldLabel>
                <Input
                  id="last-name"
                  required
                  maxLength={100}
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="role">Görev</FieldLabel>
              <NativeSelect
                id="role"
                className="w-full"
                value={role}
                onChange={(event) => setRole(event.target.value as StaffRole)}
              >
                <NativeSelectOption value="warehouse">{ROLE_LABELS.warehouse} personeli</NativeSelectOption>
                <NativeSelectOption value="sales">{ROLE_LABELS.sales} personeli</NativeSelectOption>
              </NativeSelect>
            </Field>

            <Field>
              <FieldLabel htmlFor="contact-email">İletişim e-postası (isteğe bağlı)</FieldLabel>
              <Input
                id="contact-email"
                type="email"
                maxLength={255}
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
              />
              <FieldDescription>
                Kritik stok gibi bildirimler bu adrese gider. Boş bırakılırsa bu kişiye mail gönderilmez.
              </FieldDescription>
            </Field>

            {error && <ErrorState title="Personel eklenemedi" message={error} />}

            <Button type="submit" disabled={submitting} className="w-fit">
              {submitting ? <Spinner aria-label="Oluşturuluyor" /> : <UserPlusIcon />}
              {submitting ? "Oluşturuluyor…" : "Personel ekle"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

function HowItWorksCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nasıl çalışır?</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
        <p>
          Giriş e-postası ad ve soyaddan üretilir; örneğin Ayşe Yılmaz için{" "}
          <code className="font-mono text-foreground">ayse.yilmaz@minierp.net.tr</code>. Aynı isimde biri varsa sonuna
          sayı eklenir.
        </p>
        <p>Şifre sistem tarafından rastgele oluşturulur ve yalnızca bir kez gösterilir. Kaybedilirse listeden sıfırlanabilir.</p>
        <p>
          Giriş e-postası gerçek bir posta kutusu değildir. Bildirimlerin ulaşması için iletişim e-postası girilmelidir;
          özellikle depo personeli kritik stok uyarılarını bu adresten alır.
        </p>
      </CardContent>
    </Card>
  );
}

function CredentialsCard({ credentials, onDismiss }: { credentials: Credentials; onDismiss: () => void }) {
  const title = credentials.reason === "created" ? "Personel oluşturuldu" : "Şifre sıfırlandı";

  return (
    <Card className="border-emerald-300 dark:border-emerald-800">
      <CardHeader>
        <CardTitle>
          {title}: {credentials.name}
        </CardTitle>
        <CardDescription>Aşağıdaki giriş bilgilerini personele ilet.</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            Kapat
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <CopyField label="Giriş e-postası" value={credentials.email} />
          <CopyField label="Şifre" value={credentials.password} />
        </div>
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>Şifre bir daha gösterilmeyecek</AlertTitle>
          <AlertDescription>
            Sistemde yalnızca şifrelenmiş hali saklanıyor. Kaybedilirse listeden &quot;Şifre sıfırla&quot; ile yenisi
            oluşturulabilir.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Tarayıcı pano erişimine izin vermezse metin seçilip elle kopyalanabilir.
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded-md border bg-muted px-3 py-2 font-mono text-sm break-all select-all">{value}</code>
        <Button type="button" variant="outline" size="icon-sm" onClick={handleCopy} aria-label={`${label} kopyala`}>
          {copied ? <CheckIcon /> : <CopyIcon />}
        </Button>
      </div>
    </div>
  );
}

function StaffTable({
  staff,
  loading,
  error,
  onReset,
  onDeleted,
}: {
  staff: StaffMember[];
  loading: boolean;
  error: string | null;
  onReset: (member: StaffMember, password: string) => void;
  onDeleted: (member: StaffMember) => void;
}) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Personel listesi yüklenemedi" message={error} />;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Ad soyad</TableHead>
            <TableHead>Görev</TableHead>
            <TableHead>Giriş e-postası</TableHead>
            <TableHead>İletişim e-postası</TableHead>
            <TableHead>Eklenme</TableHead>
            <TableHead className="pr-4">
              <span className="sr-only">İşlem</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {staff.map((member) => (
            <TableRow key={member.id}>
              <TableCell className="pl-4 font-medium">{fullName(member)}</TableCell>
              <TableCell>
                <Badge variant="outline">{ROLE_LABELS[member.role] ?? member.role}</Badge>
              </TableCell>
              <TableCell className="font-mono text-xs">{member.email}</TableCell>
              <TableCell className="text-muted-foreground">
                <ContactEmail member={member} />
              </TableCell>
              <TableCell className="text-muted-foreground">{formatDate(member.created_at)}</TableCell>
              <TableCell className="pr-4 text-right">
                {member.role !== "admin" && (
                  <div className="flex justify-end gap-1">
                    <ResetPasswordButton member={member} onReset={onReset} />
                    <DeleteStaffButton member={member} onDeleted={onDeleted} />
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function ContactEmail({ member }: { member: StaffMember }) {
  if (member.contact_email) return <>{member.contact_email}</>;
  // Depo personelinin iletişim adresi yoksa kritik stok uyarısı kimseye ulaşmıyor; bunu görünür kılıyoruz.
  if (member.role === "warehouse") {
    return <span className="text-amber-600 dark:text-amber-400">Yok · kritik stok uyarısı almaz</span>;
  }
  return <>-</>;
}

function ResetPasswordButton({
  member,
  onReset,
}: {
  member: StaffMember;
  onReset: (member: StaffMember, password: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setError(null);
  }

  async function handleConfirm() {
    setResetting(true);
    setError(null);
    try {
      const result = await resetStaffPassword(member.id);
      onReset(member, result.password);
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Şifre sıfırlanamadı.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger render={<Button variant="ghost" size="sm" />}>
        <KeyRoundIcon />
        Şifre sıfırla
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{fullName(member)} için şifre sıfırlansın mı?</AlertDialogTitle>
          <AlertDialogDescription>
            Yeni bir şifre oluşturulur ve eski şifreyle artık giriş yapılamaz. Yeni şifreyi personele iletmen gerekecek.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <ErrorState title="Şifre sıfırlanamadı" message={error} />}
        <AlertDialogFooter>
          <AlertDialogCancel>Vazgeç</AlertDialogCancel>
          <Button onClick={handleConfirm} disabled={resetting}>
            {resetting && <Spinner aria-label="Sıfırlanıyor" />}
            Şifreyi sıfırla
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteStaffButton({ member, onDeleted }: { member: StaffMember; onDeleted: (member: StaffMember) => void }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setError(null);
  }

  async function handleConfirm() {
    setDeleting(true);
    setError(null);
    try {
      await deleteStaff(member.id);
      setOpen(false);
      onDeleted(member);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Personel silinemedi.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger
        render={<Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" />}
      >
        <Trash2Icon />
        Sil
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{fullName(member)} silinsin mi?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-mono">{member.email}</span> hesabıyla artık giriş yapılamaz ve bildirim gönderilmez.
            Girdiği stok hareketleri ve siparişler kayıtlarda korunur. Açık bir oturumu varsa en geç 1 saat içinde
            kapanır.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <ErrorState title="Personel silinemedi" message={error} />}
        <AlertDialogFooter>
          <AlertDialogCancel>Vazgeç</AlertDialogCancel>
          <Button variant="destructive" onClick={handleConfirm} disabled={deleting}>
            {deleting && <Spinner aria-label="Siliniyor" />}
            Sil
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
