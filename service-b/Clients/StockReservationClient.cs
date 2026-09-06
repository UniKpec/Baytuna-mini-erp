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
        Guid reservationId,
        IReadOnlyList<StockReservationItem> items
    )
    {
        var request = new
        {
            reservationId,
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
            var error = await response.Content
                .ReadFromJsonAsync<ServiceAErrorResponse>();

            return new StockReservationResult
            {
                Status = StockReservationStatus.Rejected,
                RejectionReason = error?.Detail ?? "Stok rezervasyonu reddedildi."
            };
        }

        response.EnsureSuccessStatusCode();
        throw new InvalidOperationException();
    }
}