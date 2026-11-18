package com.nagem.aqsa

import android.Manifest
import android.annotation.SuppressLint
import android.app.Dialog
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Bundle
import android.os.Message
import android.print.PrintAttributes
import android.print.PrintManager
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.webkit.WebViewAssetLoader
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {

    companion object {
        private const val PREFS_NAME = "aqsa_bms_prefs"
        private const val KEY_LIVE_URL = "live_app_url"
        private const val KEY_LIVE_ENABLED = "live_sync_enabled"
        private const val LOCAL_ASSET_URL = "https://appassets.androidplatform.net/assets/www/index.html"
    }

    private lateinit var webView: WebView
    private var pendingPermissionRequest: PermissionRequest? = null
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var pendingCameraImageUri: Uri? = null
    private var pendingCameraFileLaunch = false
    private var loadedFallback = false
    private val executor = Executors.newSingleThreadExecutor()

    private val takeCameraPhotoLauncher = registerForActivityResult(
        ActivityResultContracts.TakePicture()
    ) { success ->
        val uri = pendingCameraImageUri
        if (success && uri != null) {
            filePathCallback?.onReceiveValue(arrayOf(uri))
        } else {
            filePathCallback?.onReceiveValue(emptyArray())
        }
        filePathCallback = null
        pendingCameraImageUri = null
    }

    private val requestCameraPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            pendingPermissionRequest?.grant(pendingPermissionRequest?.resources)
            if (pendingCameraFileLaunch) {
                pendingCameraFileLaunch = false
                launchNativeCameraCapture()
            }
        } else {
            pendingPermissionRequest?.deny()
            if (pendingCameraFileLaunch) {
                pendingCameraFileLaunch = false
                filePathCallback?.onReceiveValue(emptyArray())
                filePathCallback = null
            }
        }
        pendingPermissionRequest = null
    }

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.GetMultipleContents()
    ) { uris ->
        filePathCallback?.onReceiveValue(uris.toTypedArray())
        filePathCallback = null
    }

    private fun launchNativeCameraCapture() {
        val photoFile = File(cacheDir, "stock_cam_${System.currentTimeMillis()}.jpg")
        val uri = FileProvider.getUriForFile(
            this,
            "${applicationContext.packageName}.fileprovider",
            photoFile
        )
        pendingCameraImageUri = uri
        takeCameraPhotoLauncher.launch(uri)
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = false
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            useWideViewPort = true
            loadWithOverviewMode = true
            setSupportMultipleWindows(true)
            javaScriptCanOpenWindowsAutomatically = true
            cacheMode = WebSettings.LOAD_DEFAULT
        }

        webView.addJavascriptInterface(AqsaAndroidBridge(this, webView), "AqsaAndroidBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                if (request.url.host == "appassets.androidplatform.net") {
                    return assetLoader.shouldInterceptRequest(request.url)
                }
                return null
            }

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                val url = request.url.toString()
                if (url.startsWith("https://wa.me/") ||
                    url.startsWith("whatsapp://") ||
                    url.startsWith("sms:") ||
                    url.startsWith("tel:")
                ) {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    return true
                }
                return false
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {
                super.onReceivedError(view, request, error)
                if (request.isForMainFrame && !loadedFallback &&
                    request.url.host != "appassets.androidplatform.net"
                ) {
                    loadedFallback = true
                    view.loadUrl(LOCAL_ASSET_URL)
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                val cameraRequired = request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
                if (cameraRequired) {
                    if (ContextCompat.checkSelfPermission(
                            this@MainActivity,
                            Manifest.permission.CAMERA
                        ) == PackageManager.PERMISSION_GRANTED
                    ) {
                        request.grant(request.resources)
                    } else {
                        pendingPermissionRequest = request
                        requestCameraPermission.launch(Manifest.permission.CAMERA)
                    }
                } else {
                    request.grant(request.resources)
                }
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(emptyArray())
                this@MainActivity.filePathCallback = filePathCallback

                val isCapture = fileChooserParams?.isCaptureEnabled == true
                if (isCapture) {
                    if (ContextCompat.checkSelfPermission(
                            this@MainActivity,
                            Manifest.permission.CAMERA
                        ) == PackageManager.PERMISSION_GRANTED
                    ) {
                        launchNativeCameraCapture()
                    } else {
                        pendingCameraFileLaunch = true
                        requestCameraPermission.launch(Manifest.permission.CAMERA)
                    }
                    return true
                }

                val acceptTypes = fileChooserParams?.acceptTypes ?: emptyArray()
                val mime = if (acceptTypes.any { it.contains("image") }) "image/*" else "*/*"
                fileChooserLauncher.launch(mime)
                return true
            }

            @SuppressLint("SetJavaScriptEnabled")
            override fun onCreateWindow(
                view: WebView?,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: Message?
            ): Boolean {
                val popupWebView = WebView(this@MainActivity)
                CookieManager.getInstance().setAcceptThirdPartyCookies(popupWebView, true)
                popupWebView.settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    databaseEnabled = true
                    userAgentString = webView.settings.userAgentString.replace("; wv", "")
                }

                val dialog = Dialog(this@MainActivity, android.R.style.Theme_DeviceDefault_Light_NoActionBar)
                dialog.setContentView(
                    popupWebView,
                    ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                )

                popupWebView.webViewClient = object : WebViewClient() {}
                popupWebView.webChromeClient = object : WebChromeClient() {
                    override fun onCloseWindow(window: WebView?) {
                        dialog.dismiss()
                    }
                }

                dialog.setOnDismissListener {
                    popupWebView.destroy()
                }
                dialog.show()

                val transport = resultMsg?.obj as? WebView.WebViewTransport
                transport?.webView = popupWebView
                resultMsg?.sendToTarget()
                return true
            }
        }

        loadBestAvailableApp()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    finish()
                }
            }
        })
    }

    override fun onDestroy() {
        executor.shutdownNow()
        super.onDestroy()
    }

    private fun getConfiguredLiveUrl(): String {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val saved = prefs.getString(KEY_LIVE_URL, null)
        return (if (!saved.isNullOrBlank()) saved else getString(R.string.live_app_url)).trimEnd('/')
    }

    private fun isLiveSyncEnabled(): Boolean {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getBoolean(KEY_LIVE_ENABLED, true)
    }

    private fun isNetworkAvailable(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    fun loadBestAvailableApp() {
        loadedFallback = false
        val liveUrl = getConfiguredLiveUrl()
        val liveEnabled = isLiveSyncEnabled()

        if (!liveEnabled || !liveUrl.startsWith("https://") || !isNetworkAvailable()) {
            loadedFallback = true
            webView.loadUrl(LOCAL_ASSET_URL)
            return
        }

        executor.execute {
            val reachable = checkLiveVersionEndpoint(liveUrl)
            runOnUiThread {
                if (reachable) {
                    webView.loadUrl(liveUrl)
                } else {
                    loadedFallback = true
                    webView.loadUrl(LOCAL_ASSET_URL)
                }
            }
        }
    }

    private fun checkLiveVersionEndpoint(baseUrl: String): Boolean {
        var conn: HttpURLConnection? = null
        return try {
            val url = URL("$baseUrl/version.json?t=${System.currentTimeMillis()}")
            conn = (url.openConnection() as HttpURLConnection).apply {
                connectTimeout = 2500
                readTimeout = 2500
                requestMethod = "GET"
                instanceFollowRedirects = false
                setRequestProperty("Cache-Control", "no-cache")
            }
            if (conn.responseCode == HttpURLConnection.HTTP_OK) {
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                body.contains("\"aqsa-bms\"")
            } else {
                false
            }
        } catch (_: Exception) {
            false
        } finally {
            conn?.disconnect()
        }
    }

    class AqsaAndroidBridge(
        private val activity: MainActivity,
        private val webView: WebView
    ) {
        @JavascriptInterface
        fun isNativeAndroid(): Boolean = true

        @JavascriptInterface
        fun getLiveAppUrl(): String = activity.getConfiguredLiveUrl()

        @JavascriptInterface
        fun setLiveAppUrl(url: String) {
            val cleaned = url.trim().trimEnd('/')
            if (cleaned.startsWith("https://") || cleaned.isEmpty()) {
                activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    .edit()
                    .putString(KEY_LIVE_URL, cleaned)
                    .apply()
            }
        }

        @JavascriptInterface
        fun isLiveSyncEnabled(): Boolean = activity.isLiveSyncEnabled()

        @JavascriptInterface
        fun setLiveSyncEnabled(enabled: Boolean) {
            activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putBoolean(KEY_LIVE_ENABLED, enabled)
                .apply()
        }

        @JavascriptInterface
        fun reloadApp() {
            activity.runOnUiThread {
                activity.loadBestAvailableApp()
            }
        }

        @JavascriptInterface
        fun printCurrentPage(jobTitle: String) {
            webView.post {
                val printManager = activity.getSystemService(Context.PRINT_SERVICE) as PrintManager
                val adapter = webView.createPrintDocumentAdapter(jobTitle.ifBlank { "NA_GEMS_Invoice" })
                printManager.print(
                    jobTitle.ifBlank { "NA_GEMS_Invoice" },
                    adapter,
                    PrintAttributes.Builder().build()
                )
            }
        }
    }
}
