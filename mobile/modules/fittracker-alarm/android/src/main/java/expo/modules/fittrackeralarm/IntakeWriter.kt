package expo.modules.fittrackeralarm

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.util.Log
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Registra a tomada direto no banco do app (mesmo arquivo do expo-sqlite), pra o "Tomei"
 * funcionar com o celular bloqueado e o app fechado. Horário local, igual ao nowISO() do JS.
 */
object IntakeWriter {
  private const val DB = "fittracker.db"

  fun record(ctx: Context, medicationIds: IntArray): Boolean {
    val file = File(ctx.filesDir, "SQLite" + File.separator + DB)
    val ids = medicationIds.filter { it > 0 }
    if (!file.exists() || ids.isEmpty()) return false
    return try {
      val db = SQLiteDatabase.openDatabase(
        file.path, null,
        SQLiteDatabase.OPEN_READWRITE or SQLiteDatabase.ENABLE_WRITE_AHEAD_LOGGING,
      )
      try {
        val now = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date())
        db.beginTransaction()
        try {
          for (id in ids) {
            db.execSQL(
              "INSERT INTO medication_intakes (medication_id, taken_at) VALUES (?, ?)",
              arrayOf<Any>(id, now),
            )
          }
          db.setTransactionSuccessful()
        } finally {
          db.endTransaction()
        }
      } finally {
        db.close()
      }
      true
    } catch (e: Exception) {
      Log.w("FittrackerAlarm", "Falha ao registrar tomada", e)
      false
    }
  }
}
