using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;
using ServiceB.Models;

namespace ServiceB.Services;

public class EmailService : IEmailService
{
    private readonly EmailSettings _settings;

    public EmailService(IOptions<EmailSettings> options)
    {
        _settings = options.Value;
    }

    public async Task SendOrderConfirmationAsync(
        string customerEmail,
        string customerName,
        string invoiceNumber,
        decimal totalAmount,
        byte[] pdfBytes)
    {
        var message = new MimeMessage();

        message.From.Add(MailboxAddress.Parse(_settings.From));
        message.To.Add(MailboxAddress.Parse(customerEmail));

        message.Subject = $"Sipariş Onayı - {invoiceNumber}";

        var bodyBuilder = new BodyBuilder
        {
            TextBody =
                $"Merhaba {customerName},\n\n" +
                $"Siparişiniz başarıyla onaylandı.\n" +
                $"Fatura No: {invoiceNumber}\n" +
                $"Toplam Tutar: {totalAmount:N2} TL\n\n" +
                $"Faturanız ekte yer almaktadır."
        };

        bodyBuilder.Attachments.Add(
            $"{invoiceNumber}.pdf",
            pdfBytes,
            ContentType.Parse("application/pdf")
        );

        message.Body = bodyBuilder.ToMessageBody();

        using var smtp = new SmtpClient();

        await smtp.ConnectAsync(
            _settings.Host,
            _settings.Port,
            SecureSocketOptions.StartTls
        );

        await smtp.AuthenticateAsync(
            _settings.Username,
            _settings.Password
        );

        await smtp.SendAsync(message);
        await smtp.DisconnectAsync(true);
    }
}