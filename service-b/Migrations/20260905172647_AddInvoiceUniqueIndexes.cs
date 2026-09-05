using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MiniErp.ServiceB.Migrations
{
    /// <inheritdoc />
    public partial class AddInvoiceUniqueIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_invoices_order_id",
                table: "invoices");

            migrationBuilder.CreateIndex(
                name: "ix_invoices_invoice_number",
                table: "invoices",
                column: "invoice_number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_invoices_order_id",
                table: "invoices",
                column: "order_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_invoices_invoice_number",
                table: "invoices");

            migrationBuilder.DropIndex(
                name: "ix_invoices_order_id",
                table: "invoices");

            migrationBuilder.CreateIndex(
                name: "ix_invoices_order_id",
                table: "invoices",
                column: "order_id");
        }
    }
}
