package expo.modules.automationbridge

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * Since Android 10, capturing frames from a MediaProjection requires an
 * active foreground service for the whole capture session (Android 14 also
 * requires the service to declare `foregroundServiceType="mediaProjection"`
 * and to be started *before* `createVirtualDisplay` is called). This service
 * only exists to satisfy that requirement; the actual capture logic lives in
 * [ScreenCaptureManager]. The persistent notification it shows is mandatory
 * OS behavior (the "screen is being captured/shared" indicator) and can't be
 * hidden — don't try to work around it.
 */
class ScreenCaptureService : Service() {

  companion object {
    private const val CHANNEL_ID = "automation_screen_capture"
    private const val NOTIFICATION_ID = 8426

    fun start(context: Context) {
      val intent = Intent(context, ScreenCaptureService::class.java)
      context.startForegroundService(intent)
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, ScreenCaptureService::class.java))
    }
  }

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
    val notification = buildNotification()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  override fun onDestroy() {
    ScreenCaptureManager.release()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(NotificationManager::class.java)
    val channel = NotificationChannel(
      CHANNEL_ID,
      "手机自动化 - 屏幕捕获",
      NotificationManager.IMPORTANCE_LOW
    )
    manager.createNotificationChannel(channel)
  }

  private fun buildNotification(): Notification {
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }
    return builder
      .setContentTitle("OpenClaw 小助理正在读取屏幕")
      .setContentText("用于完成你交代的手机自动化任务")
      .setSmallIcon(android.R.drawable.ic_menu_view)
      .setOngoing(true)
      .build()
  }
}
