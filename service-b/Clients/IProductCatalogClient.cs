namespace ServiceB.Clients;

public interface IProductCatalogClient
{
    Task<bool> CheckHealthAsync();
    Task<ProductCatalogItem?> GetProductAsync(Guid productId);
}