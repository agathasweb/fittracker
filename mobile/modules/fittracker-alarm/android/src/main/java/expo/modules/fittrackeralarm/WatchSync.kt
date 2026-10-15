package expo.modules.fittrackeralarm

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.content.Context
import android.os.Build
import android.util.Log
import java.io.ByteArrayOutputStream
import java.util.Calendar
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Semaphore
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicReference
import java.util.concurrent.locks.ReentrantLock

/** Uma leitura de pressão vinda do relógio (horário local). */
data class BpReading(val measuredAt: String, val systolic: Int, val diastolic: Int, val heartRate: Int?)

/** Registro horário do relógio: passos/kcal da hora, FC e SpO2 (horário local, "yyyy-MM-dd HH:00:00"). */
data class WatchHour(val hourAt: String, val steps: Int, val kcal: Int, val heartRate: Int?, val spo2: Int?)

data class SyncResult(val readings: List<BpReading>, val hours: List<WatchHour>)

/**
 * Sincroniza o histórico do relógio (HW6 / app Wearfit Pro) via BLE — Nordic UART, quadros 0xAB.
 * O relógio grava sozinho uma medição por hora (passos, FC, SpO2, sistólica, diastólica);
 * aqui só PEDIMOS esse histórico. O Android compartilha o link LE, então convive com o Wearfit Pro.
 * Protocolo: ver memória "wearfit-ble-protocolo".
 */
object WatchSync {
  private const val TAG = "FittrackerWatch"
  private val SERVICE = UUID.fromString("6E400001-B5A3-F393-E0A9-E50E24DCCA9E")
  private val WRITE = UUID.fromString("6E400002-B5A3-F393-E0A9-E50E24DCCA9E")
  private val NOTIFY = UUID.fromString("6E400003-B5A3-F393-E0A9-E50E24DCCA9E")
  private val CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
  private const val IDLE_MS = 5_000L
  private const val MAX_MS = 45_000L

  /** Dispositivos LE já conectados ao celular (o relógio aparece porque o Wearfit Pro o mantém ligado). */
  @SuppressLint("MissingPermission")
  fun connectedDevices(ctx: Context): List<Pair<String, String>> {
    val bm = ctx.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
    return bm.getConnectedDevices(BluetoothProfile.GATT).map { (it.name ?: "Sem nome") to it.address }
  }

  /** Comando de sync do histórico a partir de `since` (dia 00:00 e instante exato). */
  private fun syncCommand(since: Calendar): ByteArray {
    val yy = since.get(Calendar.YEAR) - 2000
    val mo = since.get(Calendar.MONTH) + 1
    val dd = since.get(Calendar.DAY_OF_MONTH)
    val hh = since.get(Calendar.HOUR_OF_DAY)
    val mi = since.get(Calendar.MINUTE)
    return byteArrayOf(
      0xAB.toByte(), 0x00, 0x0E, 0xFF.toByte(), 0x51, 0x80.toByte(), 0x00,
      yy.toByte(), mo.toByte(), dd.toByte(), 0x00, 0x00,
      yy.toByte(), mo.toByte(), dd.toByte(), hh.toByte(), mi.toByte(),
    )
  }

  /** Remonta quadros: 1º fragmento começa com 0xAB + tamanho; os seguintes têm 1 byte de prefixo. */
  private class Assembler(val onFrame: (IntArray) -> Unit) {
    private var buf = ByteArrayOutputStream()
    private var expected = 0

    fun feed(chunk: ByteArray) {
      if (chunk.isEmpty()) return
      val first = chunk[0].toInt() and 0xFF
      if (expected == 0 || buf.size() >= expected) {
        if ((first == 0xAB || first == 0xEA) && chunk.size >= 3) {
          buf = ByteArrayOutputStream()
          expected = (((chunk[1].toInt() and 0xFF) shl 8) or (chunk[2].toInt() and 0xFF)) + 3
          buf.write(chunk, 0, chunk.size)
        } else {
          return
        }
      } else {
        buf.write(chunk, 1, chunk.size - 1)
      }
      if (buf.size() >= expected) {
        onFrame(buf.toByteArray().map { it.toInt() and 0xFF }.toIntArray())
        expected = 0
      }
    }
  }

