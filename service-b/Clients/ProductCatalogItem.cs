namespace ServiceB.Clients;

public class ProductCatalogItem
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal SalePrice { get; set; }
}