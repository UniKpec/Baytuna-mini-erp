namespace ServiceB.Clients;

public interface IStockReservationClient
{
    Task<StockReservationResult> ReserveAsync(
        Guid reservationId,
        IReadOnlyList<StockReservationItem> items
    );
}