  private fun ts(y: Int, mo: Int, d: Int, h: Int, mi: Int) =
    String.format("%04d-%02d-%02d %02d:%02d:00", 2000 + y, mo, d, h, mi)

  /** Extrai leituras de pressão dos quadros conhecidos; ignora o resto (passos, sono...). */
  fun parse(f: IntArray): BpReading? {
    if (f.size < 6 || f[0] != 0xAB || f[3] != 0xFF) return null
    return when {
      // 51 20: medição horária — [6..9]=YY MM DD HH, [16]=FC, [17]=SpO2, [18]=SIS, [19]=DIA
      f[4] == 0x51 && f[5] == 0x20 && f.size >= 20 && f[18] > 0 && f[19] > 0 ->
        BpReading(ts(f[6], f[7], f[8], f[9], 0), f[18], f[19], f[16].takeIf { it > 0 })
      // 51 14: medição feita no próprio relógio — [6..10]=YY MM DD HH mm, [11]=SIS, [12]=DIA
      f[4] == 0x51 && f[5] == 0x14 && f.size >= 13 && f[11] > 0 && f[12] > 0 ->
        BpReading(ts(f[6], f[7], f[8], f[9], f[10]), f[11], f[12], null)
      else -> null
    }
  }

  /** Liga a medição automática de hora em hora (o relógio grava pressão/FC/SpO2 a cada hora). */
  private fun hourlyMeasureOn() = byteArrayOf(0xAB.toByte(), 0x00, 0x04, 0xFF.toByte(), 0x78, 0x80.toByte(), 0x01)

  /** Acerta a hora do relógio pela do celular. */
  private fun timeSync(): ByteArray {
    val c = Calendar.getInstance()
    val y = c.get(Calendar.YEAR)
    return byteArrayOf(
      0xAB.toByte(), 0x00, 0x0B, 0xFF.toByte(), 0x93.toByte(), 0x80.toByte(), 0x00,
      (y shr 8).toByte(), (y and 0xFF).toByte(), (c.get(Calendar.MONTH) + 1).toByte(),
      c.get(Calendar.DAY_OF_MONTH).toByte(), c.get(Calendar.HOUR_OF_DAY).toByte(),
      c.get(Calendar.MINUTE).toByte(), c.get(Calendar.SECOND).toByte(),
    )
  }

  /** Medição de pressão pontual: 31 21 01 inicia, 31 21 00 para. */
  private fun bpMeasure(start: Boolean) =
    byteArrayOf(0xAB.toByte(), 0x00, 0x04, 0xFF.toByte(), 0x31, 0x21, if (start) 0x01 else 0x00)

  /** Registro horário (51 20) com o que vier — passos, kcal, FC, SpO2 — mesmo sem pressão. */
  fun parseHourly(f: IntArray): WatchHour? {
    if (f.size < 20 || f[0] != 0xAB || f[3] != 0xFF || f[4] != 0x51 || f[5] != 0x20) return null
    val steps = (f[10] shl 16) or (f[11] shl 8) or f[12]
    val kcal = (f[13] shl 16) or (f[14] shl 8) or f[15]
    return WatchHour(ts(f[6], f[7], f[8], f[9], 0), steps, kcal, f[16].takeIf { it > 0 }, f[17].takeIf { it > 0 })
  }

