package expo.modules.fittrackeralarm

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray

class FittrackerAlarmModule : Module() {
  private val ctx
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("FittrackerAlarm")

    /** JSON: [{id, hour, minute, weekday, title, body, medicationIds, kind?}] — substitui todos os alarmes. */
    Function("replaceAll") { json: String ->
      val arr = JSONArray(json)
      val alarms = (0 until arr.length()).map { Alarm.fromJson(arr.getJSONObject(it)) }
      AlarmScheduler.replaceAll(ctx, alarms)
    }

    Function("canScheduleExact") { AlarmScheduler.canScheduleExact(ctx) }

    Function("canUseFullScreen") { AlarmNotifier.canUseFullScreen(ctx) }

    Function("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        openSettings(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
      }
    }

    Function("openFullScreenSettings") {
      if (Build.VERSION.SDK_INT >= 34) {
        openSettings(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT)
      }
    }

    // ── Pressão arterial do relógio (BLE) ──

    Function("watchConnectedDevices") {
      WatchSync.connectedDevices(ctx).map { mapOf("name" to it.first, "address" to it.second) }
    }

    /** address=null desliga a sync horária. */
    Function("watchConfigure") { address: String?, userId: Int ->
      BpStore.configure(ctx, address, userId)
      if (address != null) BpSyncWorker.enable(ctx) else BpSyncWorker.disable(ctx)
    }

    AsyncFunction("watchSyncNow") {
      // AsyncFunction roda fora da main thread; sync é bloqueante.
      BpStore.syncAndSave(ctx)
    }

    Function("watchLastSync") { BpStore.lastSync(ctx).toDouble() }

    /** Mede a pressão agora (~1 min). Devolve {systolic, diastolic} ou null. */
    AsyncFunction("watchMeasureNow") {
      BpStore.measureAndSave(ctx)?.let { mapOf("systolic" to it.systolic, "diastolic" to it.diastolic) }
    }

    /** Manda uma mensagem de teste pro relógio. */
    AsyncFunction("watchTestMessage") { appId: Int?, type: Int?, body: String? ->
      val address = BpStore.address(ctx) ?: throw IllegalStateException("Relógio não configurado")
      WatchSync.pushMessage(
        ctx, address, "FitTracker", body ?: "Teste: as notificações do app chegam aqui.",
        appId ?: WatchMessage.APP_ID, type ?: WatchMessage.TYPE,
      )
    }

    /** Dispara um alarme de teste em `seconds` segundos (botão "Testar alarme"). */
    Function("test") { seconds: Int ->
      val at = System.currentTimeMillis() + seconds * 1000L
      AlarmScheduler.scheduleTest(ctx, at)
    }
  }

  private fun openSettings(action: String) {
    val i = Intent(action, Uri.parse("package:" + ctx.packageName)).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK
    }
    ctx.startActivity(i)
  }
}
