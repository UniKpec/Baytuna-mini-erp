using System.ComponentModel.DataAnnotations;

namespace ServiceB.Models;

public class CreateCustomerRequest
{
    [Required(ErrorMessage = "İsim Zorunlu")]
    [MaxLength(255)]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "Email Zorunlu")]
    [EmailAddress(ErrorMessage = "Geçersiz email formatı")]
    [MaxLength(255)]
    public string Email { get; set; } = string.Empty;

    [Phone(ErrorMessage = "Geçersiz telefon formatı")]
    [MaxLength(30)]
    public string? Phone { get; set; }
}