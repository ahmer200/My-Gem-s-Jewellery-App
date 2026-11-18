package com.nagem.aqsa.data.local

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class MovementGrandTotals(
    val inHandQty: Double = 0.0,
    val purchasedQty: Double = 0.0,
    val lossQty: Double = 0.0,
    val totalWeight: Double = 0.0,
    val soldQty: Double = 0.0,
    val soldPieces: Int = 0,
    val totalInvoices: Int = 0
)

data class AmountGrandTotals(
    val totalInHandQty: Double = 0.0,
    val totalInHandCostPkr: Double = 0.0
)

class InventoryViewModel(private val repository: AqsaRepository) : ViewModel() {

    val categories: StateFlow<List<CategoryEntity>> = repository.categories.stateIn(
        viewModelScope,
        SharingStarted.WhileSubscribed(5000),
        emptyList()
    )

    val subCategories: StateFlow<List<SubCategoryEntity>> = repository.subCategories.stateIn(
        viewModelScope,
        SharingStarted.WhileSubscribed(5000),
        emptyList()
    )

    val stockItems: StateFlow<List<StockItemEntity>> = repository.stockItems.stateIn(
        viewModelScope,
        SharingStarted.WhileSubscribed(5000),
        emptyList()
    )

    val dailyMovementRows: StateFlow<List<DailyMovementRow>> = repository.dailyMovementReport.stateIn(
        viewModelScope,
        SharingStarted.WhileSubscribed(5000),
        emptyList()
    )

    val dailyMovementGrandTotals: StateFlow<MovementGrandTotals> = dailyMovementRows
        .map { rows ->
            MovementGrandTotals(
                inHandQty = rows.sumOf { it.inHandQuantity },
                purchasedQty = rows.sumOf { it.purchasedQuantity },
                lossQty = rows.sumOf { it.lossQuantity },
                totalWeight = rows.sumOf { it.weight },
                soldQty = rows.sumOf { it.soldItemQuantity },
                soldPieces = rows.sumOf { it.soldPieces },
                totalInvoices = rows.sumOf { it.numberOfInvoices }
            )
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), MovementGrandTotals())

    val dailyAmountRows: StateFlow<List<DailyAmountRow>> = repository.dailyAmountReport.stateIn(
        viewModelScope,
        SharingStarted.WhileSubscribed(5000),
        emptyList()
    )

    val dailyAmountGrandTotals: StateFlow<AmountGrandTotals> = dailyAmountRows
        .map { rows ->
            AmountGrandTotals(
                totalInHandQty = rows.sumOf { it.inHandQuantity },
                totalInHandCostPkr = rows.sumOf { it.totalCostPkr }
            )
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), AmountGrandTotals())

    fun addCategory(nameEn: String, nameUr: String = "") = viewModelScope.launch {
        if (nameEn.isNotBlank()) repository.addCategory(nameEn, nameUr)
    }

    fun updateCategory(category: CategoryEntity) = viewModelScope.launch {
        repository.updateCategory(category)
    }

    fun deleteCategory(category: CategoryEntity) = viewModelScope.launch {
        repository.deleteCategory(category)
    }

    fun addSubCategory(categoryId: Long, name: String) = viewModelScope.launch {
        if (name.isNotBlank()) repository.addSubCategory(categoryId, name)
    }

    fun updateSubCategory(subCategory: SubCategoryEntity) = viewModelScope.launch {
        repository.updateSubCategory(subCategory)
    }

    fun deleteSubCategory(subCategory: SubCategoryEntity) = viewModelScope.launch {
        repository.deleteSubCategory(subCategory)
    }

    fun saveStockItem(item: StockItemEntity) = viewModelScope.launch {
        repository.saveStockItem(item)
    }

    fun attachStockPhoto(stockItemId: Long, imageUri: String) = viewModelScope.launch {
        repository.attachStockPhoto(stockItemId, imageUri)
    }

    fun deleteStockItem(item: StockItemEntity) = viewModelScope.launch {
        repository.deleteStockItem(item)
    }

    class Factory(private val repository: AqsaRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return InventoryViewModel(repository) as T
        }
    }
}
