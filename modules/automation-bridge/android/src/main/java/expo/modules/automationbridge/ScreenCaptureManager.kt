package expo.modules.automationbridge

import android.content.Context
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.Image
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.os.Handler
import android.os.Looper
import java.io.ByteArrayOutputStream
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine

/**
 * Owns the live MediaProjection/VirtualDisplay/ImageReader triple for one
 * capture session. A session starts once the user grants the system's
 * screen-capture prompt and ends when [release] is called (app backgrounded,
 * automation task finished, or the projection is revoked by the system).
 */
object ScreenCaptureManager {

  private var mediaProjection: MediaProjection? = null
  private var virtualDisplay: VirtualDisplay? = null
  private var imageReader: ImageReader? = null
  private val mainHandler = Handler(Looper.getMainLooper())

  private val projectionCallback = object : MediaProjection.Callback() {
    override fun onStop() {
      release()
    }
  }

  fun hasActiveSession(): Boolean = mediaProjection != null

  fun attach(context: Context, projection: MediaProjection) {
    release()
    mediaProjection = projection
    // Required since Android 12 (S): the OS throws if createVirtualDisplay is
    // called on a MediaProjection with no registered callback.
    projection.registerCallback(projectionCallback, mainHandler)

    val metrics = context.resources.displayMetrics
    val width = metrics.widthPixels
    val height = metrics.heightPixels
    val densityDpi = metrics.densityDpi

    val reader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
    imageReader = reader
    virtualDisplay = projection.createVirtualDisplay(
      "openclaw-automation-capture",
      width,
      height,
      densityDpi,
      DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
      reader.surface,
      null,
      mainHandler
    )
  }

  suspend fun captureBase64Png(): String {
    val reader = imageReader ?: throw IllegalStateException(
      "No active screen-capture session. Call requestScreenCapturePermission() first."
    )
    val bitmap = acquireBitmap(reader)
    val output = ByteArrayOutputStream()
    bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)
    bitmap.recycle()
    return android.util.Base64.encodeToString(output.toByteArray(), android.util.Base64.NO_WRAP)
  }

  private suspend fun acquireBitmap(reader: ImageReader): Bitmap {
    val image = reader.acquireLatestImage() ?: awaitNextImage(reader)
    return try {
      imageToBitmap(image)
    } finally {
      image.close()
    }
  }

  private suspend fun awaitNextImage(reader: ImageReader): Image =
    suspendCancellableCoroutine { continuation ->
      reader.setOnImageAvailableListener(
        { r ->
          val img = r.acquireLatestImage()
          if (img != null && continuation.isActive) {
            r.setOnImageAvailableListener(null, null)
            continuation.resume(img)
          }
        },
        mainHandler
      )
    }

  private fun imageToBitmap(image: Image): Bitmap {
    val plane = image.planes[0]
    val buffer = plane.buffer
    val pixelStride = plane.pixelStride
    val rowStride = plane.rowStride
    val rowPadding = rowStride - pixelStride * image.width

    val bitmap = Bitmap.createBitmap(
      image.width + rowPadding / pixelStride,
      image.height,
      Bitmap.Config.ARGB_8888
    )
    bitmap.copyPixelsFromBuffer(buffer)
    return if (rowPadding == 0) {
      bitmap
    } else {
      Bitmap.createBitmap(bitmap, 0, 0, image.width, image.height)
    }
  }

  fun release() {
    virtualDisplay?.release()
    virtualDisplay = null
    imageReader?.close()
    imageReader = null
    mediaProjection?.unregisterCallback(projectionCallback)
    mediaProjection?.stop()
    mediaProjection = null
  }
}
