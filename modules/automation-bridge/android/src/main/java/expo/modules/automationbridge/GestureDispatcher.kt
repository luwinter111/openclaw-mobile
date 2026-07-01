package expo.modules.automationbridge

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.os.Handler
import android.os.Looper
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine

/**
 * Coordinate-based input for when the accessibility tree can't be used (the
 * vision-fallback path): taps/swipes dispatched as real gestures rather than
 * `performAction` on a specific node, since a screenshot only gives the model
 * pixel coordinates.
 */
object GestureDispatcher {

  private const val TAP_DURATION_MS = 60L
  private const val DEFAULT_SWIPE_DURATION_MS = 300L

  suspend fun tap(service: AccessibilityService, x: Float, y: Float): Boolean {
    val path = Path().apply { moveTo(x, y) }
    return dispatch(service, path, TAP_DURATION_MS)
  }

  suspend fun swipe(
    service: AccessibilityService,
    x1: Float,
    y1: Float,
    x2: Float,
    y2: Float,
    durationMs: Long = DEFAULT_SWIPE_DURATION_MS
  ): Boolean {
    val path = Path().apply {
      moveTo(x1, y1)
      lineTo(x2, y2)
    }
    return dispatch(service, path, durationMs)
  }

  private suspend fun dispatch(service: AccessibilityService, path: Path, durationMs: Long): Boolean =
    suspendCancellableCoroutine { continuation ->
      val stroke = GestureDescription.StrokeDescription(path, 0, durationMs)
      val gesture = GestureDescription.Builder().addStroke(stroke).build()
      val mainHandler = Handler(Looper.getMainLooper())

      val callback = object : AccessibilityService.GestureResultCallback() {
        override fun onCompleted(gestureDescription: GestureDescription?) {
          if (continuation.isActive) continuation.resume(true)
        }

        override fun onCancelled(gestureDescription: GestureDescription?) {
          if (continuation.isActive) continuation.resume(false)
        }
      }

      val dispatched = service.dispatchGesture(gesture, callback, mainHandler)
      if (!dispatched && continuation.isActive) {
        continuation.resume(false)
      }
    }
}
