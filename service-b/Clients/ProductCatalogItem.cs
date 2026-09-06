using System.Text.Json.Serialization;

namespace ServiceB.Clients;

public class ProductCatalogItem
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("sale_price")]
    public decimal SalePrice { get; set; }
}