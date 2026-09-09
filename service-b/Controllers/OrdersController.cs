using Microsoft.AspNetCore.Mvc;
using ServiceB.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using ServiceB.Clients;


namespace ServiceB.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class OrdersController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IProductCatalogClient _productCatalogClient;
    private readonly IStockReservationClient _stockReservationClient;
    private readonly ILogger<OrdersController> _logger;

    public OrdersController(AppDbContext context, IProductCatalogClient productCatalogClient, IStockReservationClient stockReservationClient, ILogger<OrdersController> logger)
    {
        _context = context;
        _productCatalogClient = productCatalogClient;
        _stockReservationClient = stockReservationClient;
        _logger = logger;
    }

    [Authorize(Roles = "sales")]
    [HttpPost]
    public async Task<IActionResult> Create(CreateOrderRequest request)
    {
        var userIdClaim = User.FindFirst("user_id")?.Value;

        if (!Guid.TryParse(userIdClaim, out var userId))
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

            ProductCatalogItem? product;

            try
            {
                product = await _productCatalogClient.GetProductAsync(item.ProductId);
            }
            catch(HttpRequestException ex)
            {
                _logger.LogError(
                    ex,
                    "Service A ürün kataloğuna ulaşılamadı. ProductId: {ProductId}",
                    item.ProductId
                );

                return StatusCode(
                    StatusCodes.Status503ServiceUnavailable,
                    "Ürün servisine şu anda ulaşılamıyor."
                );
            }

            if (product is null)
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

        _logger.LogInformation(
            "Sipariş oluşturuldu. OrderId: {OrderId}, UserId: {UserId}, CustomerId: {CustomerId}",
            order.Id,
            userId,
            order.Customer
        );

        var reservationItems = order.Items
        .Select(item => new StockReservationItem
        {
            ProductId = item.ProductId,
            Quantity = item.Quantity
        })
        .ToList();

        StockReservationResult reservationResult;

        try
        {
            reservationResult = await _stockReservationClient.ReserveAsync(
                order.Id,
                reservationItems
            );
        }
        catch (HttpRequestException)
        {

            _logger.LogError(
                "Service A'ya ulaşılamadı. OrderId: {OrderId}, UserId: {UserId}",
                order.Id,
                userId
            );

            return StatusCode(
                StatusCodes.Status503ServiceUnavailable,
                "Servis A'ya ulaşılamıyor. Sipariş pending durumda kaldı."
            );
        }

        if (reservationResult.Status == StockReservationStatus.Success)
        {
            order.Status = "confirmed";
            order.UpdatedAt = DateTime.UtcNow;

            var invoice = new Invoice
            {
                Id = Guid.NewGuid(),
                OrderId = order.Id,
                InvoiceNumber = $"INV-{Guid.NewGuid():N}",
                TotalAmount = order.TotalAmount,
                PdfPath = null,
                CreatedAt = DateTime.UtcNow
            };

            _context.Invoices.Add(invoice);

        }
        else if (reservationResult.Status == StockReservationStatus.Rejected)
        {
            order.Status = "rejected";
            order.RejectionReason = reservationResult.RejectionReason;
            order.UpdatedAt = DateTime.UtcNow;

        }

        await _context.SaveChangesAsync();

        if (order.Status == "confirmed")
        {
            _logger.LogInformation(
                "Sipariş onaylandı. OrderId: {OrderId}, UserId: {UserId}, TotalAmount: {TotalAmount}",
                order.Id,
                userId,
                order.TotalAmount
            );
        }
        else if (order.Status == "rejected")
        {
            _logger.LogWarning(
                "Sipariş reddedildi. OrderId: {OrderId}, UserId: {UserId}, Reason: {Reason}",
                order.Id,
                userId,
                order.RejectionReason
            );
        }

        var response = new CreateOrderResponse
        {
            Id = order.Id,
            Status = order.Status,
            TotalAmount = order.TotalAmount,
            CreatedBy = order.CreatedBy,
            RejectionReason = order.RejectionReason,
            Items = order.Items.Select(item => new CreateOrderItemResponse
            {
                ProductId = item.ProductId,
                ProductName = item.ProductNameSnapshot,
                Quantity = item.Quantity,
                UnitPrice = item.UnitPriceSnapshot,
                LineTotal = item.LineTotal
            }).ToList()

        };

        if(order.Status == "rejected")
        {
            return Conflict(response);
        }
        return Ok(response);
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var orders = await _context.Orders
            .Include(o => o.Customer)
            .Include(o => o.Items)
            .Include(o => o.Invoice)
            .ToListAsync();

        var response = orders.Select(order => new OrderResponse
        {
            Id = order.Id,
            Status = order.Status,
            TotalAmount = order.TotalAmount,
            CreatedAt = order.CreatedAt,

            CustomerId = order.CustomerId,
            CustomerName = order.Customer.Name,

            RejectionReason = order.RejectionReason,

            Items = order.Items.Select(item => new OrderItemResponse
            {
                ProductId = item.ProductId,
                ProductName = item.ProductNameSnapshot,
                Quantity = item.Quantity,
                UnitPrice = item.UnitPriceSnapshot,
                LineTotal = item.LineTotal
            }).ToList(),

            Invoice = order.Invoice is null
                ? null
                : new InvoiceResponse
                {
                    Id = order.Invoice.Id,
                    InvoiceNumber = order.Invoice.InvoiceNumber,
                    TotalAmount = order.Invoice.TotalAmount,
                    PdfPath = order.Invoice.PdfPath,
                    CreatedAt = order.Invoice.CreatedAt
                }
        }).ToList();

        return Ok(response);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var order = await _context.Orders
            .Include(o => o.Customer)
            .Include(o => o.Items)
            .Include(o => o.Invoice)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (order is null)
        {
            return NotFound();
        }

        var response = new OrderResponse
        {
            Id = order.Id,
            Status = order.Status,
            TotalAmount = order.TotalAmount,
            CreatedAt = order.CreatedAt,
            CustomerId = order.CustomerId,
            CustomerName = order.Customer.Name,
            RejectionReason = order.RejectionReason,

            Items = order.Items.Select(item => new OrderItemResponse
            {
                ProductId = item.ProductId,
                ProductName = item.ProductNameSnapshot,
                Quantity = item.Quantity,
                UnitPrice = item.UnitPriceSnapshot,
                LineTotal = item.LineTotal
            }).ToList(),

            Invoice = order.Invoice is null
                ? null
                : new InvoiceResponse
                {
                    Id = order.Invoice.Id,
                    InvoiceNumber = order.Invoice.InvoiceNumber,
                    TotalAmount = order.Invoice.TotalAmount,
                    PdfPath = order.Invoice.PdfPath,
                    CreatedAt = order.Invoice.CreatedAt
                }
        };

        return Ok(response);
    }
}