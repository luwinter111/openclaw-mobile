package expo.modules.automationbridge

import android.graphics.Rect
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONArray
import org.json.JSONObject

/**
 * Converts the live AccessibilityNodeInfo tree into a plain JSON tree the JS
 * side can reason about, and back-resolves a node from the synthetic path id
 * ("0.2.1" == root -> child 2 -> child 1) produced by that conversion.
 */
object UiTreeSerializer {

  // Guards against pathological trees (e.g. a RecyclerView with thousands of
  // offscreen rows) blowing up serialization time/size.
  private const val MAX_DEPTH = 60
  private const val MAX_CHILDREN_PER_NODE = 200

  fun serialize(root: AccessibilityNodeInfo): JSONObject = nodeToJson(root, "0", 0)

  private fun nodeToJson(node: AccessibilityNodeInfo, path: String, depth: Int): JSONObject {
    val json = JSONObject()
    json.put("id", path)
    json.put("text", node.text?.toString())
    json.put("contentDescription", node.contentDescription?.toString())
    json.put("className", node.className?.toString())
    json.put("viewId", node.viewIdResourceName)
    json.put("clickable", node.isClickable)
    json.put("editable", node.isEditable)

    val bounds = Rect()
    node.getBoundsInScreen(bounds)
    json.put(
      "bounds",
      JSONObject().apply {
        put("left", bounds.left)
        put("top", bounds.top)
        put("right", bounds.right)
        put("bottom", bounds.bottom)
      }
    )

    val children = JSONArray()
    if (depth < MAX_DEPTH) {
      val childCount = minOf(node.childCount, MAX_CHILDREN_PER_NODE)
      for (i in 0 until childCount) {
        val child = node.getChild(i) ?: continue
        children.put(nodeToJson(child, "$path.$i", depth + 1))
        @Suppress("DEPRECATION")
        child.recycle()
      }
    }
    json.put("children", children)
    return json
  }

  fun findNodeByPath(root: AccessibilityNodeInfo, path: String): AccessibilityNodeInfo? {
    if (path == "0") return root
    val segments = path.split(".")
    if (segments.firstOrNull() != "0") return null

    var current = root
    for (segment in segments.drop(1)) {
      val index = segment.toIntOrNull() ?: return null
      current = current.getChild(index) ?: return null
    }
    return current
  }
}
