package expo.modules.fittrackeralarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build

object AlarmNotifier {
  // Canal novo (não o "medications" antigo): som/importância de canal são imutáveis depois de criados.
  private const val CHANNEL = "supplement_alarm"
  const val ACTION_TAKEN = "expo.modules.fittrackeralarm.TAKEN"
  const val ACTION_SNOOZE = "expo.modules.fittrackeralarm.SNOOZE"
  const val ACTION_DISMISS = "expo.modules.fittrackeralarm.DISMISS"
  private const val TIMEOUT_MS = 10 * 60_000L

  private fun nm(ctx: Context) =
    ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  fun notificationId(id: String) = id.hashCode()

  fun canUseFullScreen(ctx: Context): Boolean =
    Build.VERSION.SDK_INT < 34 || nm(ctx).canUseFullScreenIntent()

  private fun ensureChannel(ctx: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    if (nm(ctx).getNotificationChannel(CHANNEL) != null) return
    val sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
      ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
    val ch = NotificationChannel(CHANNEL, "Alarme de suplementos", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "Toca como despertador até você marcar que tomou"
      // USAGE_ALARM: sai no volume de alarme, mesmo com o celular no silencioso.
      setSound(
        sound,
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build(),
      )
      enableVibration(true)
      vibrationPattern = longArrayOf(0, 800, 400, 800, 400, 800)
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      setBypassDnd(true)
    }
    nm(ctx).createNotificationChannel(ch)
  }

  fun actionIntent(ctx: Context, action: String, id: String, title: String, body: String, meds: IntArray): PendingIntent {
    val i = Intent(ctx, AlarmReceiver::class.java).apply {
      this.action = action
      putExtra(AlarmScheduler.EXTRA_ID, id)
      putExtra(AlarmScheduler.EXTRA_TITLE, title)
      putExtra(AlarmScheduler.EXTRA_BODY, body)
      putExtra(AlarmScheduler.EXTRA_MEDS, meds)
    }
    return PendingIntent.getBroadcast(
      ctx, (action + id).hashCode(), i,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  fun show(ctx: Context, id: String, title: String, body: String, meds: IntArray) {
    ensureChannel(ctx)
    val screen = Intent(ctx, AlarmActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION
      putExtra(AlarmScheduler.EXTRA_ID, id)
      putExtra(AlarmScheduler.EXTRA_TITLE, title)
      putExtra(AlarmScheduler.EXTRA_BODY, body)
      putExtra(AlarmScheduler.EXTRA_MEDS, meds)
    }
    val screenPi = PendingIntent.getActivity(
      ctx, id.hashCode(), screen,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    @Suppress("DEPRECATION")
    val b = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(ctx, CHANNEL)
    } else {
      Notification.Builder(ctx).setPriority(Notification.PRIORITY_MAX)
    }
    b.setSmallIcon(ctx.applicationInfo.icon)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(Notification.BigTextStyle().bigText(body))
      .setCategory(Notification.CATEGORY_ALARM)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setAutoCancel(false)
      .setContentIntent(screenPi)
      .setFullScreenIntent(screenPi, true)
      .addAction(Notification.Action.Builder(null, if (meds.size > 1) "Tomei todos" else "Tomei", actionIntent(ctx, ACTION_TAKEN, id, title, body, meds)).build())
      .addAction(Notification.Action.Builder(null, "Adiar ${AlarmScheduler.SNOOZE_MINUTES} min", actionIntent(ctx, ACTION_SNOOZE, id, title, body, meds)).build())
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) b.setTimeoutAfter(TIMEOUT_MS)

    val n = b.build()
    // FLAG_INSISTENT: repete o som em loop até a notificação ser respondida/cancelada.
    n.flags = n.flags or Notification.FLAG_INSISTENT
    nm(ctx).notify(notificationId(id), n)
  }

  private const val CHANNEL_SIMPLE = "reminder_simple"

  /** Notificação comum (som padrão, sem tela cheia) — lembretes como o de água. */
  fun showSimple(ctx: Context, id: String, title: String, body: String) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm(ctx).getNotificationChannel(CHANNEL_SIMPLE) == null) {
      nm(ctx).createNotificationChannel(
        NotificationChannel(CHANNEL_SIMPLE, "Lembretes", NotificationManager.IMPORTANCE_HIGH).apply {
          description = "Lembretes do dia a dia, como beber água"
        },
      )
    }
    val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)
    val pi = launch?.let {
      PendingIntent.getActivity(ctx, id.hashCode(), it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
    @Suppress("DEPRECATION")
    val b = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(ctx, CHANNEL_SIMPLE)
    } else {
      Notification.Builder(ctx).setPriority(Notification.PRIORITY_HIGH)
    }
    b.setSmallIcon(ctx.applicationInfo.icon)
      .setContentTitle(title)
      .setContentText(body)
      .setAutoCancel(true)
    pi?.let { b.setContentIntent(it) }
    nm(ctx).notify(notificationId(id), b.build())
  }

  fun isActive(ctx: Context, id: String): Boolean =
    nm(ctx).activeNotifications.any { it.id == notificationId(id) }

  fun dismiss(ctx: Context, id: String) {
    nm(ctx).cancel(notificationId(id))
  }
}
