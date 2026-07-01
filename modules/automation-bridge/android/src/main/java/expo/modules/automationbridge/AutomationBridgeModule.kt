package expo.modules.automationbridge

import android.accessibilityservice.AccessibilityService as SystemAccessibilityService
import android.app.Activity
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import android.provider.Settings
import android.view.accessibility.AccessibilityNodeInfo
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.coroutines.resume
import kotlinx.coroutines.CancellableContinuation
import kotlinx.coroutines.suspendCancellableCoroutine

private class ServiceNotConnectedException :
  CodedException("Accessibility service is not running. Ask the user to enable it in system settings first.")

private class NodeNotFoundException(nodeId: String) :
  CodedException("No accessibility node found for id '$nodeId'. The screen may have changed since it was read.")

private class InvalidGlobalActionException(action: String) :
  CodedException("Unknown global action '$action'. Expected one of: back, home, recents.")

private class NoActivityException :
  CodedException("No current activity to launch the screen-capture consent dialog from.")

class AutomationBridgeModule : Module() {

  companion object {
    private const val SCREEN_CAPTURE_REQUEST_CODE = 84271
  }

  private var pendingScreenCaptureContinuation: CancellableContinuation<Boolean>? = null

  override fun definition() = ModuleDefinition {
    Name("AutomationBridge")

    Function("isAccessibilityServiceEnabled") {
      isAccessibilityServiceEnabled()
    }

    Function("openAccessibilitySettings") {
      val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      (appContext.currentActivity ?: appContext.reactContext)?.startActivity(intent)
    }

    // Returns the current window's accessibility tree serialized as a JSON
    // string, or null if the service isn't running / there's no active
    // window yet. Returning a JSON string (rather than a nested Map/Array)
    // keeps the bridge crossing cheap for potentially large trees; the JS
    // side parses it once.
    AsyncFunction("getUiTree") {
      val service = AutomationAccessibilityService.instance ?: return@AsyncFunction null
      val root = service.currentRootNode() ?: return@AsyncFunction null
      try {
        UiTreeSerializer.serialize(root).toString()
      } finally {
        @Suppress("DEPRECATION")
        root.recycle()
      }
    }

    AsyncFunction("performClick") { nodeId: String ->
      performOnNode(nodeId) { it.performAction(AccessibilityNodeInfo.ACTION_CLICK) }
    }

    AsyncFunction("performSetText") { nodeId: String, text: String ->
      performOnNode(nodeId) { node ->
        val args = Bundle().apply {
          putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
        }
        node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
      }
    }

    AsyncFunction("performScroll") { nodeId: String, direction: String ->
      val action = when (direction) {
        "forward" -> AccessibilityNodeInfo.ACTION_SCROLL_FORWARD
        "backward" -> AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD
        else -> throw CodedException("Unknown scroll direction '$direction'. Expected 'forward' or 'backward'.")
      }
      performOnNode(nodeId) { it.performAction(action) }
    }

    AsyncFunction("performGlobalAction") { action: String ->
      val service = AutomationAccessibilityService.instance ?: throw ServiceNotConnectedException()
      val globalAction = when (action) {
        "back" -> SystemAccessibilityService.GLOBAL_ACTION_BACK
        "home" -> SystemAccessibilityService.GLOBAL_ACTION_HOME
        "recents" -> SystemAccessibilityService.GLOBAL_ACTION_RECENTS
        else -> throw InvalidGlobalActionException(action)
      }
      service.performGlobalAction(globalAction)
    }

    // Coordinate-based fallback for when there's no accessibility node to
    // target (the vision path only ever gets pixel coordinates back).
    AsyncFunction("performTap") { x: Double, y: Double ->
      val service = AutomationAccessibilityService.instance ?: throw ServiceNotConnectedException()
      service.tap(x.toFloat(), y.toFloat())
    }

    AsyncFunction("performSwipe") { x1: Double, y1: Double, x2: Double, y2: Double, durationMs: Double? ->
      val service = AutomationAccessibilityService.instance ?: throw ServiceNotConnectedException()
      service.swipe(x1.toFloat(), y1.toFloat(), x2.toFloat(), y2.toFloat(), durationMs?.toLong())
    }

    Function("hasScreenCapturePermission") {
      ScreenCaptureManager.hasActiveSession()
    }

    // Launches the system's screen-capture consent dialog and suspends until
    // the user answers it. Resolves true/false rather than throwing on
    // denial, since "user said no" is an expected outcome, not an error.
    AsyncFunction("requestScreenCapturePermission") {
      val activity = appContext.currentActivity ?: throw NoActivityException()
      val manager = activity.getSystemService(MediaProjectionManager::class.java)
      val intent = manager.createScreenCaptureIntent()
      suspendCancellableCoroutine<Boolean> { continuation ->
        pendingScreenCaptureContinuation = continuation
        activity.startActivityForResult(intent, SCREEN_CAPTURE_REQUEST_CODE)
      }
    }

    AsyncFunction("captureScreenshot") {
      ScreenCaptureManager.captureBase64Png()
    }

    Function("stopScreenCapture") {
      appContext.reactContext?.let { ScreenCaptureService.stop(it) }
      ScreenCaptureManager.release()
    }

    OnActivityResult { activity, payload ->
      if (payload.requestCode != SCREEN_CAPTURE_REQUEST_CODE) return@OnActivityResult
      val continuation = pendingScreenCaptureContinuation
      pendingScreenCaptureContinuation = null

      val data = payload.data
      if (payload.resultCode != Activity.RESULT_OK || data == null) {
        continuation?.resume(false)
        return@OnActivityResult
      }

      val manager = activity.getSystemService(MediaProjectionManager::class.java)
      val projection = manager.getMediaProjection(payload.resultCode, data)
      // The foreground service must already be running before we touch the
      // projection (createVirtualDisplay), so start it first.
      ScreenCaptureService.start(activity.applicationContext)
      ScreenCaptureManager.attach(activity.applicationContext, projection)
      continuation?.resume(true)
    }
  }

  private fun performOnNode(nodeId: String, block: (AccessibilityNodeInfo) -> Boolean): Boolean {
    val service = AutomationAccessibilityService.instance ?: throw ServiceNotConnectedException()
    val node = service.findNodeById(nodeId) ?: throw NodeNotFoundException(nodeId)
    return try {
      block(node)
    } finally {
      @Suppress("DEPRECATION")
      node.recycle()
    }
  }

  private fun isAccessibilityServiceEnabled(): Boolean {
    val context = appContext.reactContext ?: return false
    val expectedService = "${context.packageName}/${AutomationAccessibilityService::class.java.name}"
    val enabledServices = Settings.Secure.getString(
      context.contentResolver,
      Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
    ) ?: return false
    return enabledServices.split(':').any { it.equals(expectedService, ignoreCase = true) }
  }
}
