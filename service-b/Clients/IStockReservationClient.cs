namespace ServiceB.Clients;

public interface IStockReservationClient
{
    Task<StockReservationResult> ReserveAsync(
        Guid orderId,
        IReadOnlyList<StockReservationItem> items
    );
}