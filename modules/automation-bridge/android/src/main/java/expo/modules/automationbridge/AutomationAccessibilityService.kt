package expo.modules.automationbridge

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

class AutomationAccessibilityService : AccessibilityService() {

  companion object {
    var instance: AutomationAccessibilityService? = null
      private set
  }

  override fun onServiceConnected() {
    super.onServiceConnected()
    instance = this
    serviceInfo = AccessibilityServiceInfo().apply {
      eventTypes = AccessibilityEvent.TYPES_ALL_MASK
      feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
      flags = AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS or
        AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
      notificationTimeout = 100
    }
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    // No-op for Phase 1. A later phase can emit a JS event here (e.g. window
    // changed) so the agent loop knows the foreground app switched.
  }

  override fun onInterrupt() {}

  override fun onDestroy() {
    super.onDestroy()
    if (instance == this) {
      instance = null
    }
  }

  fun currentRootNode(): AccessibilityNodeInfo? = rootInActiveWindow

  fun findNodeById(nodeId: String): AccessibilityNodeInfo? {
    val root = rootInActiveWindow ?: return null
    return UiTreeSerializer.findNodeByPath(root, nodeId)
  }
}
