package com.nagem.aqsa.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.nagem.aqsa.data.local.AqsaRepository
import com.nagem.aqsa.data.local.AqsaRoomDatabase
import com.nagem.aqsa.data.local.BasicCostStockRow
import com.nagem.aqsa.data.local.CategoryEntity
import com.nagem.aqsa.data.local.DailyAmountRow
import com.nagem.aqsa.data.local.DailyMovementRow
import com.nagem.aqsa.data.local.ItemUnitEntity
import com.nagem.aqsa.data.local.PaymentVerificationEntity
import com.nagem.aqsa.data.local.StockItemEntity
import com.nagem.aqsa.data.local.SubCategoryEntity
import com.nagem.aqsa.data.local.SubscriptionEntity
import com.nagem.aqsa.data.local.UserEntity
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

enum class LockedFeature {
    STOCK_IMAGE_UPLOAD,
    DAILY_STOCK_MOVEMENT_REPORT,
    DAILY_AMOUNT_WISE_REPORT,
    FULL_CATEGORY_UNIT_MANAGEMENT,
    COMPLETE_INVOICE_FUNCTIONS
}

@OptIn(ExperimentalCoroutinesApi::class)
class AqsaViewModel(application: Application) : AndroidViewModel(application) {

    private val dao = AqsaRoomDatabase.getInstance(application).aqsaDao()
    private val repository = AqsaRepository(dao)

    val categories: StateFlow<List<CategoryEntity>> = repository.categories
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val subCategories: StateFlow<List<SubCategoryEntity>> = repository.subCategories
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val itemUnits: StateFlow<List<ItemUnitEntity>> = repository.itemUnits
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val stockItems: StateFlow<List<StockItemEntity>> = repository.stockItems
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val loggedInUser: StateFlow<UserEntity?> = repository.loggedInUser
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val activeSubscription: StateFlow<SubscriptionEntity?> = loggedInUser
        .flatMapLatest { user ->
            if (user == null) flowOf(null) else repository.observeSubscriptionForUser(user.id)
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val paymentVerifications: StateFlow<List<PaymentVerificationEntity>> = repository.paymentVerifications
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val isOwnerAccount: StateFlow<Boolean> = loggedInUser
        .flatMapLatest { user -> flowOf(repository.isOwnerAccount(user)) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    val isProUnlocked: StateFlow<Boolean> = combine(loggedInUser, activeSubscription) { user, sub ->
        repository.isProUnlocked(user, sub)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    val isExpiringSoon: StateFlow<Boolean> = activeSubscription
        .flatMapLatest { sub -> flowOf(repository.isExpiringSoon(sub)) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    val basicCostStockReport: Flow<List<BasicCostStockRow>> = repository.basicCostStockReport
    val dailyMovementReport: Flow<List<DailyMovementRow>> = repository.dailyMovementReport
    val dailyAmountReport: Flow<List<DailyAmountRow>> = repository.dailyAmountReport

    init {
        viewModelScope.launch {
            repository.checkAndExpireSubscriptions()
        }
    }

    fun isFeatureLocked(feature: LockedFeature): Boolean {
        return !isProUnlocked.value
    }

    // ---- Free-allowed Company Name update ----
    fun updateCompanyName(companyName: String) {
        viewModelScope.launch {
            val user = loggedInUser.value ?: return@launch
            repository.updateCompanyName(user.id, companyName)
        }
    }

    // ---- User Login ----
    fun loginUser(fullName: String, email: String) {
        viewModelScope.launch {
            repository.loginWithEmail(fullName, email)
            repository.checkAndExpireSubscriptions()
        }
    }

    // ---- Category, Sub-Category & Item Unit CRUD ----
    fun addCategory(nameEn: String, nameUr: String) = viewModelScope.launch {
        repository.addCategory(nameEn, nameUr)
    }

    fun updateCategory(category: CategoryEntity) = viewModelScope.launch {
        repository.updateCategory(category)
    }

    fun deleteCategory(category: CategoryEntity) = viewModelScope.launch {
        repository.deleteCategory(category)
    }

    fun addSubCategory(categoryId: Long, name: String) = viewModelScope.launch {
        repository.addSubCategory(categoryId, name)
    }

    fun deleteSubCategory(subCategory: SubCategoryEntity) = viewModelScope.launch {
        repository.deleteSubCategory(subCategory)
    }

    fun addItemUnit(name: String, nameUr: String = "") = viewModelScope.launch {
        repository.addItemUnit(name, nameUr)
    }

    fun updateItemUnit(unit: ItemUnitEntity) = viewModelScope.launch {
        repository.updateItemUnit(unit)
    }

    fun deleteItemUnit(unit: ItemUnitEntity) = viewModelScope.launch {
        repository.deleteItemUnit(unit)
    }

    // ---- Stock Item CRUD & Photo URI ----
    fun saveStockItem(item: StockItemEntity) = viewModelScope.launch {
        repository.saveStockItem(item)
    }

    fun attachStockPhoto(stockItemId: Long, imageUri: String) = viewModelScope.launch {
        repository.attachStockPhoto(stockItemId, imageUri)
    }

    fun deleteStockItem(item: StockItemEntity) = viewModelScope.launch {
        repository.deleteStockItem(item)
    }

    // ---- EasyPaisa / Meezan Bank Payment Submission & Admin Verification ----
    fun submitPaymentForVerification(
        planType: String,
        paymentMethod: String,
        transactionId: String,
        senderAccount: String
    ) = viewModelScope.launch {
        val user = loggedInUser.value ?: return@launch
        repository.submitPaymentForVerification(
            user = user,
            planType = planType,
            paymentMethod = paymentMethod,
            transactionId = transactionId,
            senderAccount = senderAccount
        )
    }

    fun adminVerifyPayment(request: PaymentVerificationEntity, note: String = "") = viewModelScope.launch {
        val currentUser = loggedInUser.value
        if (!repository.isOwnerAccount(currentUser)) return@launch
        repository.adminVerifyAndActivateSubscription(
            actingUser = currentUser,
            request = request,
            adminNote = note.ifBlank { "Verified by Owner (ahmer.iqbal.khan@gmail.com)" }
        )
    }

    fun adminRejectPayment(requestId: Long, note: String) = viewModelScope.launch {
        val currentUser = loggedInUser.value
        if (!repository.isOwnerAccount(currentUser)) return@launch
        repository.adminRejectPayment(
            actingUser = currentUser,
            requestId = requestId,
            adminNote = note
        )
    }
}
