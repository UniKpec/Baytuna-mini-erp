using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace ServiceB.Models;


[Index(nameof(OrderId), IsUnique = true)]
[Index(nameof(InvoiceNumber), IsUnique = true)]
public class Invoice
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Order Order { get; set; } = null!;

    [MaxLength(50)]
    public string InvoiceNumber { get; set; } = string.Empty;

    [Precision(12, 2)]
    public decimal TotalAmount { get; set; }

    [MaxLength(500)]
    public string? PdfPath { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}