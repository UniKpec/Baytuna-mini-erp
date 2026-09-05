namespace ServiceB.Clients;

public enum StockReservationStatus
{
    Success,
    Rejected
}

public class StockReservationResult
{
    public StockReservationStatus Status { get; set; }
    public string? RejectionReason { get; set; }

}