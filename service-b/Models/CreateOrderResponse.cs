namespace ServiceB.Models;

public class CreateOrderResponse
{
    public Guid Id { get; set; }
    public string Status { get; set; } = string.Empty;
    public decimal TotalAmount { get; set; }
    public Guid CreatedBy { get; set; } 
    public List<CreateOrderItemResponse> Items { get; set; } = new();
}