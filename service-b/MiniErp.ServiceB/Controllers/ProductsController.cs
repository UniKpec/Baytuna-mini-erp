using Microsoft.AspNetCore.Mvc;
using MiniErp.ServiceB.Models;
using System;
namespace MiniErp.ServiceB.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProductsController: ControllerBase
{
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
    public IActionResult GetAll()
    {
        return Ok(_products);
    }

    [HttpGet("{id}")]
    public IActionResult GetById(Guid id)
    {
        var product = _products.FirstOrDefault(x =>x.Id == id);
        if (product is null)
        {
            return NotFound();
        }
        return Ok(product);
    }

    [HttpPost]
    public IActionResult Create(Product product)
    {
        product.Id = Guid.NewGuid();
        _products.Add(product);

        return CreatedAtAction(
            nameof(GetById),
            new { id = product.Id},
            product
        );
    }

    [HttpDelete("{id}")]
    public IActionResult Delete(Guid id)
    {
        var product = _products.FirstOrDefault(x => x.Id == id);
        if(product is null)
        {
            return NotFound();
        }
        _products.Remove(product);
        return NoContent();
    }
}