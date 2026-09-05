using ServiceB.Clients;
using System.Net;
using System.Net.Http.Json;

namespace ServiceB.Clients;

public class StockReservationClient : IStockReservationClient
{
    private readonly HttpClient _httpClient;

    public StockReservationClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<StockReservationResult> ReserveAsync(
        Guid orderId,
        IReadOnlyList<StockReservationItem> items
    )
    {
        var request = new
        {
            orderId,
            items
        };

        var response = await _httpClient.PostAsJsonAsync(
            "/internal/stock/reserve",
            request
        );

        if (response.IsSuccessStatusCode)
        {
            return new StockReservationResult
            {
                Status = StockReservationStatus.Success
            };
        }

        if (response.StatusCode == HttpStatusCode.Conflict)
        {
            var reason = await response.Content.ReadAsStringAsync();

            return new StockReservationResult
            {
                Status = StockReservationStatus.Rejected,
                RejectionReason = reason
            };
        }

        response.EnsureSuccessStatusCode();
        throw new InvalidOperationException();
    }
}