import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

export function LoadingState({ label = "Yükleniyor…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
      <Spinner aria-label={label} />
      {label}
    </div>
  );
}

export function ErrorState({ title = "Bir sorun oluştu", message }: { title?: string; message: string }) {
  return (
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export type FormResult = {
  type: "success" | "error";
  title: string;
  message: React.ReactNode;
} | null;

/** Form gönderiminin sonucu: başarı ve hata görsel olarak ayrışsın. */
export function FormResultAlert({ result }: { result: FormResult }) {
  if (!result) return null;

  if (result.type === "error") {
    return (
      <Alert variant="destructive">
        <CircleAlertIcon />
        <AlertTitle>{result.title}</AlertTitle>
        <AlertDescription>{result.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="text-emerald-700 dark:text-emerald-400">
      <CircleCheckIcon />
      <AlertTitle>{result.title}</AlertTitle>
      <AlertDescription>{result.message}</AlertDescription>
    </Alert>
  );
}
