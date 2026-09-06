namespace ServiceB.Models;

public class InvoiceResponse
{
    public Guid Id { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public decimal TotalAmount { get; set; }
    public string? PdfPath { get; set; }
    public DateTime CreatedAt { get; set; }
}