package expo.modules.fittrackeralarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import java.util.Calendar

object AlarmScheduler {
  const val ACTION_FIRE = "expo.modules.fittrackeralarm.FIRE"
  const val EXTRA_ID = "id"
  const val EXTRA_TITLE = "title"
  const val EXTRA_BODY = "body"
  const val EXTRA_MEDS = "medicationIds"
  const val SNOOZE_MINUTES = 10

  private fun am(ctx: Context) = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  fun canScheduleExact(ctx: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am(ctx).canScheduleExactAlarms()

  /** Substitui todos os alarmes: cancela os antigos e agenda a próxima ocorrência de cada novo. */
  fun replaceAll(ctx: Context, alarms: List<Alarm>) {
    AlarmStore.load(ctx).forEach { cancel(ctx, it.id) }
    AlarmStore.save(ctx, alarms)
    rescheduleAll(ctx)
  }

  fun rescheduleAll(ctx: Context) {
    AlarmStore.load(ctx).forEach { a ->
      schedule(ctx, a.id, nextTrigger(a.hour, a.minute, a.weekday), a.title, a.body, a.medicationIds)
    }
  }

  fun snooze(ctx: Context, id: String, title: String, body: String, meds: IntArray) {
    val at = System.currentTimeMillis() + SNOOZE_MINUTES * 60_000L
    schedule(ctx, "snooze:$id", at, title, body, meds)
  }

  /** Teste: sem remédios, o "Tomei" não registra nada. */
  fun scheduleTest(ctx: Context, at: Long) {
    schedule(ctx, "test", at, "Teste de alarme", "Se você ouviu e viu isto, está funcionando", IntArray(0))
  }

  /** Próxima ocorrência; weekday 0 = diária, 1..7 = só naquele dia da semana. */
  private fun nextTrigger(hour: Int, minute: Int, weekday: Int): Long {
    val now = System.currentTimeMillis()
    val c = Calendar.getInstance()
    c.set(Calendar.HOUR_OF_DAY, hour)
    c.set(Calendar.MINUTE, minute)
    c.set(Calendar.SECOND, 0)
    c.set(Calendar.MILLISECOND, 0)
    var guard = 0
    while ((c.timeInMillis <= now || (weekday in 1..7 && c.get(Calendar.DAY_OF_WEEK) != weekday)) && guard++ < 8) {
      c.add(Calendar.DAY_OF_YEAR, 1)
    }
    return c.timeInMillis
  }

  private fun firePendingIntent(
    ctx: Context, id: String, title: String, body: String, meds: IntArray,
  ): PendingIntent {
    val intent = Intent(ctx, AlarmReceiver::class.java).apply {
      action = ACTION_FIRE
      putExtra(EXTRA_ID, id)
      putExtra(EXTRA_TITLE, title)
      putExtra(EXTRA_BODY, body)
      putExtra(EXTRA_MEDS, meds)
    }
    return PendingIntent.getBroadcast(
      ctx, id.hashCode(), intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun schedule(
    ctx: Context, id: String, at: Long, title: String, body: String, meds: IntArray,
  ) {
    val pi = firePendingIntent(ctx, id, title, body, meds)
    if (canScheduleExact(ctx)) {
      // setAlarmClock: exato, fura o Doze e mostra o ícone de despertador na barra.
      val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)
      val show = PendingIntent.getActivity(
        ctx, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
      am(ctx).setAlarmClock(AlarmManager.AlarmClockInfo(at, show), pi)
    } else {
      // Sem permissão de exato: ainda dispara, só que com alguns minutos de folga.
      am(ctx).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
    }
  }

  fun cancel(ctx: Context, id: String) {
    val intent = Intent(ctx, AlarmReceiver::class.java).apply { action = ACTION_FIRE }
    val pi = PendingIntent.getBroadcast(
      ctx, id.hashCode(), intent,
      PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
    )
    if (pi != null) {
      am(ctx).cancel(pi)
      pi.cancel()
    }
  }
}
