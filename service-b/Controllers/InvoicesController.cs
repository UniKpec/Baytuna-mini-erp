using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiceB.Models;
using QuestPDF.Fluent;
using QuestPDF.Helpers;

namespace ServiceB.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class InvoicesController : ControllerBase
{
    private readonly AppDbContext _context;

    public InvoicesController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("{id:guid}/pdf")]
    public async Task<IActionResult> GetPdf(Guid id)
    {
        var invoice = await _context.Invoices
            .Include(i => i.Order)
                .ThenInclude(o => o.Customer)
            .Include(i => i.Order)
                .ThenInclude(o => o.Items)
            .FirstOrDefaultAsync(i => i.Id == id);

        if (invoice is null)
        {
            return NotFound("Fatura bulunamadı.");
        }

        if (!string.IsNullOrWhiteSpace(invoice.PdfPath) &&
            System.IO.File.Exists(invoice.PdfPath))
        {
            var existingPdf = await System.IO.File.ReadAllBytesAsync(invoice.PdfPath);

            return File(
                existingPdf,
                "application/pdf",
                $"{invoice.InvoiceNumber}.pdf"
            );
        }

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

        await System.IO.File.WriteAllBytesAsync(filePath, pdfBytes);
        
        invoice.PdfPath = filePath;

        await _context.SaveChangesAsync();

        return File(
            pdfBytes,
            "application/pdf",
            $"{invoice.InvoiceNumber}.pdf"
        );
    }
}