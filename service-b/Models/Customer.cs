using System.ComponentModel.DataAnnotations;

namespace ServiceB.Models;

public class Customer
{
    public Guid Id { get; set; }
    [MaxLength(255)]
    public string Name { get; set; } = string.Empty;
    [MaxLength(255)]
    public string Email { get; set; } = string.Empty;
    [MaxLength(30)]
    public string? Phone { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}