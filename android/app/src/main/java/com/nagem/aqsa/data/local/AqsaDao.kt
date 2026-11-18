package com.nagem.aqsa.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface AqsaDao {

    // -------- Categories, Sub-Categories & Item Units CRUD --------
    @Query("SELECT * FROM categories ORDER BY nameEn ASC")
    fun observeCategories(): Flow<List<CategoryEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCategory(category: CategoryEntity): Long

    @Update
    suspend fun updateCategory(category: CategoryEntity)

    @Delete
    suspend fun deleteCategory(category: CategoryEntity)

    @Query("SELECT * FROM sub_categories ORDER BY name ASC")
    fun observeAllSubCategories(): Flow<List<SubCategoryEntity>>

    @Query("SELECT * FROM sub_categories WHERE category_id = :categoryId ORDER BY name ASC")
    fun observeSubCategoriesFor(categoryId: Long): Flow<List<SubCategoryEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSubCategory(subCategory: SubCategoryEntity): Long

    @Update
    suspend fun updateSubCategory(subCategory: SubCategoryEntity)

    @Delete
    suspend fun deleteSubCategory(subCategory: SubCategoryEntity)

    @Query("SELECT * FROM item_units ORDER BY name ASC")
    fun observeItemUnits(): Flow<List<ItemUnitEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertItemUnit(unit: ItemUnitEntity): Long

    @Update
    suspend fun updateItemUnit(unit: ItemUnitEntity)

    @Delete
    suspend fun deleteItemUnit(unit: ItemUnitEntity)

    // -------- User Login, Company Name & Subscription Management --------
    @Query("SELECT * FROM users ORDER BY id ASC")
    fun observeUsers(): Flow<List<UserEntity>>

    @Query("SELECT * FROM users WHERE isLoggedIn = 1 LIMIT 1")
    fun observeLoggedInUser(): Flow<UserEntity?>

    @Query("SELECT * FROM users WHERE isLoggedIn = 1 LIMIT 1")
    suspend fun getLoggedInUser(): UserEntity?

    @Query("SELECT * FROM users WHERE email = :email LIMIT 1")
    suspend fun getUserByEmail(email: String): UserEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertUser(user: UserEntity): Long

    @Query("UPDATE users SET isLoggedIn = 0")
    suspend fun logoutAllUsers()

    @Query("UPDATE users SET isLoggedIn = 1 WHERE id = :userId")
    suspend fun setUserLoggedIn(userId: Long)

    @Query("UPDATE users SET companyName = :companyName WHERE id = :userId")
    suspend fun updateCompanyName(userId: Long, companyName: String)

    @Query("SELECT * FROM subscriptions WHERE userId = :userId LIMIT 1")
    fun observeSubscriptionForUser(userId: Long): Flow<SubscriptionEntity?>

    @Query("SELECT * FROM subscriptions WHERE userId = :userId LIMIT 1")
    suspend fun getSubscriptionForUser(userId: Long): SubscriptionEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertSubscription(subscription: SubscriptionEntity): Long

    @Query("UPDATE subscriptions SET status = 'expired', updatedAt = :nowMs WHERE status = 'active' AND expiryDateMs > 0 AND expiryDateMs < :nowMs")
    suspend fun markExpiredSubscriptions(nowMs: Long = System.currentTimeMillis())

    // -------- EasyPaisa / Meezan Bank Payment Verification Console --------
    @Query("SELECT * FROM payment_verifications ORDER BY submittedAt DESC")
    fun observeAllPaymentVerifications(): Flow<List<PaymentVerificationEntity>>

    @Query("SELECT * FROM payment_verifications WHERE status = 'pending' ORDER BY submittedAt ASC")
    fun observePendingPaymentVerifications(): Flow<List<PaymentVerificationEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPaymentVerification(request: PaymentVerificationEntity): Long

    @Query("UPDATE payment_verifications SET status = :status, adminNote = :adminNote, verifiedAt = :verifiedAt WHERE id = :requestId")
    suspend fun updatePaymentVerificationStatus(
        requestId: Long,
        status: String,
        adminNote: String,
        verifiedAt: Long = System.currentTimeMillis()
    )

    // -------- Stock / 28-Column Inventory CRUD & Photo URI --------
    @Query("SELECT * FROM stock_items ORDER BY updatedAt DESC")
    fun observeAllStockItems(): Flow<List<StockItemEntity>>

    @Query("SELECT * FROM stock_items WHERE id = :id LIMIT 1")
    suspend fun getStockItemById(id: Long): StockItemEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertStockItem(item: StockItemEntity): Long

    @Query("UPDATE stock_items SET imageUri = :imageUri, updatedAt = :timestamp WHERE id = :id")
    suspend fun updateStockImage(id: Long, imageUri: String, timestamp: Long = System.currentTimeMillis())

    @Delete
    suspend fun deleteStockItem(item: StockItemEntity)

    // -------- Basic Stock Report (Cost Only, NO Markup) --------
    @Query(
        """
        SELECT
            sku AS sku,
            COALESCE(NULLIF(gemstone, ''), NULLIF(subCategory, ''), sku) AS gemstoneLabel,
            category AS category,
            subCategory AS subCategory,
            itemUnit AS itemUnit,
            COALESCE(NULLIF(itemWeight, 0), oneTpWeight) AS itemWeight,
            stockPieces AS stockPieces,
            stockQuantity AS inHandQuantity,
            costCurrency AS costCurrency,
            costPrice AS originalCostPrice,
            costExchangeRate AS fxRateToPkr,
            CASE
                WHEN costCurrency = 'PKR' THEN (costPrice * stockQuantity)
                WHEN costExchangeRate <= 0 THEN (costPrice * stockQuantity)
                ELSE (costPrice * costExchangeRate * stockQuantity)
            END AS totalCostPkr,
            soldInvoiceNumbers AS soldInvoiceNumbers
        FROM stock_items
        ORDER BY sku ASC
        """
    )
    fun observeBasicCostStockReport(): Flow<List<BasicCostStockRow>>

    // -------- Report 1: Daily Stock Movement Report (Quantities Only) --------
    @Query(
        """
        SELECT
            sku AS sku,
            COALESCE(NULLIF(gemstone, ''), NULLIF(subCategory, ''), sku) AS gemstoneLabel,
            category AS category,
            subCategory AS subCategory,
            itemUnit AS itemUnit,
            COALESCE(NULLIF(itemWeight, 0), oneTpWeight) AS itemWeight,
            stockQuantity AS inHandQuantity,
            purchasedQuantity AS purchasedQuantity,
            lossQuantity AS lossQuantity,
            (COALESCE(NULLIF(itemWeight, 0), oneTpWeight) * stockQuantity) AS weight,
            soldQuantity AS soldItemQuantity,
            soldPieces AS soldPieces,
            invoiceCount AS numberOfInvoices
        FROM stock_items
        ORDER BY sku ASC
        """
    )
    fun observeDailyMovementReport(): Flow<List<DailyMovementRow>>

    // -------- Report 2: Daily Amount Wise Stock Report (Original Cost Only — NO Markup) --------
    @Query(
        """
        SELECT
            sku AS sku,
            COALESCE(NULLIF(gemstone, ''), NULLIF(subCategory, ''), sku) AS gemstoneLabel,
            category AS category,
            subCategory AS subCategory,
            itemUnit AS itemUnit,
            COALESCE(NULLIF(itemWeight, 0), oneTpWeight) AS itemWeight,
            stockQuantity AS inHandQuantity,
            costCurrency AS costCurrency,
            costPrice AS originalCostPrice,
            costExchangeRate AS fxRateToPkr,
            (costPrice * stockQuantity) AS totalCostOrig,
            CASE
                WHEN costCurrency = 'PKR' THEN (costPrice * stockQuantity)
                WHEN costExchangeRate <= 0 THEN (costPrice * stockQuantity)
                ELSE (costPrice * costExchangeRate * stockQuantity)
            END AS totalCostPkr
        FROM stock_items
        ORDER BY sku ASC
        """
    )
    fun observeDailyAmountReport(): Flow<List<DailyAmountRow>>
}
