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

  /** INSERT OR IGNORE (índice único por usuário+horário+origem). Devolve quantas eram novas. */
  fun save(ctx: Context, userId: Int, readings: List<BpReading>): Int {
    if (readings.isEmpty() || userId <= 0) return 0
    val file = File(ctx.filesDir, "SQLite" + File.separator + "fittracker.db")
    if (!file.exists()) return 0
    val db = SQLiteDatabase.openDatabase(
      file.path, null,
      SQLiteDatabase.OPEN_READWRITE or SQLiteDatabase.ENABLE_WRITE_AHEAD_LOGGING,
    )
    var added = 0
    try {
      db.beginTransaction()
      try {
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
        db.setTransactionSuccessful()
      } finally {
        db.endTransaction()
      }
    } finally {
      db.close()
    }
    return added
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
    val readings = WatchSync.sync(ctx, address, since)
    val added = save(ctx, userId, readings)
    setLastSync(ctx, now)
    return added
  }
}
