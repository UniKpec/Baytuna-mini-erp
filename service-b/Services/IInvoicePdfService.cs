using ServiceB.Models;

namespace ServiceB.Services;

public interface IInvoicePdfService
{
    Task<byte[]> GenerateAndSaveAsync(Invoice invoice);
}