using Microsoft.EntityFrameworkCore;
using ServiceB.Models;

namespace ServiceB.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(AppDbContext context)
    {
        if (await context.Customers.AnyAsync())
        {
            return;
        }

        var customers = new List<Customer>
        {
            new Customer
            {
                Id = Guid.NewGuid(),
                Name = "Ahmet Yılmaz",
                Email = "ahmet@example.com",
                Phone = "05551111111",
                CreatedAt = DateTime.UtcNow
            },

            new Customer
            {
                Id = Guid.NewGuid(),
                Name = "Ayşe Demir",
                Email = "ayse@example.com",
                Phone = "05552222222",
                CreatedAt = DateTime.UtcNow
            },

            new Customer
            {
                Id = Guid.NewGuid(),
                Name = "Mehmet Kaya",
                Email = "mehmet@example.com",
                Phone = "05553333333",
                CreatedAt = DateTime.UtcNow
            },

            new Customer
            {
                Id = Guid.NewGuid(),
                Name = "Zeynep Çelik",
                Email = "zeynep@example.com",
                Phone = "05554444444",
                CreatedAt = DateTime.UtcNow
            },

            new Customer
            {
                Id = Guid.NewGuid(),
                Name = "Can Aydın",
                Email = "can@example.com",
                Phone = "05555555555",
                CreatedAt = DateTime.UtcNow
            }
        };

        context.Customers.AddRange(customers);

        await context.SaveChangesAsync();
    }
}