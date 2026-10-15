package expo.modules.fittrackeralarm

/**
 * Mensagem no relógio ("smart warn", comando 0x72 do Wearfit Pro):
 *   AB LEN_HI LEN_LO FF 72 80 <app> <tipo> <texto UTF-8...>   (LEN = texto + 5)
 * O 1º pacote leva até 20 bytes; o resto do texto vai em pacotes de [índice, até 19 bytes].
 * Texto limitado a ~321 bytes (como o app oficial), com "..." no fim.
 */
object WatchMessage {
  /** Ícone/app da mensagem no relógio (descoberto testando no HW6). */
  const val APP_ID = 33
  const val TYPE = 2
  private const val MAX_BYTES = 321

  fun truncate(text: String): ByteArray {
    val out = StringBuilder()
    for (ch in text) {
      if ((out.toString() + ch).toByteArray(Charsets.UTF_8).size > MAX_BYTES) {
        out.append("...")
        break
      }
      out.append(ch)
    }
    return out.toString().toByteArray(Charsets.UTF_8)
  }

  fun packets(title: String, body: String, appId: Int = APP_ID, type: Int = TYPE): List<ByteArray> {
    val text = truncate(if (body.isBlank()) title else "$title:${body.replace('\n', ' ')}")
    val len = text.size + 5
    val head = byteArrayOf(
      0xAB.toByte(), (len shr 8).toByte(), (len and 0xFF).toByte(), 0xFF.toByte(),
      0x72, 0x80.toByte(), appId.toByte(), type.toByte(),
    )
    val firstRoom = 20 - head.size
    val out = mutableListOf(head + text.copyOfRange(0, minOf(firstRoom, text.size)))
    var pos = firstRoom
    var idx = 0
    while (pos < text.size) {
      val end = minOf(pos + 19, text.size)
      out += byteArrayOf(idx.toByte()) + text.copyOfRange(pos, end)
      pos = end
      idx++
    }
    return out
  }
}
