package expo.modules.automationbridge

import android.accessibilityservice.AccessibilityService as SystemAccessibilityService
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.accessibility.AccessibilityNodeInfo
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private class ServiceNotConnectedException :
  CodedException("Accessibility service is not running. Ask the user to enable it in system settings first.")

private class NodeNotFoundException(nodeId: String) :
  CodedException("No accessibility node found for id '$nodeId'. The screen may have changed since it was read.")

private class InvalidGlobalActionException(action: String) :
  CodedException("Unknown global action '$action'. Expected one of: back, home, recents.")

class AutomationBridgeModule : Module() {

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
