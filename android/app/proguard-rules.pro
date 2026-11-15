-keepattributes *Annotation*
-keepclassmembers class com.nagem.aqsa.MainActivity$AqsaAndroidBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-dontwarn android.webkit.**
