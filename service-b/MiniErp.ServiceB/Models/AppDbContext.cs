using Microsoft.EntityFrameworkCore;
using MiniErp.ServiceB.Models;

namespace MiniErp.ServiceB;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {

    }
    
    public DbSet<Product> Products { get; set; }
}