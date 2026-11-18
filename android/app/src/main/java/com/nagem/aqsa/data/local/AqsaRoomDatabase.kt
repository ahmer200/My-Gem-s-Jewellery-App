package com.nagem.aqsa.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@Database(
    entities = [
        CategoryEntity::class,
        SubCategoryEntity::class,
        ItemUnitEntity::class,
        UserEntity::class,
        SubscriptionEntity::class,
        PaymentVerificationEntity::class,
        StockItemEntity::class
    ],
    version = 2,
    exportSchema = false
)
abstract class AqsaRoomDatabase : RoomDatabase() {

    abstract fun aqsaDao(): AqsaDao

    companion object {
        @Volatile
        private var INSTANCE: AqsaRoomDatabase? = null

        fun getInstance(context: Context): AqsaRoomDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AqsaRoomDatabase::class.java,
                    "aqsa_bms_room_db"
                )
                    .addCallback(SeedCallback())
                    .fallbackToDestructiveMigration()
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }

    private class SeedCallback : Callback() {
        override fun onCreate(db: SupportSQLiteDatabase) {
            super.onCreate(db)
            CoroutineScope(Dispatchers.IO).launch {
                val dao = INSTANCE?.aqsaDao() ?: return@launch

                // 1. Seed Gemstone Categories & Sub-Categories
                val defaults = listOf(
                    Triple("Natural Emerald", "قدرتی زمرد", listOf("Emerald Parcel", "Emerald Single", "Panjshir Emerald")),
                    Triple("Natural Ruby", "قدرتی یاقوت", listOf("Ruby Heated", "Unheated Ruby", "Ruby Cabochon")),
                    Triple("Natural Sapphire", "قدرتی نیلم", listOf("Kashmir Sapphire", "Ceylon Sapphire", "Yellow Sapphire")),
                    Triple("Precious Beads", "قیمتی موتی", listOf("Emerald Beads", "Ruby Beads", "Spinel Strand")),
                    Triple("Tourmaline", "ٹورمالین", listOf("Pink Tourmaline", "Bi-Color Tourmaline", "Green Tourmaline")),
                    Triple("Aquamarine", "ایکوامیرین", listOf("Shigar Aquamarine", "Crystal Specimen"))
                )
                for ((en, ur, subs) in defaults) {
                    val catId = dao.insertCategory(CategoryEntity(nameEn = en, nameUr = ur))
                    for (sub in subs) {
                        dao.insertSubCategory(SubCategoryEntity(categoryId = catId, name = sub))
                    }
                }

                // 2. Seed Default Item Units
                val defaultUnits = listOf(
                    "Carats" to "قیراط",
                    "Grams" to "گرام",
                    "Pieces" to "پیس",
                    "Parcel" to "پارسل",
                    "Tola" to "تولہ",
                    "Ratti" to "رتی",
                    "Strands" to "لڑی",
                    "Sets" to "سیٹ"
                )
                for ((name, ur) in defaultUnits) {
                    dao.insertItemUnit(ItemUnitEntity(name = name, nameUr = ur))
                }

                // 3. Seed Admin & Default Free Merchant User + Initial Free Subscription
                val adminId = dao.upsertUser(
                    UserEntity(
                        fullName = "Ahmer Iqbal (Admin)",
                        email = "ahmer.iqbal.khan@gmail.com",
                        role = "admin",
                        companyName = "N.A GEM'S",
                        isLoggedIn = false
                    )
                )
                dao.upsertSubscription(
                    SubscriptionEntity(
                        userId = adminId,
                        planType = "yearly",
                        status = "active",
                        pricePkr = 35000,
                        startDateMs = System.currentTimeMillis(),
                        expiryDateMs = System.currentTimeMillis() + 365L * 24L * 60L * 60L * 1000L,
                        paymentMethod = "Admin Master",
                        lastTransactionId = "ADMIN-MASTER"
                    )
                )

                val freeUserId = dao.upsertUser(
                    UserEntity(
                        fullName = "Nazim Ahmer Merchant",
                        email = "merchant@nagems.pk",
                        role = "user",
                        companyName = "N.A GEM'S",
                        isLoggedIn = true
                    )
                )
                dao.upsertSubscription(
                    SubscriptionEntity(
                        userId = freeUserId,
                        planType = "free",
                        status = "free",
                        pricePkr = 0,
                        startDateMs = 0L,
                        expiryDateMs = 0L
                    )
                )
            }
        }
    }
}
