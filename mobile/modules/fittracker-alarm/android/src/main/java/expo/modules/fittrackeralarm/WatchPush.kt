package expo.modules.fittrackeralarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/** Repete no relógio as notificações do FitTracker (lembretes/alarmes), se houver relógio configurado. */
object WatchPush {
  const val ACTION_REPEAT = "expo.modules.fittrackeralarm.WATCH_REPEAT"
  /** O relógio só vibra uma vez por mensagem: enquanto o alarme toca no celular, reenvia a cada minuto. */
  private const val REPEAT_MS = 60_000L

  /** Chamado de um BroadcastReceiver: a conexão BLE leva alguns segundos, então roda fora com goAsync. */
  fun send(ctx: Context, pending: BroadcastReceiver.PendingResult?, title: String, body: String) {
    val address = BpStore.address(ctx)
    if (address == null) {
      pending?.finish()
      return
    }
    Thread {
      try {
        WatchSync.pushMessage(ctx.applicationContext, address, title, body)
        Log.i("FittrackerWatch", "mensagem enviada ao relógio")
      } catch (e: Exception) {
        Log.w("FittrackerWatch", "mensagem no relógio falhou: ${e.message}")
      } finally {
        pending?.finish()
      }
    }.start()
  }

  /** Agenda o próximo reenvio; o AlarmReceiver só reenvia se o alarme ainda estiver tocando. */
  fun scheduleRepeat(ctx: Context, id: String, title: String, body: String) {
    if (BpStore.address(ctx) == null) return
    val i = Intent(ctx, AlarmReceiver::class.java).apply {
      action = ACTION_REPEAT
      putExtra(AlarmScheduler.EXTRA_ID, id)
      putExtra(AlarmScheduler.EXTRA_TITLE, title)
      putExtra(AlarmScheduler.EXTRA_BODY, body)
    }
    val pi = PendingIntent.getBroadcast(
      ctx, (ACTION_REPEAT + id).hashCode(), i,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val at = System.currentTimeMillis() + REPEAT_MS
    if (AlarmScheduler.canScheduleExact(ctx)) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
    else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
  }
}
