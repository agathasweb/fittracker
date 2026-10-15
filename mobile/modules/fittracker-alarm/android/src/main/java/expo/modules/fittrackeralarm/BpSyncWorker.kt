package expo.modules.fittrackeralarm

import android.content.Context
import android.util.Log
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/** Sync de hora em hora com o relógio, mesmo com o app fechado. */
class BpSyncWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {
  override fun doWork(): Result = try {
    val added = BpStore.syncAndSave(applicationContext)
    Log.i("FittrackerWatch", "worker: $added novas leituras")
    Result.success()
  } catch (e: Exception) {
    // Relógio longe/desligado: tenta de novo no próximo ciclo; não é falha do app.
    Log.w("FittrackerWatch", "worker falhou: ${e.message}")
    Result.success()
  }

  companion object {
    private const val NAME = "fittracker-bp-sync"

    fun enable(ctx: Context) {
      val req = PeriodicWorkRequestBuilder<BpSyncWorker>(1, TimeUnit.HOURS).build()
      WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(NAME, ExistingPeriodicWorkPolicy.UPDATE, req)
    }

    fun disable(ctx: Context) {
      WorkManager.getInstance(ctx).cancelUniqueWork(NAME)
    }
  }
}
