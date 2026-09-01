using Microsoft.EntityFrameworkCore;
using ServiceB.Models;

namespace ServiceB.Models;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {

    }
    
    public DbSet<Product> Products { get; set; }
    public DbSet<Customer> Customers { get; set; }
}