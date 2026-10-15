package expo.modules.fittrackeralarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.widget.Toast

class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    val id = intent.getStringExtra(AlarmScheduler.EXTRA_ID) ?: return
    val title = intent.getStringExtra(AlarmScheduler.EXTRA_TITLE) ?: "Hora dos remédios"
    val body = intent.getStringExtra(AlarmScheduler.EXTRA_BODY) ?: ""
    val meds = intent.getIntArrayExtra(AlarmScheduler.EXTRA_MEDS) ?: IntArray(0)

    when (intent.action) {
      AlarmScheduler.ACTION_FIRE -> {
        if (intent.getStringExtra(AlarmScheduler.EXTRA_KIND) == Alarm.KIND_NOTIFY) {
          AlarmNotifier.showSimple(ctx, id, title, body)
        } else {
          AlarmNotifier.show(ctx, id, title, body, meds)
        }
        // Disparo único: agenda a próxima ocorrência.
        if (!id.startsWith("snooze:")) AlarmScheduler.rescheduleAll(ctx)
        WatchPush.send(ctx, goAsync(), title, body)
        if (intent.getStringExtra(AlarmScheduler.EXTRA_KIND) != Alarm.KIND_NOTIFY) {
          WatchPush.scheduleRepeat(ctx, id, title, body)
        }
      }
      WatchPush.ACTION_REPEAT -> {
        // Para sozinho quando o alarme some (Tomei, Adiar, dispensado ou os 10 min de timeout).
        if (AlarmNotifier.isActive(ctx, id)) {
          WatchPush.send(ctx, goAsync(), title, body)
          WatchPush.scheduleRepeat(ctx, id, title, body)
        }
      }
      AlarmNotifier.ACTION_TAKEN -> {
        AlarmNotifier.dismiss(ctx, id)
        val ok = IntakeWriter.record(ctx, meds)
        if (meds.isNotEmpty()) {
          Toast.makeText(ctx, if (ok) "Tomada registrada" else "Abra o app para registrar", Toast.LENGTH_SHORT).show()
        }
      }
      AlarmNotifier.ACTION_SNOOZE -> {
        AlarmNotifier.dismiss(ctx, id)
        AlarmScheduler.snooze(ctx, baseId(id), title, body, meds)
      }
      AlarmNotifier.ACTION_DISMISS -> AlarmNotifier.dismiss(ctx, id)
    }
  }

  companion object {
    /** Adiar de novo um alarme já adiado não deve virar "snooze:snooze:...". */
    fun baseId(id: String) = id.removePrefix("snooze:")
  }
}

class BootReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    AlarmScheduler.rescheduleAll(ctx)
  }
}
