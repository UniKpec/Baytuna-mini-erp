namespace ServiceB.Clients;

public class ForwardAuthorizationHeaderHandler : DelegatingHandler
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public ForwardAuthorizationHeaderHandler(
        IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        var authorizationHeader =
            _httpContextAccessor.HttpContext?
                .Request.Headers.Authorization
                .FirstOrDefault();

        if (!string.IsNullOrWhiteSpace(authorizationHeader))
        {
            request.Headers.TryAddWithoutValidation(
                "Authorization",
                authorizationHeader
            );
        }

        return base.SendAsync(request, cancellationToken);
    }
}