using Microsoft.EntityFrameworkCore;
using ServiceB.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Microsoft.OpenApi;
using ServiceB.Clients;
using ServiceB.Data;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection")
    )
    .UseSnakeCaseNamingConvention()
);

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy
            .WithOrigins(
                "http://localhost:3000",
                "https://minierp.net.tr",
                "https://www.minierp.net.tr",
                "https://jovial-lokum-10812f.netlify.app"
            )
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddHttpContextAccessor();
builder.Services.AddTransient<ForwardAuthorizationHeaderHandler>();

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
            ),
            RoleClaimType = "role"
        };
    });

builder.Services.AddHttpClient<IProductCatalogClient, ProductCatalogClient>(client =>
{
    client.BaseAddress = new Uri(
        builder.Configuration["ServiceA:BaseUrl"]!
    );
})
.AddHttpMessageHandler<ForwardAuthorizationHeaderHandler>();

builder.Services.AddHttpClient<IStockReservationClient, StockReservationClient>(client =>
{
    client.BaseAddress = new Uri(
        builder.Configuration["ServiceA:BaseUrl"]!
    );
})
.AddHttpMessageHandler<ForwardAuthorizationHeaderHandler>();;

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
    await DbSeeder.SeedAsync(db);
}

// Configure the HTTP request pipeline.
app.UseSwagger();
app.UseSwaggerUI();

// app.UseHttpsRedirection();

app.MapGet("/health", () =>
{
    return Results.Ok(new { status = "ok" });
});

app.UseCors("Frontend");
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
