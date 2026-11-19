package com.nagem.aqsa.data.local

import kotlinx.coroutines.flow.Flow

object SubscriptionPlans {
    const val OWNER_EMAIL = "ahmer.iqbal.khan@gmail.com"
    const val MONTHLY_PRICE_PKR = 4500
    const val YEARLY_PRICE_PKR = 35000
    const val MONTHLY_DURATION_DAYS = 30L
    const val YEARLY_DURATION_DAYS = 365L

    const val EASYPAISA_NUMBER = "03320001602"
    const val MEEZAN_TITLE = "AHMER IQBAL"
    const val MEEZAN_ACCOUNT = "16020109874519"
    const val MEEZAN_IBAN = "PK54MEZN0016020109874519"
    const val MEEZAN_BRANCH = "LATIFABAD BRANCH-HYD"
}

class AqsaRepository(private val dao: AqsaDao) {

    val categories: Flow<List<CategoryEntity>> = dao.observeCategories()
    val subCategories: Flow<List<SubCategoryEntity>> = dao.observeAllSubCategories()
    val itemUnits: Flow<List<ItemUnitEntity>> = dao.observeItemUnits()
    val users: Flow<List<UserEntity>> = dao.observeUsers()
    val loggedInUser: Flow<UserEntity?> = dao.observeLoggedInUser()
    val paymentVerifications: Flow<List<PaymentVerificationEntity>> = dao.observeAllPaymentVerifications()
    val pendingVerifications: Flow<List<PaymentVerificationEntity>> = dao.observePendingPaymentVerifications()
    val stockItems: Flow<List<StockItemEntity>> = dao.observeAllStockItems()
    val basicCostStockReport: Flow<List<BasicCostStockRow>> = dao.observeBasicCostStockReport()
    val dailyMovementReport: Flow<List<DailyMovementRow>> = dao.observeDailyMovementReport()
    val dailyAmountReport: Flow<List<DailyAmountRow>> = dao.observeDailyAmountReport()

    fun observeSubCategoriesFor(categoryId: Long): Flow<List<SubCategoryEntity>> =
        dao.observeSubCategoriesFor(categoryId)

    fun observeSubscriptionForUser(userId: Long): Flow<SubscriptionEntity?> =
        dao.observeSubscriptionForUser(userId)

    suspend fun addCategory(nameEn: String, nameUr: String): Long =
        dao.insertCategory(CategoryEntity(nameEn = nameEn.trim(), nameUr = nameUr.trim()))

    suspend fun updateCategory(category: CategoryEntity) =
        dao.updateCategory(category)

    suspend fun deleteCategory(category: CategoryEntity) =
        dao.deleteCategory(category)

    suspend fun addSubCategory(categoryId: Long, name: String): Long =
        dao.insertSubCategory(SubCategoryEntity(categoryId = categoryId, name = name.trim()))

    suspend fun updateSubCategory(subCategory: SubCategoryEntity) =
        dao.updateSubCategory(subCategory)

    suspend fun deleteSubCategory(subCategory: SubCategoryEntity) =
        dao.deleteSubCategory(subCategory)

    suspend fun addItemUnit(name: String, nameUr: String = ""): Long =
        dao.insertItemUnit(ItemUnitEntity(name = name.trim(), nameUr = nameUr.trim()))

    suspend fun updateItemUnit(unit: ItemUnitEntity) =
        dao.updateItemUnit(unit)

    suspend fun deleteItemUnit(unit: ItemUnitEntity) =
        dao.deleteItemUnit(unit)

    suspend fun saveStockItem(item: StockItemEntity): Long {
        val syncedWeight = if (item.itemWeight > 0) item.itemWeight else item.oneTpWeight
        return dao.upsertStockItem(
            item.copy(
                oneTpWeight = syncedWeight,
                itemWeight = syncedWeight,
                updatedAt = System.currentTimeMillis()
            )
        )
    }

    suspend fun attachStockPhoto(stockItemId: Long, imageUri: String) =
        dao.updateStockImage(stockItemId, imageUri)

    suspend fun deleteStockItem(item: StockItemEntity) =
        dao.deleteStockItem(item)

    suspend fun loginWithEmail(fullName: String, email: String): UserEntity {
        val cleanEmail = email.trim().lowercase()
        val existing = dao.getUserByEmail(cleanEmail)
        dao.logoutAllUsers()
        return if (existing != null) {
            dao.setUserLoggedIn(existing.id)
            existing.copy(isLoggedIn = true)
        } else {
            val newId = dao.upsertUser(
                UserEntity(
                    fullName = fullName.trim().ifBlank { "Merchant User" },
                    email = cleanEmail,
                    role = if (cleanEmail == SubscriptionPlans.OWNER_EMAIL) "admin" else "user",
                    isLoggedIn = true
                )
            )
            dao.upsertSubscription(
                SubscriptionEntity(
                    userId = newId,
                    planType = "free",
                    status = "free",
                    pricePkr = 0
                )
            )
            dao.getLoggedInUser()!!
        }
    }

