package expo.modules.fittrackeralarm

import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Tela de despertador mostrada sobre a tela de bloqueio. O som vem da notificação
 * (FLAG_INSISTENT); qualquer botão cancela a notificação e, com ela, o som.
 */
class AlarmActivity : Activity() {
  private val bg = Color.parseColor("#0F172A")
  private val lime = Color.parseColor("#A3E635")
  private val muted = Color.parseColor("#94A3B8")

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
      )
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    render()
  }

  override fun onNewIntent(intent: android.content.Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    render()
  }

  private fun render() {
    val id = intent.getStringExtra(AlarmScheduler.EXTRA_ID) ?: run { finish(); return }
    val title = intent.getStringExtra(AlarmScheduler.EXTRA_TITLE) ?: "Hora dos remédios"
    val body = intent.getStringExtra(AlarmScheduler.EXTRA_BODY) ?: ""
    val meds = intent.getIntArrayExtra(AlarmScheduler.EXTRA_MEDS) ?: IntArray(0)
    val dp = resources.displayMetrics.density

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(bg)
      setPadding((32 * dp).toInt(), (48 * dp).toInt(), (32 * dp).toInt(), (48 * dp).toInt())
    }
    fun text(s: String, size: Float, color: Int, bold: Boolean = false) = TextView(this).apply {
      text = s
      textSize = size
      setTextColor(color)
      gravity = Gravity.CENTER
      if (bold) typeface = Typeface.DEFAULT_BOLD
      setPadding(0, (6 * dp).toInt(), 0, (6 * dp).toInt())
    }
    fun button(label: String, fill: Int, fg: Int, onClick: () -> Unit) = Button(this).apply {
      text = label
      textSize = 18f
      isAllCaps = false
      setTextColor(fg)
      background = GradientDrawable().apply {
        setColor(fill)
        cornerRadius = 16 * dp
      }
      layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, (60 * dp).toInt()).apply {
        topMargin = (14 * dp).toInt()
      }
      setOnClickListener { onClick() }
    }

    root.addView(text(SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date()), 64f, Color.WHITE, true))
    root.addView(text(title, 22f, lime, true))
    // Um remédio por linha — legível com a tela acabando de acender.
    if (body.isNotEmpty()) root.addView(text(body, 19f, Color.WHITE))
    root.addView(text(" ", 24f, muted))
    root.addView(button(if (meds.size > 1) "Tomei todos" else "Tomei", lime, bg) {
      AlarmNotifier.dismiss(this, id)
      IntakeWriter.record(this, meds)
      finish()
    })
    root.addView(button("Adiar ${AlarmScheduler.SNOOZE_MINUTES} min", Color.parseColor("#1E293B"), Color.WHITE) {
      AlarmNotifier.dismiss(this, id)
      AlarmScheduler.snooze(this, AlarmReceiver.baseId(id), title, body, meds)
      finish()
    })
    root.addView(button("Dispensar", Color.TRANSPARENT, muted) {
      AlarmNotifier.dismiss(this, id)
      finish()
    })
    setContentView(root)
  }
}
