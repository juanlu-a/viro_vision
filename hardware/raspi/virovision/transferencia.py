"""Partir un payload en chunks para mandarlo por notificaciones GATT.

Módulo PURO (sin BlueZ, sin asyncio) a propósito: es lo único de la transferencia que puede fallar
por un error de cuenta, y el número que produce decide el ADR 0003. Se testea en la Mac.

Formato de cada chunk: header de 4 bytes + datos.
    seq   uint16 LE  índice del chunk, desde 0
    total uint16 LE  cantidad total de chunks
El enlace BLE entrega las notificaciones ordenadas y sin pérdida mientras la conexión viva; `seq`
está para que el receptor detecte una conexión que se cayó y volvió, no para reordenar.
"""

from __future__ import annotations

import struct
from dataclasses import dataclass

HEADER = struct.Struct("<HH")
HEADER_BYTES = HEADER.size
# 65535 chunks es el techo del uint16; con chunks de 20 bytes (MTU mínimo) son 1 MB, muy por encima
# de cualquier foto que viaje (53 KB a 1024 px).
MAX_CHUNKS = 0xFFFF
# ATT MTU por defecto es 23 → 20 bytes de payload de notificación. Menos que eso no existe.
MIN_CHUNK = HEADER_BYTES + 1


class ChunkInvalidoError(ValueError):
    """El tamaño de chunk pedido no deja lugar a datos, o el payload excede los chunks posibles."""


@dataclass(frozen=True)
class PlanTransferencia:
    bytes_totales: int
    tamano_chunk: int
    cantidad_chunks: int

    @property
    def datos_por_chunk(self) -> int:
        return self.tamano_chunk - HEADER_BYTES


def planificar(bytes_totales: int, tamano_chunk: int) -> PlanTransferencia:
    """Cuántos chunks hacen falta. `tamano_chunk` es el tamaño total de la notificación (header
    incluido), o sea MTU - 3 del lado del receptor."""
    if tamano_chunk < MIN_CHUNK:
        raise ChunkInvalidoError(f"chunk de {tamano_chunk} bytes: el header ya ocupa {HEADER_BYTES}")
    if bytes_totales < 0:
        raise ChunkInvalidoError("bytes negativos")
    datos = tamano_chunk - HEADER_BYTES
    cantidad = max(1, -(-bytes_totales // datos))  # ceil; un payload vacío igual viaja en 1 chunk
    if cantidad > MAX_CHUNKS:
        raise ChunkInvalidoError(f"{cantidad} chunks superan el uint16 del header")
    return PlanTransferencia(bytes_totales, tamano_chunk, cantidad)


def partir(payload: bytes, tamano_chunk: int) -> list[bytes]:
    plan = planificar(len(payload), tamano_chunk)
    datos = plan.datos_por_chunk
    return [
        HEADER.pack(seq, plan.cantidad_chunks) + payload[seq * datos : (seq + 1) * datos]
        for seq in range(plan.cantidad_chunks)
    ]


def armar(chunks: list[bytes]) -> bytes:
    """Inversa de `partir`. Existe para el test de ida y vuelta y para simular al receptor."""
    if not chunks:
        raise ChunkInvalidoError("sin chunks")
    partes: dict[int, bytes] = {}
    total_declarado = None
    for chunk in chunks:
        seq, total = HEADER.unpack_from(chunk)
        if total_declarado is None:
            total_declarado = total
        elif total != total_declarado:
            raise ChunkInvalidoError(f"total inconsistente: {total} vs {total_declarado}")
        partes[seq] = chunk[HEADER_BYTES:]
    faltantes = [seq for seq in range(total_declarado or 0) if seq not in partes]
    if faltantes:
        raise ChunkInvalidoError(f"faltan chunks: {faltantes[:5]}{'…' if len(faltantes) > 5 else ''}")
    return b"".join(partes[seq] for seq in range(total_declarado or 0))
