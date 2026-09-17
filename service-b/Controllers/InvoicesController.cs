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

        var pdfBytes = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Margin(40);

                page.Content()
                    .Text($"Fatura No: {invoice.InvoiceNumber}");
            });
        }).GeneratePdf();

        return File(
            pdfBytes,
            "application/pdf",
            $"{invoice.InvoiceNumber}.pdf"
        );
    }
}