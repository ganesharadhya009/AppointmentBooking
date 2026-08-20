using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BillingApi.Migrations
{
    /// <inheritdoc />
    public partial class AddPaymentGatewayTransaction : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PaymentGatewayTransactions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    Rail = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    MerchantReference = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    RawGatewayPayload = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CompletedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PaymentGatewayTransactions", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PaymentGatewayTransactions_ParentId",
                table: "PaymentGatewayTransactions",
                column: "ParentId");

            migrationBuilder.CreateIndex(
                name: "IX_PaymentGatewayTransactions_TenantId",
                table: "PaymentGatewayTransactions",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PaymentGatewayTransactions");
        }
    }
}
