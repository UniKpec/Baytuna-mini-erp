using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace ServiceB.Models;

[Index(nameof(SKU), IsUnique = true)]
public class Product
{
    public Guid Id { get; set; }

    [MaxLength(255)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(50)]
    public string SKU { get; set; } = string.Empty;
    [Precision(5, 2)]
    public decimal MarginPercent { get; set; }
    [Precision(12, 2)]
    public decimal AvgCost { get; set; }
    [Precision(12, 2)]
    public decimal SalePrice { get; set; }

    public int StockQuantity { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}