  /**
   * Uma conexão GATT com o relógio: notificações ligadas e escrita serializada (cada `send`
   * espera a confirmação da anterior). Fecha só o NOSSO cliente; o link de outro app continua.
   */
  class Session internal constructor(
    private val gatt: BluetoothGatt,
    private val wc: BluetoothGattCharacteristic,
    private val writeDone: Semaphore,
    private val lastData: AtomicLong,
    private val closed: CountDownLatch,
  ) {
    @SuppressLint("MissingPermission")
    fun send(cmd: ByteArray) {
      writeDone.drainPermits()
      if (Build.VERSION.SDK_INT >= 33) {
        gatt.writeCharacteristic(wc, cmd, wc.writeType)
      } else {
        @Suppress("DEPRECATION")
        wc.value = cmd
        @Suppress("DEPRECATION")
        gatt.writeCharacteristic(wc)
      }
      if (!writeDone.tryAcquire(3, TimeUnit.SECONDS)) Log.w(TAG, "escrita sem confirmação")
    }

    /** Espera até `idleMs` sem dados chegando (ou `maxMs` no total, ou o relógio cair). */
    fun awaitIdle(idleMs: Long = IDLE_MS, maxMs: Long = MAX_MS) {
      val start = System.currentTimeMillis()
      lastData.set(start)
      while (System.currentTimeMillis() - start < maxMs) {
        if (closed.await(500, TimeUnit.MILLISECONDS)) return
        if (System.currentTimeMillis() - lastData.get() > idleMs) return
      }
    }

    fun isClosed() = closed.count == 0L
  }

  /** Conecta, liga as notificações, roda `block` e desconecta. Bloqueante (fora da main thread). */
  @SuppressLint("MissingPermission")
  fun <T> session(ctx: Context, address: String, onFrame: (IntArray) -> Unit, block: (Session) -> T): T {
    // Uma conversa por vez (sync horária x mensagem x medição): escritas intercaladas embaralham quadros.
    if (!lock.tryLock(100, TimeUnit.SECONDS)) throw IllegalStateException("Relógio ocupado")
    try {
      return openSession(ctx, address, onFrame, block)
    } finally {
      lock.unlock()
    }
  }

  private val lock = ReentrantLock()

  @SuppressLint("MissingPermission")
  private fun <T> openSession(ctx: Context, address: String, onFrame: (IntArray) -> Unit, block: (Session) -> T): T {
    val bm = ctx.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
    val adapter = bm.adapter ?: throw IllegalStateException("Bluetooth indisponível")
    if (!adapter.isEnabled) throw IllegalStateException("Bluetooth desligado")
    val device: BluetoothDevice = adapter.getRemoteDevice(address)

    val ready = CountDownLatch(1)
    val closed = CountDownLatch(1)
    val writeDone = Semaphore(0)
    val lastData = AtomicLong(0L)
    val error = AtomicReference<String?>(null)
    val asm = Assembler { frame ->
      lastData.set(System.currentTimeMillis())
      try { onFrame(frame) } catch (e: Exception) { Log.w(TAG, "quadro: ${e.message}") }
    }

    val cb = object : BluetoothGattCallback() {
      override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) {
        if (newState == BluetoothProfile.STATE_CONNECTED) {
          g.discoverServices()
        } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
          if (ready.count > 0L) error.set("Relógio não conectou (status $status)")
          ready.countDown()
          closed.countDown()
        }
      }

      override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {
        val ch = g.getService(SERVICE)?.getCharacteristic(NOTIFY)
        if (ch == null) {
          error.set("Serviço do relógio não encontrado")
          ready.countDown()
          return
        }
        g.setCharacteristicNotification(ch, true)
        val d = ch.getDescriptor(CCCD)
        if (d == null) {
          ready.countDown()
          return
        }
        if (Build.VERSION.SDK_INT >= 33) {
          g.writeDescriptor(d, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE)
        } else {
          @Suppress("DEPRECATION")
          d.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
          @Suppress("DEPRECATION")
          g.writeDescriptor(d)
        }
      }

      override fun onDescriptorWrite(g: BluetoothGatt, d: BluetoothGattDescriptor, status: Int) {
        ready.countDown()
      }

      override fun onCharacteristicWrite(g: BluetoothGatt, c: BluetoothGattCharacteristic, status: Int) {
        writeDone.release()
      }

