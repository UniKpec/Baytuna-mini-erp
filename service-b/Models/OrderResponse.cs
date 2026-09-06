namespace ServiceB.Models;

public class OrderResponse
{
    public Guid Id { get; set; }
    public string Status { get; set; } = string.Empty;
    public decimal TotalAmount { get; set; }
    public DateTime CreatedAt { get; set; }

    public Guid CustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;

    public string? RejectionReason { get; set; }

    public List<OrderItemResponse> Items { get; set; } = new();

    public InvoiceResponse? Invoice { get; set; }
}