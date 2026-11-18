# Aqsa Business Management System — Android APK, Room DB & Keystore Guide
**Merchant:** N.A GEM'S — Nazim Ahmer Nagina, Gemstone & Jewelry Merchant
**Application ID:** `com.nagem.aqsa`
**Firebase Project ID:** `fourth-xyston-lfx4d`

---

## 0. Included Modules & Architecture

1. **Local Room Database v2 (`androidx.room` 2.6.1)**:
   - `data/local/Entities.kt` (`CategoryEntity`, `SubCategoryEntity`, `ItemUnitEntity`, `UserEntity`, `SubscriptionEntity`, `PaymentVerificationEntity`, `StockItemEntity`, `BasicCostStockRow`, `DailyMovementRow`, `DailyAmountRow`)
   - `data/local/AqsaDao.kt`, `AqsaRoomDatabase.kt` (v2 with automatic pre-seeding), `AqsaRepository.kt`
   - `viewmodel/AqsaViewModel.kt` (Exposes categories, sub-categories, item units, item weight, subscription locking, expiry reminders, and Admin verification)
2. **Subscription & Payment Verification Module**:
   - **Plans**: Monthly (`4500 PKR / Month`, 30 days) and Yearly (`35000 PKR / Year`, 365 days)
   - **Payment Accounts**:
     - **EasyPaisa Number**: `03320001602`
     - **Meezan Bank**: Account Title `AHMER IQBAL`, Account Number `16020109874519`, IBAN `PK54MEZN0016020109874519`, Branch `LATIFABAD BRANCH-HYD`
   - **Free / Basic Version**: Users can change Company Name and view limited stock report previews. Locked modules: Stock Camera/Gallery photos, Daily Stock Movement Report, Daily Amount Wise Stock Report, full Category/Sub-Category/Item Unit management, and complete Invoicing.
   - **Layouts**: `activity_subscription.xml`, `activity_admin_verify.xml`, `item_payment_verification.xml`, `dialog_stock_entry.xml`
3. **Stock Entry Camera + Gallery Photo + Item Unit + Item Weight (`MainActivity.kt` + `FileProvider`)**:
   - **Take Photo (Camera)** launches native `ActivityResultContracts.TakePicture()` via `FileProvider` with runtime `CAMERA` permission check.
   - **Upload Gallery** launches `ActivityResultContracts.GetMultipleContents("image/*")`.
   - `dialog_stock_entry.xml` includes Category, Sub-Category, Item Unit, and Item Weight fields.
4. **Stock Reports & Native Multi-Page PDF Exporter (`pdf/StockPdfExporter.kt`)**:
   - **Basic Stock Report (Cost Only, NO Markup)**: Shows Category, Sub-Category, Item Unit, Item Weight, original product cost price & sold invoice numbers, zero markup/sell price, page totals & Grand Total.
   - **Daily Stock Movement Report**: Quantities only (including Category, Sub-Category, Unit, Item Weight, In-Hand Qty, Purchased Qty, Loss Qty, Total Weight, Sold Qty, Sold Pieces, Invoices #) with page-wise sums on every page & Grand Total on the final page.
   - **Daily Amount Wise Stock Report**: Original cost price & total cost amount only (including Category, Sub-Category, Unit, Item Weight) with page-wise sums & Grand Total on the final page.
5. **Automatic Updates Across All Installed APKs & Web App**:
   - Real-time Firestore sync + Live OTA check (`live_app_url/version.json`) with offline bundled `assets/www/index.html` fallback.

---

## 1. Prerequisites
- **Node.js 20+** and **npm**
- **Android Studio (Ladybug / 2024+)** or **Android SDK Command-Line Tools** (`compileSdk 35`, `JDK 17`)

---

## 2. Build Web Bundle -> Sync Android Offline Assets

```bash
npm install
npm run build:android
```

---

## 3. Firebase Android Setup (`google-services.json`)
A pre-linked `android/app/google-services.json` is included for project `fourth-xyston-lfx4d`.
To enable native Google Sign-In on physical Android devices:
1. Open **Firebase Console** -> Project `fourth-xyston-lfx4d` -> **Project Settings** -> **Add App (Android)**.
2. Enter package name: `com.nagem.aqsa`.
3. Add your SHA-1 fingerprint (`keytool -list -v -keystore android/app/aqsa-release.jks`).
4. Download `google-services.json` and replace `android/app/google-services.json`.

---

## 4. Keystore Generation Note (CRITICAL FOR RELEASE APKs)
```bash
keytool -genkey -v -keystore android/app/aqsa-release.jks \
  -alias aqsa_bms_key \
  -keyalg RSA -keysize 2048 -validity 10000
```
Create `android/keystore.properties` (kept private, never committed):
```properties
storeFile=aqsa-release.jks
storePassword=YOUR_STRONG_STORE_PASSWORD
keyAlias=aqsa_bms_key
keyPassword=YOUR_STRONG_KEY_PASSWORD
```

---

## 5. Build Debug & Signed Release APK

### Option A: Android Studio (GUI)
1. Open the `/android` folder in **Android Studio**.
2. Wait for Gradle Sync (Room v2, `kotlin-kapt`, Lifecycle ViewModel, Firebase BOM).
3. Click **Build -> Build Bundle(s) / APK(s) -> Build APK(s)** (or **Generate Signed Bundle / APK**).

### Option B: Command Line (Gradle)
```bash
cd android

# Build Debug APK (for direct phone USB/ADB testing)
./gradlew assembleDebug
# Output: android/app/build/outputs/apk/debug/app-debug.apk

# Build Signed Release APK (requires android/keystore.properties)
./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
```
