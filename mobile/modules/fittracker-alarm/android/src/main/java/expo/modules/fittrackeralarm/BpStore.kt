package expo.modules.fittrackeralarm

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import java.io.File

/** Config do relógio (definida pelo JS) + gravação das leituras no banco do app. */
object BpStore {
  private const val PREFS = "fittracker_watch"

  fun configure(ctx: Context, address: String?, userId: Int) {
    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putString("address", address)
      .putInt("userId", userId)
      .putLong("watchSince", System.currentTimeMillis())
      .remove("lastAlert")
      .apply()
  }

  fun address(ctx: Context): String? =
    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("address", null)

  fun userId(ctx: Context): Int =
    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getInt("userId", 0)

  fun setLastSync(ctx: Context, millis: Long) {
    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putLong("lastSync", millis).apply()
  }

  fun lastSync(ctx: Context): Long =
    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong("lastSync", 0L)

  private fun <T> withDb(ctx: Context, block: (SQLiteDatabase) -> T): T? {
    val file = File(ctx.filesDir, "SQLite" + File.separator + "fittracker.db")
    if (!file.exists()) return null
    val db = SQLiteDatabase.openDatabase(
      file.path, null,
      SQLiteDatabase.OPEN_READWRITE or SQLiteDatabase.ENABLE_WRITE_AHEAD_LOGGING,
    )
    try {
      db.beginTransaction()
      try {
        val r = block(db)
        db.setTransactionSuccessful()
        return r
      } finally {
        db.endTransaction()
      }
    } finally {
      db.close()
    }
  }

  /** INSERT OR IGNORE (índice único por usuário+horário+origem). Devolve quantas eram novas. */
  fun save(ctx: Context, userId: Int, readings: List<BpReading>): Int {
    if (readings.isEmpty() || userId <= 0) return 0
    return withDb(ctx) { db ->
      var added = 0
      val st = db.compileStatement(
        "INSERT OR IGNORE INTO blood_pressure_readings " +
          "(user_id, measured_at, systolic, diastolic, heart_rate, source) VALUES (?, ?, ?, ?, ?, 'watch')",
      )
      for (r in readings) {
        st.clearBindings()
        st.bindLong(1, userId.toLong())
        st.bindString(2, r.measuredAt)
        st.bindLong(3, r.systolic.toLong())
        st.bindLong(4, r.diastolic.toLong())
        if (r.heartRate != null) st.bindLong(5, r.heartRate.toLong()) else st.bindNull(5)
        if (st.executeInsert() != -1L) added++
      }
      added
    } ?: 0
  }

  /** Passos/FC/SpO2 por hora (tabela watch_hourly, migration 13). A última leitura da hora vence. */
  fun saveHours(ctx: Context, userId: Int, hours: List<WatchHour>) {
    if (hours.isEmpty() || userId <= 0) return
    try {
      withDb(ctx) { db ->
        val st = db.compileStatement(
          "INSERT OR REPLACE INTO watch_hourly (user_id, hour_at, steps, kcal, heart_rate, spo2) VALUES (?, ?, ?, ?, ?, ?)",
        )
        for (h in hours) {
          st.clearBindings()
          st.bindLong(1, userId.toLong())
          st.bindString(2, h.hourAt)
          st.bindLong(3, h.steps.toLong())
          st.bindLong(4, h.kcal.toLong())
          if (h.heartRate != null) st.bindLong(5, h.heartRate.toLong()) else st.bindNull(5)
          if (h.spo2 != null) st.bindLong(6, h.spo2.toLong()) else st.bindNull(6)
          st.executeInsert()
        }
      }
    } catch (e: Exception) {
      // Banco ainda sem a migration 13 (app não abriu depois da atualização): fica pra próxima.
      android.util.Log.w("FittrackerWatch", "watch_hourly: ${e.message}")
    }
  }

  /** Mede agora e grava. Devolve a leitura (ou null). */
  fun measureAndSave(ctx: Context): BpReading? {
    val address = address(ctx) ?: throw IllegalStateException("Relógio não configurado")
    val r = WatchSync.measureNow(ctx, address) ?: return null
    save(ctx, userId(ctx), listOf(r))
    setLastSync(ctx, System.currentTimeMillis())
    WatchAlert.clear(ctx)
    return r
  }

  /**
   * Sincroniza e grava. Pede desde a última sync menos 1 dia (folga pra horas que o relógio
   * ainda não tinha fechado); o índice único descarta repetidas.
   */
  fun syncAndSave(ctx: Context): Int {
    val address = address(ctx) ?: return 0
    val userId = userId(ctx)
    val now = System.currentTimeMillis()
    val last = lastSync(ctx)
    val since = if (last > 0) last - 24 * 3600_000L else now - 7 * 24 * 3600_000L
    val result = WatchSync.sync(ctx, address, since)
    val added = save(ctx, userId, result.readings)
    saveHours(ctx, userId, result.hours)
    setLastSync(ctx, now)
    WatchAlert.clear(ctx)
    return added
  }
}
