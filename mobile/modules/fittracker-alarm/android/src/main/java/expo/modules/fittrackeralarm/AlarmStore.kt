package expo.modules.fittrackeralarm

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Um alarme de remédios/suplementos, persistido pra sobreviver a reboot. Agrupa tudo que
 * vence no mesmo horário (um alarme só, "Tomei todos"). weekday: 0 = todo dia;
 * 1..7 = Calendar.SUNDAY..SATURDAY (semanal).
 */
data class Alarm(
  val id: String,
  val hour: Int,
  val minute: Int,
  val weekday: Int,
  val title: String,
  val body: String,
  val medicationIds: IntArray,
) {
  fun toJson(): JSONObject = JSONObject()
    .put("id", id)
    .put("hour", hour)
    .put("minute", minute)
    .put("weekday", weekday)
    .put("title", title)
    .put("body", body)
    .put("medicationIds", JSONArray(medicationIds.toList()))

  companion object {
    fun fromJson(o: JSONObject): Alarm {
      val ids = o.optJSONArray("medicationIds")
      return Alarm(
        id = o.getString("id"),
        hour = o.getInt("hour"),
        minute = o.getInt("minute"),
        weekday = o.optInt("weekday", 0),
        title = o.optString("title", "Hora dos remédios"),
        body = o.optString("body", ""),
        medicationIds = if (ids != null) IntArray(ids.length()) { ids.getInt(it) } else IntArray(0),
      )
    }
  }
}

object AlarmStore {
  private const val PREFS = "fittracker_alarms"
  private const val KEY = "alarms"

  fun load(ctx: Context): List<Alarm> {
    val raw = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)
      ?: return emptyList()
    return try {
      val arr = JSONArray(raw)
      (0 until arr.length()).map { Alarm.fromJson(arr.getJSONObject(it)) }
    } catch (e: Exception) {
      emptyList()
    }
  }

  fun save(ctx: Context, alarms: List<Alarm>) {
    val arr = JSONArray()
    alarms.forEach { arr.put(it.toJson()) }
    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, arr.toString()).apply()
  }
}
