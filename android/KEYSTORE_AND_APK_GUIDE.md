# Aqsa Business Management System — Android APK, Firebase & Keystore Guide
**Merchant:** N.A GEM'S — Nazim Ahmer Nagina, Gemstone & Jewelry Merchant
**Application ID:** `com.nagem.aqsa`
**Firebase Project ID:** `fourth-xyston-lfx4d`

---

## 1. Prerequisites
- **Node.js 20+** and **npm**
- **Android Studio (Ladybug / 2024+)** or **Android SDK Command-Line Tools** (`compileSdk 35`, `JDK 17`)

---

## 2. Step-by-Step Build Instructions (Web Bundle -> Android Assets)

1. Install web dependencies and build the production bundle:
   ```bash
   npm install
   npm run build
   ```
2. Copy the built `dist/` files into the Android native `assets/www/` folder:
   ```bash
   mkdir -p android/app/src/main/assets/www
   rm -rf android/app/src/main/assets/www/*
   cp -r dist/* android/app/src/main/assets/www/
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
