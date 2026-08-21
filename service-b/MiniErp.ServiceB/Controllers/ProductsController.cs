using Microsoft.AspNetCore.Mvc;
using MiniErp.ServiceB.Models;
using MiniErp.ServiceB;
using System;
using Microsoft.EntityFrameworkCore;
namespace MiniErp.ServiceB.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProductsController: ControllerBase
{
    private readonly AppDbContext _context;

    public ProductsController(AppDbContext context)
    {
        _context = context;
    }
    private static readonly List<Product> _products = new()
    {
        new Product
        {
            Id = Guid.NewGuid(),
            Name = "Klavye",
            SKU = "KLV-001",
            MarginPercent = 20
        }
    };

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var _products = await _context.Products.ToListAsync();
        return Ok(_products);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var product = await _context.Products.FindAsync(id);

        if (product is null)
        {
            return NotFound();
        }

        return Ok(product);
    }

    [HttpPost]
    public async Task<IActionResult> Create(Product product)
    {
        product.Id = Guid.NewGuid();
        _context.Products.Add(product);

        await _context.SaveChangesAsync();

        return Ok(product);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var product = await _context.Products.FindAsync(id);

        if (product is null)
        {
            return NotFound();
        }

        _context.Products.Remove(product);

        await _context.SaveChangesAsync();
        
        return NoContent();
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, Product product)
    {
        var existingProduct = await _context.Products.FindAsync(id);

        if (existingProduct is null)
        {
            return NotFound();
        }

        existingProduct.Name = product.Name;
        existingProduct.SKU = product.SKU;
        existingProduct.MarginPercent = product.MarginPercent;

        await _context.SaveChangesAsync();

        return Ok(existingProduct);
    }
}