      @Deprecated("API < 33")
      override fun onCharacteristicChanged(g: BluetoothGatt, c: BluetoothGattCharacteristic) {
        @Suppress("DEPRECATION")
        if (c.uuid == NOTIFY) asm.feed(c.value ?: return)
      }

      override fun onCharacteristicChanged(g: BluetoothGatt, c: BluetoothGattCharacteristic, value: ByteArray) {
        if (c.uuid == NOTIFY) asm.feed(value)
      }
    }

    val gatt = device.connectGatt(ctx, false, cb, BluetoothDevice.TRANSPORT_LE)
      ?: throw IllegalStateException("Falha ao abrir conexão BLE")
    try {
      if (!ready.await(20, TimeUnit.SECONDS)) throw IllegalStateException("Tempo esgotado conectando ao relógio")
      error.get()?.let { throw IllegalStateException(it) }
      val wc = gatt.getService(SERVICE)?.getCharacteristic(WRITE)
        ?: throw IllegalStateException("Característica de escrita não encontrada")
      return block(Session(gatt, wc, writeDone, lastData, closed))
    } finally {
      try { gatt.disconnect() } catch (_: Exception) {}
      try { gatt.close() } catch (_: Exception) {}
    }
  }

  /**
   * Acerta a hora, garante a medição de hora em hora ligada e pede o histórico desde
   * `sinceMillis`. Termina após 5 s sem dados ou 45 s no total.
   */
  fun sync(ctx: Context, address: String, sinceMillis: Long): SyncResult {
    val readings = linkedMapOf<String, BpReading>()
    val hours = linkedMapOf<String, WatchHour>()
    session(ctx, address, { f ->
      parse(f)?.let { readings[it.measuredAt] = it }
      parseHourly(f)?.let { hours[it.hourAt] = it }
    }) { s ->
      s.send(timeSync())
      s.send(hourlyMeasureOn())
      s.send(syncCommand(Calendar.getInstance().apply { timeInMillis = sinceMillis }))
      s.awaitIdle()
    }
    Log.i(TAG, "sync: ${readings.size} leituras de pressão, ${hours.size} horas")
    return SyncResult(readings.values.toList(), hours.values.toList())
  }

  /**
   * Mede a pressão agora (o relógio leva ~1 min). Devolve a leitura ou null se não veio
   * (relógio fora do pulso, por exemplo).
   */
  fun measureNow(ctx: Context, address: String): BpReading? {
    val result = AtomicReference<BpReading?>(null)
    val got = CountDownLatch(1)
    session(ctx, address, { f ->
      // 31 21 SIS DIA — chega com zeros enquanto mede
      if (f.size >= 8 && f[0] == 0xAB && f[4] == 0x31 && f[5] == 0x21 && f[6] > 0 && f[7] > 0) {
        val now = Calendar.getInstance()
        val at = String.format(
          "%04d-%02d-%02d %02d:%02d:00", now.get(Calendar.YEAR), now.get(Calendar.MONTH) + 1,
          now.get(Calendar.DAY_OF_MONTH), now.get(Calendar.HOUR_OF_DAY), now.get(Calendar.MINUTE),
        )
        result.set(BpReading(at, f[6], f[7], null))
        got.countDown()
      }
    }) { s ->
      s.send(bpMeasure(true))
      val deadline = System.currentTimeMillis() + 90_000L
      while (System.currentTimeMillis() < deadline && !s.isClosed()) {
        if (got.await(500, TimeUnit.MILLISECONDS)) break
      }
      if (!s.isClosed()) s.send(bpMeasure(false))
    }
    return result.get()
  }

  /** Mostra uma mensagem no relógio (notificação do FitTracker). */
  fun pushMessage(
    ctx: Context, address: String, title: String, body: String,
    appId: Int = WatchMessage.APP_ID, type: Int = WatchMessage.TYPE,
  ) {
    session(ctx, address, {}) { s ->
      for (pkt in WatchMessage.packets(title, body, appId, type)) s.send(pkt)
    }
  }
}
