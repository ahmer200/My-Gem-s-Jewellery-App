# Aqsa Business Management System — Android APK, Firebase & Keystore Guide
**Merchant:** N.A GEM'S — Nazim Ahmer Nagina, Gemstone & Jewelry Merchant
**Application ID:** `com.nagem.aqsa`
**Firebase Project ID:** `fourth-xyston-lfx4d`

---

## 0. Automatic Updates Across All Installed APKs & Web App

1. **Real-Time Business Data Sync (Firestore `onSnapshot`)**:
   Every device (Android APKs + Web Browsers) signed into the same Google account automatically streams live changes to invoices, dispatch status, inventory, payments, rates, and customers/vendors in ~1 second. Offline edits sync automatically when reconnected.
2. **Automatic UI & Feature Updates (Live OTA Mode)**:
   `MainActivity.kt` checks `live_app_url/version.json` on launch.
   - Set `<string name="live_app_url">` in `android/app/src/main/res/values/strings.xml` (or update it inside **Setup -> Cloud Sync & Backup -> Android Live Web Update Mode**) to your live web deployment URL (such as Firebase Hosting `https://fourth-xyston-lfx4d.web.app` or a public Shared App URL).
   - Whenever you publish an updated web build (`npm run build`), every installed APK automatically loads the new web version without needing to rebuild or reinstall the APK.
   - When offline or unreachable, the APK seamlessly loads its bundled `assets/www/index.html` fallback.

---

## 1. Prerequisites
- **Node.js 20+** and **npm**
- **Android Studio (Ladybug / 2024+)** or **Android SDK Command-Line Tools** (`compileSdk 35`, `JDK 17`)

---

## 2. Step-by-Step Build Instructions (Web Bundle -> Android Assets)

1. Install dependencies, build the production bundle, and sync Android offline fallback assets in one command:
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
3. Add your SHA-1 fingerprint (from `keytool -list -v -keystore android/app/aqsa-release.jks`).
4. Download the updated `google-services.json` and replace `android/app/google-services.json`.

---

## 4. Keystore Generation Note (CRITICAL FOR RELEASE APKs)
Never lose your release keystore or commit `.jks` / `keystore.properties` to public git repositories.

1. Generate your release keystore (one-time):
   ```bash
   keytool -genkey -v -keystore android/app/aqsa-release.jks \
     -alias aqsa_bms_key \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Create `android/keystore.properties` (kept local/private, never committed):
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
2. Wait for Gradle Sync to finish.
3. Click **Build -> Build Bundle(s) / APK(s) -> Build APK(s)** (or **Generate Signed Bundle / APK**).

### Option B: Command Line (Gradle)
```bash
cd android

# Build Debug APK (for immediate USB/ADB testing)
./gradlew assembleDebug
# Output: android/app/build/outputs/apk/debug/app-debug.apk

# Build Signed Release APK (requires android/keystore.properties)
./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
```
