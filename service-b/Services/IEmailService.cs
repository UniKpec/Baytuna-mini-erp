namespace ServiceB.Services;

public interface IEmailService
{
    Task SendOrderConfirmationAsync(
        string customerEmail,
        string customerName,
        string invoiceNumber,
        decimal totalAmount,
        byte[] pdfBytes
    );
}