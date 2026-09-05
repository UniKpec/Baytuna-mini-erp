using System.Net.Http.Json;
using System.Net;

namespace ServiceB.Clients;

public class ProductCatalogClient : IProductCatalogClient
{
    private readonly HttpClient _httpClient;
    public ProductCatalogClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<bool> CheckHealthAsync()
    {
        var response = await _httpClient.GetAsync("/health");
        return response.IsSuccessStatusCode;
    }

    public async Task<ProductCatalogItem?> GetProductAsync(Guid productId)
    {
        var response = await _httpClient.GetAsync($"/product/{productId}");

        if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }

        response.EnsureSuccessStatusCode();

        return await response.Content
            .ReadFromJsonAsync<ProductCatalogItem>();
    }
}