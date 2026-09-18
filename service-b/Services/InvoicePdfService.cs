using QuestPDF.Fluent;
using QuestPDF.Infrastructure;
using ServiceB.Models;

namespace ServiceB.Services;

public class InvoicePdfService : IInvoicePdfService
{
public async Task<byte[]> GenerateAndSaveAsync(Invoice invoice)
{
    var pdfBytes = Document.Create(container =>
    {
        container.Page(page =>
        {
            page.Margin(40);

            page.Content().Column(column =>
            {
                column.Spacing(10);

                column.Item()
                    .Text($"Fatura No: {invoice.InvoiceNumber}")
                    .FontSize(20)
                    .Bold();

                column.Item()
                    .Text($"Müşteri: {invoice.Order.Customer.Name}");

                column.Item()
                    .Text($"Tarih: {invoice.CreatedAt:dd.MM.yyyy HH:mm}");

                column.Item().Table(table =>
                {
                    table.ColumnsDefinition(columns =>
                    {
                        columns.RelativeColumn(4);
                        columns.RelativeColumn(1);
                        columns.RelativeColumn(2);
                        columns.RelativeColumn(2);
                    });

                    table.Header(header =>
                    {
                        header.Cell().Text("Ürün").Bold();
                        header.Cell().Text("Adet").Bold();
                        header.Cell().Text("Birim Fiyat").Bold();
                        header.Cell().Text("Toplam").Bold();
                    });

                    foreach (var item in invoice.Order.Items)
                    {
                        table.Cell().Text(item.ProductNameSnapshot);
                        table.Cell().Text(item.Quantity.ToString());
                        table.Cell().Text($"{item.UnitPriceSnapshot:N2} TL");
                        table.Cell().Text($"{item.LineTotal:N2} TL");
                    }
                });

                column.Item()
                    .AlignRight()
                    .Text($"Genel Toplam: {invoice.TotalAmount:N2} TL")
                    .Bold();
            });
        });
    }).GeneratePdf();

    var invoicesDirectory = "/app/data/invoices";

    Directory.CreateDirectory(invoicesDirectory);

    var fileName = $"{invoice.InvoiceNumber}.pdf";
    var filePath = Path.Combine(invoicesDirectory, fileName);

    await File.WriteAllBytesAsync(filePath, pdfBytes);

    invoice.PdfPath = filePath;

    return pdfBytes;
}
}