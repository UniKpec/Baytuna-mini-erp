using Microsoft.EntityFrameworkCore;
using ServiceB.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Microsoft.OpenApi;
using ServiceB.Clients;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection")
    )
    .UseSnakeCaseNamingConvention()
);

builder.Services.AddControllers();
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,

            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],

            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(
                    builder.Configuration["Jwt:Secret"]!
                )
            )
        };
    });

builder.Services.AddHttpClient<IProductCatalogClient, ProductCatalogClient>(client =>
{
    client.BaseAddress = new Uri(
        builder.Configuration["ServiceA:BaseUrl"]!
    );
});

builder.Services.AddHttpClient<IStockReservationClient, StockReservationClient>(client =>
{
    client.BaseAddress = new Uri(
        builder.Configuration["ServiceA:BaseUrl"]!
    );
});

builder.Services.AddAuthorization();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header
    });

    options.AddSecurityRequirement(document =>
        new OpenApiSecurityRequirement
        {
            [new OpenApiSecuritySchemeReference("Bearer", document)] = []
        });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}

// Configure the HTTP request pipeline.
app.UseSwagger();
app.UseSwaggerUI();

// app.UseHttpsRedirection();

app.MapGet("/health", () =>
{
    return Results.Ok(new { status = "ok" });
});

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/jwt-test",(HttpContext context) =>
{
    var userId = context.User.FindFirst("user_id")?.Value;
    var role = context.User.FindFirst("role")?.Value;

    return Results.Ok(new
    {
        userId,
        role
    });
})
.RequireAuthorization();

app.MapControllers();

app.Run();
