package com.nagem.aqsa.data.local

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(tableName = "categories")
data class CategoryEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val nameEn: String,
    val nameUr: String = "",
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(
    tableName = "sub_categories",
    foreignKeys = [
        ForeignKey(
            entity = CategoryEntity::class,
            parentColumns = ["id"],
            childColumns = ["category_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["category_id"])]
)
data class SubCategoryEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    @ColumnInfo(name = "category_id")
    val categoryId: Long,
    val name: String,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(
    tableName = "item_units",
    indices = [Index(value = ["name"], unique = true)]
)
data class ItemUnitEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val name: String,
    val nameUr: String = "",
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(
    tableName = "users",
    indices = [Index(value = ["email"], unique = true)]
)
data class UserEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val fullName: String,
    val email: String,
    val passwordHash: String = "",
    val role: String = "user", // "admin" | "user"
    val companyName: String = "N.A GEM'S",
    val isLoggedIn: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(
    tableName = "subscriptions",
    indices = [Index(value = ["userId"], unique = true)]
)
data class SubscriptionEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val userId: Long,
    val planType: String = "free", // "free" | "monthly" | "yearly"
    val status: String = "free", // "free" | "active" | "expired" | "pending"
    val pricePkr: Int = 0, // 4500 Monthly | 35000 Yearly
    val startDateMs: Long = 0L,
    val expiryDateMs: Long = 0L,
    val paymentMethod: String = "",
    val lastTransactionId: String = "",
    val updatedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "payment_verifications")
data class PaymentVerificationEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val userId: Long,
    val userEmail: String,
    val userName: String,
    val planType: String, // "monthly" | "yearly"
    val amountPkr: Int, // 4500 or 35000
    val paymentMethod: String, // "EasyPaisa" | "Meezan Bank IBFT / Raast"
    val transactionId: String,
    val senderAccount: String,
    val status: String = "pending", // "pending" | "approved" | "rejected"
    val adminNote: String = "",
    val submittedAt: Long = System.currentTimeMillis(),
    val verifiedAt: Long = 0L
)

/**
 * 28-column Aqsa BMS Stock / Inventory Item + Photo URI + Item Unit & Item Weight.
 * Cost Price & FX stored natively; reports enforce Cost-Only with zero markup.
 */
@Entity(
    tableName = "stock_items",
    indices = [Index(value = ["sku"], unique = true)]
)
data class StockItemEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val sku: String,
    val sizeMm: String = "",
    val colour: String = "",
    val shape: String = "",
    val subCategory: String = "",
    val category: String = "",
    val stockPieces: Int = 0,
    val itemUnit: String = "Carats",
    val oneTpWeight: Double = 0.0,
    val itemWeight: Double = 0.0,
    val batchNumber: String = "",
    val stockQuantity: Double = 0.0,
    val cent: Int = 0,
    val fridge: String = "",
    val costPrice: Double = 0.0,
    val costCurrency: String = "CNY",
    val costExchangeRate: Double = 39.2,
    val via: String = "By Air",
    val purchaseDate: String = "",
    val purchasedQuantity: Double = 0.0,
    val lossQuantity: Double = 0.0,
    val soldQuantity: Double = 0.0,
    val soldPieces: Int = 0,
    val invoiceCount: Int = 0,
    val soldInvoiceNumbers: String = "",
    val returnLossDamage: String = "0",
    val gemstone: String = "",
    val origin: String = "",
    val clarity: String = "",
    val treatment: String = "",
    val certLab: String = "",
    val certNo: String = "",
    val minAlert: Double = 5.0,
    val vaultBox: String = "",
    val supplierCarrier: String = "",
    val remarks: String = "",
    val imageUri: String = "",
    val updatedAt: Long = System.currentTimeMillis()
)

/** Basic Stock Report Row (Original Cost Only, NO Markup, includes Category, Sub-Category, Unit & Item Weight) */
data class BasicCostStockRow(
    val sku: String,
    val gemstoneLabel: String,
    val category: String,
    val subCategory: String,
    val itemUnit: String,
    val itemWeight: Double,
    val stockPieces: Int,
    val inHandQuantity: Double,
    val costCurrency: String,
    val originalCostPrice: Double,
    val fxRateToPkr: Double,
    val totalCostPkr: Double,
    val soldInvoiceNumbers: String
)

/** Report 1 Row: Daily Stock Movement Report (Quantities Only, NO Amount/Cost/Price) */
data class DailyMovementRow(
    val sku: String,
    val gemstoneLabel: String,
    val category: String,
    val subCategory: String,
    val itemUnit: String,
    val itemWeight: Double,
    val inHandQuantity: Double,
    val purchasedQuantity: Double,
    val lossQuantity: Double,
    val weight: Double,
    val soldItemQuantity: Double,
    val soldPieces: Int,
    val numberOfInvoices: Int
)

/** Report 2 Row: Daily Amount Wise Stock Report (Original Cost Price & Total Cost ONLY — NO Markup) */
data class DailyAmountRow(
    val sku: String,
    val gemstoneLabel: String,
    val category: String,
    val subCategory: String,
    val itemUnit: String,
    val itemWeight: Double,
    val inHandQuantity: Double,
    val costCurrency: String,
    val originalCostPrice: Double,
    val fxRateToPkr: Double,
    val totalCostOrig: Double,
    val totalCostPkr: Double
)
