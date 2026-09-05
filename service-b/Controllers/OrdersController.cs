using Microsoft.AspNetCore.Mvc;
using ServiceB.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using ServiceB.Clients;

namespace ServiceB.Controllers;

[ApiController]
[Route("api/[controller]")]
public class OrdersController: ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IProductCatalogClient _productCatalogClient;

    public OrdersController(AppDbContext context, IProductCatalogClient productCatalogClient)
    {
        _context = context;
        _productCatalogClient = productCatalogClient;
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> Create(CreateOrderRequest request)
    {
        var userIdClaim = User.FindFirst("user_id")?.Value;

        if(!Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized("Token içindeki user_id geçersiz");
        }

        var customerExists = await _context.Customers
            .AnyAsync(c => c.Id == request.CustomerId);

        if (!customerExists)
        {
            return BadRequest("Geçersiz customerId.");
        }

        var order = new Order
        {
             Id = Guid.NewGuid(),
             CustomerId = request.CustomerId,
             Status = "pending",
             CreatedBy = userId,
             CreatedAt = DateTime.UtcNow,
             UpdatedAt = DateTime.UtcNow
        };  

        foreach (var item in request.Items)
        {
            var product = await _productCatalogClient.GetProductAsync(item.ProductId);

            if(product is null)
            {
                return BadRequest($"Ürün bulunamadı: {item.ProductId}");
            }

            var orderItem = new OrderItem
            {
                Id = Guid.NewGuid(),
                OrderId = order.Id,
                ProductId = item.ProductId,
                ProductNameSnapshot = product.Name,
                Quantity = item.Quantity,
                UnitPriceSnapshot = product.SalePrice,
                LineTotal = product.SalePrice * item.Quantity
            };

            order.Items.Add(orderItem);

        }
        order.TotalAmount = order.Items.Sum(x => x.LineTotal);

        _context.Orders.Add(order);
        await _context.SaveChangesAsync();

        var response = new CreateOrderResponse
        {
            Id = order.Id,
            Status = order.Status,
            TotalAmount = order.TotalAmount,
            CreatedBy = order.CreatedBy,
            Items = order.Items.Select(item => new CreateOrderItemResponse
            {
                ProductId = item.ProductId,
                ProductName = item.ProductNameSnapshot,
                Quantity = item.Quantity,
                UnitPrice = item.UnitPriceSnapshot,
                LineTotal = item.LineTotal
            }).ToList()

        };
        return Ok(response);
    }
}