    /** Free users can ALWAYS update the Company Name without paying */
    suspend fun updateCompanyName(userId: Long, newCompanyName: String) {
        if (newCompanyName.isNotBlank()) {
            dao.updateCompanyName(userId, newCompanyName.trim())
        }
    }

    suspend fun checkAndExpireSubscriptions() {
        dao.markExpiredSubscriptions(System.currentTimeMillis())
    }

    suspend fun submitPaymentForVerification(
        user: UserEntity,
        planType: String,
        paymentMethod: String,
        transactionId: String,
        senderAccount: String
    ): Long {
        val amountPkr = if (planType == "yearly") {
            SubscriptionPlans.YEARLY_PRICE_PKR
        } else {
            SubscriptionPlans.MONTHLY_PRICE_PKR
        }
        val reqId = dao.insertPaymentVerification(
            PaymentVerificationEntity(
                userId = user.id,
                userEmail = user.email,
                userName = user.fullName,
                planType = planType,
                amountPkr = amountPkr,
                paymentMethod = paymentMethod,
                transactionId = transactionId.trim(),
                senderAccount = senderAccount.trim(),
                status = "pending"
            )
        )
        val existingSub = dao.getSubscriptionForUser(user.id)
        if (existingSub == null || existingSub.status != "active") {
            dao.upsertSubscription(
                SubscriptionEntity(
                    id = existingSub?.id ?: 0,
                    userId = user.id,
                    planType = planType,
                    status = "pending",
                    pricePkr = amountPkr,
                    paymentMethod = paymentMethod,
                    lastTransactionId = transactionId.trim()
                )
            )
        }
        return reqId
    }

    fun isOwnerAccount(user: UserEntity?): Boolean =
        user?.email?.trim()?.lowercase() == SubscriptionPlans.OWNER_EMAIL

    /**
     * Owner Payment Verification: marks verification approved and unlocks
     * the full Pro version ONLY when triggered by the verified owner account.
     */
    suspend fun adminVerifyAndActivateSubscription(
        actingUser: UserEntity?,
        request: PaymentVerificationEntity,
        adminNote: String = "Payment verified by Ahmer Iqbal"
    ) {
        if (!isOwnerAccount(actingUser)) {
            throw SecurityException("Only owner account (${SubscriptionPlans.OWNER_EMAIL}) can verify payments.")
        }
        val now = System.currentTimeMillis()
        dao.updatePaymentVerificationStatus(
            requestId = request.id,
            status = "approved",
            adminNote = adminNote,
            verifiedAt = now
        )
        val days = if (request.planType == "yearly") {
            SubscriptionPlans.YEARLY_DURATION_DAYS
        } else {
            SubscriptionPlans.MONTHLY_DURATION_DAYS
        }
        val existing = dao.getSubscriptionForUser(request.userId)
        val baseStart = if (existing != null && existing.status == "active" && existing.expiryDateMs > now) {
            existing.expiryDateMs
        } else {
            now
        }
        val expiryMs = baseStart + days * 24L * 60L * 60L * 1000L
        dao.upsertSubscription(
            SubscriptionEntity(
                id = existing?.id ?: 0,
                userId = request.userId,
                planType = request.planType,
                status = "active",
                pricePkr = request.amountPkr,
                startDateMs = now,
                expiryDateMs = expiryMs,
                paymentMethod = request.paymentMethod,
                lastTransactionId = request.transactionId,
                updatedAt = now
            )
        )
    }

    suspend fun adminRejectPayment(
        actingUser: UserEntity?,
        requestId: Long,
        adminNote: String
    ) {
        if (!isOwnerAccount(actingUser)) {
            throw SecurityException("Only owner account (${SubscriptionPlans.OWNER_EMAIL}) can reject payments.")
        }
        dao.updatePaymentVerificationStatus(
            requestId = requestId,
            status = "rejected",
            adminNote = adminNote.ifBlank { "Transaction ID could not be matched" },
            verifiedAt = System.currentTimeMillis()
        )
    }

    fun isProUnlocked(user: UserEntity?, sub: SubscriptionEntity?): Boolean {
        if (isOwnerAccount(user)) return true
        if (user == null || sub == null) return false
        return sub.status == "active" && sub.expiryDateMs > System.currentTimeMillis()
    }

    fun daysUntilExpiry(sub: SubscriptionEntity?): Long? {
        if (sub == null || sub.expiryDateMs <= 0L) return null
        val diff = sub.expiryDateMs - System.currentTimeMillis()
        return if (diff <= 0L) 0L else (diff / (24L * 60L * 60L * 1000L)) + 1L
    }

    fun isExpiringSoon(sub: SubscriptionEntity?): Boolean {
        val days = daysUntilExpiry(sub) ?: return false
        return sub?.status == "active" && days <= 7L
    }
}
