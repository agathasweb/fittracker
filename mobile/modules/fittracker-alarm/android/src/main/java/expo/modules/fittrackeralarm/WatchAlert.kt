package expo.modules.fittrackeralarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.net.Uri
import android.os.Build
import java.util.Calendar

/**
 * Aviso de relógio desconectado: sem contato há mais de 6 h, só das 08:00 às 20:00
 * (à noite o relógio pode estar carregando/fora do pulso). Checado pelo BpSyncWorker
 * a cada falha; repete no máximo a cada 3 h e some quando uma sync dá certo.
 */
object WatchAlert {
  private const val PREFS = "fittracker_watch"
  private const val CHANNEL = "watch_disconnected"
  private const val NOTIF_ID = 0x5A7C
  private const val LIMIT_MS = 6 * 3600_000L
  private const val REPEAT_MS = 3 * 3600_000L
  private const val START_HOUR = 8
  private const val END_HOUR = 20

  private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
  private fun nm(ctx: Context) = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  /** Chamado após uma falha de sync. */
  fun check(ctx: Context, now: Long = System.currentTimeMillis()) {
    if (BpStore.address(ctx) == null) return
    val p = prefs(ctx)
    // Referência: último contato; se nunca houve, desde quando passamos a vigiar.
    var ref = maxOf(BpStore.lastSync(ctx), p.getLong("watchSince", 0L))
    if (ref == 0L) {
      p.edit().putLong("watchSince", now).apply()
      ref = now
    }
    if (now - ref <= LIMIT_MS) return
    val hour = Calendar.getInstance().apply { timeInMillis = now }.get(Calendar.HOUR_OF_DAY)
    if (hour < START_HOUR || hour >= END_HOUR) return
    if (now - p.getLong("lastAlert", 0L) < REPEAT_MS) return
    p.edit().putLong("lastAlert", now).apply()
    show(ctx, (now - ref) / 3600_000L)
  }

  /** Chamado após uma sync bem-sucedida. */
  fun clear(ctx: Context) {
    prefs(ctx).edit().remove("lastAlert").apply()
    nm(ctx).cancel(NOTIF_ID)
  }

  private fun show(ctx: Context, hours: Long) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm(ctx).getNotificationChannel(CHANNEL) == null) {
      nm(ctx).createNotificationChannel(
        NotificationChannel(CHANNEL, "Relógio desconectado", NotificationManager.IMPORTANCE_HIGH).apply {
          description = "Avisa quando o relógio fica mais de 6 h sem sincronizar (08h–20h)"
        },
      )
    }
    val open = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)?.apply {
      data = Uri.parse("fittracker://blood-pressure")
    }
    val pi = open?.let {
      PendingIntent.getActivity(ctx, NOTIF_ID, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
    val body = "Sem contato há ${hours} h — a pressão não está sendo registrada. " +
      "Confira se o relógio está no pulso, com bateria e o Bluetooth ligado."
    @Suppress("DEPRECATION")
    val b = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(ctx, CHANNEL)
    } else {
      Notification.Builder(ctx).setPriority(Notification.PRIORITY_HIGH)
    }
    b.setSmallIcon(ctx.applicationInfo.icon)
      .setContentTitle("⌚ Relógio desconectado")
      .setContentText(body)
      .setStyle(Notification.BigTextStyle().bigText(body))
      .setAutoCancel(true)
    pi?.let { b.setContentIntent(it) }
    nm(ctx).notify(NOTIF_ID, b.build())
  }
}
