using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace ServiceB.Models;

public class OrderItem
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Guid ProductId { get; set; }

    [MaxLength(255)]
    public string ProductNameSnapshot { get; set; } = string.Empty;
    public int Quantity { get; set; }

    [Precision(12, 2)]
    public decimal UnitPriceSnapshot { get; set; }

    [Precision(12, 2)]
    public decimal LineTotal { get; set; }
    public Order Order { get; set; } = null!;
}