/** Sayfanın üst satırı: kısa açıklama ve sağda eylem butonları. Sayfa başlığı üstteki çubukta. */
export function PageToolbar({
  description,
  children,
}: {
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">{description}</p>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
