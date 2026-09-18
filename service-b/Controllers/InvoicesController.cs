using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiceB.Models;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using ServiceB.Services;

namespace ServiceB.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class InvoicesController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IInvoicePdfService _invoicePdfService;

    public InvoicesController(AppDbContext context, IInvoicePdfService invoicePdfService)
    {
        _context = context;
        _invoicePdfService = invoicePdfService;
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

        var pdfBytes = await _invoicePdfService.GenerateAndSaveAsync(invoice);
        await _context.SaveChangesAsync();    

        return File(
            pdfBytes,
            "application/pdf",
            $"{invoice.InvoiceNumber}.pdf"
        );
    }
}